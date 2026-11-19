// Shared helpers for the scripts: paths, spec loading (same zod schema as Remotion), ffmpeg, loudness.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

/** Interleaved float samples at SAMPLE_RATE → 16-bit WAV, through an optional ffmpeg filter. */
export const writeWav = (file, samples, { channels = 1, filter } = {}) =>
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...rawPcm(channels), "-i", "pipe:0", ...(filter ? ["-af", filter] : []), "-c:a", "pcm_s16le", file],
    { input: asBuffer(samples) },
  );
