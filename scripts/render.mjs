// node scripts/render.mjs <slug> [--draft] → out/<slug>.mp4 at −14 LUFS with a ≈ −1.5 dBTP ceiling.
// A placeholder voice (macOS say, timing.json source "placeholder:…"; skill auto mode with no real TTS) renders only
// with --draft, to out/<slug>.draft.mp4, which is never for publishing.
// Remotion renders lossless audio into an intermediate MKV; the mix is gained to target, peak-limited at 4× rate
// (≈ true peak) and encoded to AAC once. The video stream is copied untouched.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { ROOT, duration, ffmpeg, isPlaceholderVoice, loadTiming, loudness, outDir, renderFile, requireSlug } from "./lib/video.mjs";

const TARGET_LUFS = -14;
const LIMIT = 0.79; // −2 dBFS at 192 kHz; AAC adds a few tenths on top.

const slug = requireSlug(process.argv[2]);
const draft = process.argv.includes("--draft");
const placeholder = isPlaceholderVoice(loadTiming(slug));
if (placeholder && !draft) {
  console.error(`${slug}: the voice-over is the placeholder (${loadTiming(slug).source}) — make the real one, or render a test with --draft`);
  process.exit(1);
}
mkdirSync(outDir(slug), { recursive: true });
const raw = path.join(outDir(slug), "render-raw.mkv");
const output = renderFile(slug, { draft });

execFileSync("npx", ["remotion", "render", slug, raw, "--codec=h264-mkv"], { cwd: ROOT, stdio: "inherit" });

const hasAudio = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", raw], {
  encoding: "utf8",
}).trim();
if (!hasAudio) {
  ffmpeg("-i", raw, "-c:v", "copy", "-movflags", "+faststart", output);
} else {
  const before = loudness(raw);
  const gain = TARGET_LUFS - before.lufs;
  ffmpeg(
    "-i", raw, "-c:v", "copy",
    "-af", `volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=${LIMIT}:attack=2:release=60:level=false:latency=true,aresample=48000`,
    "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", output,
  );
  console.log(`mix ${before.lufs.toFixed(1)} LUFS → gain ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB`);
}

const frames = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames", "-of", "csv=p=0", output], {
  encoding: "utf8",
}).trim();
const after = hasAudio ? loudness(output) : null;
console.log(`${path.relative(ROOT, output)}: ${frames} frames, ${duration(output).toFixed(2)} s`);
if (after) {
  const ok = Math.abs(after.lufs - TARGET_LUFS) <= 0.5 && after.truePeak <= -1;
  console.log(`audio ${after.lufs.toFixed(1)} LUFS, true peak ${after.truePeak.toFixed(1)} dBTP → ${ok ? "OK" : "CHECK"}`);
  if (!ok) process.exitCode = 1;
}
