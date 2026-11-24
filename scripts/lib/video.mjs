// Shared helpers for the scripts: paths, spec loading (same zod schema as Remotion), ffmpeg, loudness.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Timing, VideoSpec } from "../../src/spec/schema.ts";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error(`Node 22+ is needed (found ${process.versions.node}): nvm use 22`);
  process.exit(2);
}

export const videoDir = (slug) => path.join(ROOT, "videos", slug);
export const publicDir = (slug) => path.join(ROOT, "public", "videos", slug);
export const outDir = (slug) => path.join(ROOT, "out", slug);

export const requireSlug = (slug) => {
  if (!slug || !SLUG.test(slug)) {
    console.error(`"${slug ?? ""}" is not a valid slug (lowercase letters, digits and single hyphens)`);
    process.exit(1);
  }
  return slug;
};

export const loadSpec = (slug) => {
  const file = path.join(videoDir(slug), "spec.json");
  if (!existsSync(file)) {
    console.error(`${path.relative(ROOT, file)} does not exist — npm run new -- ${slug} "<başlık>"`);
    process.exit(1);
  }
  const json = JSON.parse(readFileSync(file, "utf8"));
  const parsed = VideoSpec.safeParse(json);
  if (!parsed.success) {
    console.error(`${path.relative(ROOT, file)} is invalid:\n${z.prettifyError(parsed.error)}`);
    process.exit(1);
  }
  return { file, json, spec: parsed.data };
};

const WIDTH = 120;
const inline = (v) =>
  Array.isArray(v)
    ? `[${v.map(inline).join(", ")}]`
    : v && typeof v === "object"
      ? Object.keys(v).length
        ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }`
        : "{}"
      : JSON.stringify(v);

/**
 * A spec as the repo writes it: an array or object goes on one line when it fits in 120 columns (objects with more
 * than six keys always open up), so a script that edits one value leaves the rest of the file as it was.
 */
export const formatSpec = (value, indent = 0, prefix = 0) => {
  const line = inline(value);
  if (!value || typeof value !== "object") return line;
  const wide = !Array.isArray(value) && Object.keys(value).length > 6;
  if (indent + prefix + line.length + 1 <= WIDTH && !wide) return line;
  const pad = " ".repeat(indent + 2);
  const items = Array.isArray(value)
    ? value.map((x) => pad + formatSpec(x, indent + 2))
    : Object.entries(value).map(([k, x]) => `${pad}${JSON.stringify(k)}: ${formatSpec(x, indent + 2, JSON.stringify(k).length + 2)}`);
  return `${Array.isArray(value) ? "[" : "{"}\n${items.join(",\n")}\n${" ".repeat(indent)}${Array.isArray(value) ? "]" : "}"}`;
};

export const loadTiming = (slug) => {
  const file = path.join(videoDir(slug), "timing.json");
  return existsSync(file) ? Timing.parse(JSON.parse(readFileSync(file, "utf8"))) : null;
};

export const ffmpeg = (...args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);

/** Integrated loudness (LUFS) and true peak (dBTP) of a file's first audio stream. */
export const loudness = (file) => {
  const { stderr } = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], {
    encoding: "utf8",
  });
  const summary = stderr.slice(stderr.lastIndexOf("Summary:"));
  const number = (re) => Number(re.exec(summary)?.[1]);
  return { lufs: number(/I:\s+(-?[\d.]+) LUFS/), truePeak: number(/Peak:\s+(-?[\d.]+) dBFS/) };
};

export const duration = (file) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }));

export const SAMPLE_RATE = 48000;
const rawPcm = (channels) => ["-f", "f32le", "-ar", String(SAMPLE_RATE), "-ac", String(channels)];
const asBuffer = (samples) => Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);

/** Interleaved float samples at SAMPLE_RATE from a file path, encoded bytes (Buffer) or raw samples (Float32Array). */
export const readPcm = (input, { channels = 1, filter } = {}) => {
  const raw = input instanceof Float32Array;
  const out = execFileSync(
    "ffmpeg",
    [
      ...["-hide_banner", "-loglevel", "error"],
      ...(raw ? rawPcm(channels) : []),
      ...["-i", typeof input === "string" ? input : "pipe:0"],
      ...(filter ? ["-af", filter] : []),
      ...rawPcm(channels),
      "pipe:1",
    ],
    { input: typeof input === "string" ? undefined : raw ? asBuffer(input) : input, maxBuffer: 1 << 30 },
  );
  return new Float32Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
};

/**
 * A voice-over brought to −14 LUFS (true peak ≤ −1.5 dBTP) by one gain, as stereo WAV. A dynamic loudnorm would
 * lift the quiet between sentences relative to the speech and shorten the pauses qa measures.
 */
export const writeVoice = (file, samples, { channels = 1 } = {}) => {
  const raw = `${file}.raw.wav`;
  writeWav(raw, samples, { channels });
  const { lufs, truePeak } = loudness(raw);
  rmSync(raw);
  const gain = Math.min(-14 - lufs, -1.5 - truePeak);
  writeWav(file, samples, { channels, filter: `aformat=channel_layouts=stereo,volume=${gain.toFixed(2)}dB` });
  return gain;
};

/** Interleaved float samples at SAMPLE_RATE → 16-bit WAV, through an optional ffmpeg filter. */
export const writeWav = (file, samples, { channels = 1, filter } = {}) =>
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...rawPcm(channels), "-i", "pipe:0", ...(filter ? ["-af", filter] : []), "-c:a", "pcm_s16le", file],
    { input: asBuffer(samples) },
  );
