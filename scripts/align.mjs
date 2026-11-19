// Word timings for a finished voice-over (human or any TTS) with Whisper, run locally through whisper.cpp.
//   node scripts/align.mjs <slug> <audio-file> [--model large-v3-turbo] [--dry]
// → public/videos/<slug>/vo.wav (48 kHz stereo, −14 LUFS) + videos/<slug>/timing.json
//   --dry only reports; out/<slug>/align/timing.json gets the raw alignment of the input, e.g. to test against a
//   known timing.
// Whisper's text is only used for timing: it may spell "yirmi bin" as "20.000", so its words are aligned to the
// script's words and the captions always show the script.
// A gap between phrases shorter than its STYLE pause (src/spec/pauses.ts) is opened with silence, cut in at the
// quietest point of the gap; longer gaps stay as recorded.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { downloadWhisperModel, installWhisperCpp, transcribe } from "@remotion/install-whisper-cpp";
import { pauseAfter } from "../src/spec/pauses.ts";
import { parseArgs } from "./lib/args.mjs";
import { ROOT, SAMPLE_RATE, duration, ffmpeg, loadSpec, outDir, publicDir, readPcm, requireSlug, videoDir, writeWav } from "./lib/video.mjs";

const WHISPER_VERSION = "1.7.6";
const WHISPER_DIR = path.join(ROOT, "out/whisper/whisper.cpp");
const MODEL_DIR = path.join(ROOT, "out/whisper/models");
const MATCH = 0.5;
const GAP_COST = 0.7;
const CHANNELS = 2;
const MIN_OPEN = 0.02;
const QUIET_DB = -50;
const MIN_PAUSE = 0.05;
// Whisper's phrase ends land up to ~0.25 s late (DTW), so the real pause is searched for mostly before them.
const SEARCH_BEFORE = 0.3;
const SEARCH_AFTER = 0.15;
const WIN = SAMPLE_RATE / 100;
const HOP = WIN / 2;
const FADE = Math.round(0.005 * SAMPLE_RATE);

const { positional, flags } = parseArgs(process.argv.slice(2), { model: "string", dry: "boolean" });
const slug = requireSlug(positional[0]);
const input = positional[1] && path.resolve(positional[1]);
if (!input) {
  console.error("Usage: node scripts/align.mjs <slug> <audio-file> [--model large-v3-turbo] [--dry]");
  process.exit(1);
}
const model = flags.model ?? "large-v3-turbo";
const { spec } = loadSpec(slug);
const phrases = spec.voiceover.sections.flatMap((s) => s.phrases);
const script = phrases.flatMap((p) => p.split(" "));

const workDir = path.join(outDir(slug), "align");
mkdirSync(workDir, { recursive: true });
const pcm16k = path.join(workDir, "input-16k.wav");
ffmpeg("-i", input, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", pcm16k);

await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: true });
mkdirSync(MODEL_DIR, { recursive: true });
await downloadWhisperModel({ model, folder: MODEL_DIR, printOutput: true });
const output = await transcribe({
  inputPath: pcm16k,
  whisperPath: WHISPER_DIR,
  whisperCppVersion: WHISPER_VERSION,
  model,
  modelFolder: MODEL_DIR,
  tokenLevelTimestamps: true,
  language: spec.lang === "tr" ? "tr" : spec.lang,
  splitOnWord: true,
  // The script as initial prompt nudges Whisper towards the same spelling, which raises the match rate.
  additionalArgs: [["--prompt", phrases.join(" ").slice(0, 600)]],
});
writeFileSync(path.join(workDir, "whisper.json"), JSON.stringify(output, null, 1));

// Segment offsets are coarse (−116 ms bias, 153 ms mean error against ElevenLabs' own alignment of the pilot);
// DTW token times land late by a near-constant amount, so word start = first token's DTW time − DTW_LEAD and
// word end = last token's DTW time (≈ 50 ms mean error on the same test).
const DTW_LEAD = 0.14;
const heard = output.transcription
  .map((item) => {
    const text = item.text.trim();
    const tokens = item.tokens.filter((t) => t.t_dtw >= 0 && !t.text.startsWith("[_"));
    if (tokens.length === 0) return { text, start: item.offsets.from / 1000, end: item.offsets.to / 1000 };
    const start = Math.max(0, tokens[0].t_dtw / 100 - DTW_LEAD);
    return { text, start, end: Math.max(start + 0.05, tokens[tokens.length - 1].t_dtw / 100) };
  })
  .filter((w) => w.text.length > 0);

const norm = (s) => s.toLocaleLowerCase("tr").normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
const similarity = (a, b) => {
  if (!a.length || !b.length) return 0;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
};

// Needleman–Wunsch over words: substitution costs 1 − similarity, skipping a word on either side costs GAP_COST.
const A = script.map(norm);
const B = heard.map((w) => norm(w.text));
const cost = Array.from({ length: A.length + 1 }, (_, i) => Array.from({ length: B.length + 1 }, (_, j) => (i + j) * GAP_COST));
const sims = A.map((a) => B.map((b) => similarity(a, b)));
for (let i = 1; i <= A.length; i++) {
  for (let j = 1; j <= B.length; j++) {
    cost[i][j] = Math.min(cost[i - 1][j - 1] + 1 - sims[i - 1][j - 1], cost[i - 1][j] + GAP_COST, cost[i][j - 1] + GAP_COST);
  }
}
const anchor = new Array(A.length).fill(null);
for (let i = A.length, j = B.length; i > 0 && j > 0; ) {
  if (cost[i][j] === cost[i - 1][j - 1] + 1 - sims[i - 1][j - 1]) {
    if (sims[i - 1][j - 1] >= MATCH) anchor[i - 1] = { ...heard[j - 1], score: sims[i - 1][j - 1] };
    i--;
    j--;
  } else if (cost[i][j] === cost[i - 1][j] + GAP_COST) i--;
  else j--;
}

// Unmatched script words share the gap between their matched neighbours by length.
const audioEnd = duration(input);
const weight = (w) => norm(w).length + 1;
const words = [];
for (let i = 0; i < script.length; ) {
  if (anchor[i]) {
    words.push({ text: script[i], start: anchor[i].start, end: anchor[i].end, confidence: anchor[i].score });
    i++;
    continue;
  }
  let k = i;
  while (k < script.length && !anchor[k]) k++;
  const from = words.length ? words[words.length - 1].end : (heard[0]?.start ?? 0);
  const to = k < script.length ? anchor[k].start : Math.max(from, heard[heard.length - 1]?.end ?? audioEnd);
  const total = script.slice(i, k).reduce((s, w) => s + weight(w), 0);
  let cursor = from;
  for (let n = i; n < k; n++) {
    const d = ((to - from) * weight(script[n])) / total;
    words.push({ text: script[n], start: cursor, end: cursor + d, confidence: null });
    cursor += d;
  }
  i = k;
}

let cursor = 0;
const ranges = phrases.map((text) => [cursor, (cursor += text.split(" ").length)]);
const sectionEnds = spec.voiceover.sections.flatMap((s) => s.phrases.map((_, i) => i === s.phrases.length - 1));

const pcm = readPcm(input, { channels: CHANNELS });
const levels = new Float32Array(Math.max(0, Math.floor((pcm.length / CHANNELS - WIN) / HOP) + 1));
for (let k = 0; k < levels.length; k++) {
  let energy = 0;
  for (let j = k * HOP * CHANNELS; j < (k * HOP + WIN) * CHANNELS; j++) energy += pcm[j] * pcm[j];
  levels[k] = 10 * Math.log10(energy / (WIN * CHANNELS) + 1e-12);
}
// A noisy room raises the bar above its own floor, so its room tone still counts as a pause.
const quietDb = Math.max(QUIET_DB, [...levels].sort((x, y) => x - y)[Math.floor(levels.length * 0.05)] + 10);

/** The quiet stretch (≥ MIN_PAUSE) inside [lo, hi] s nearest to [a, b] s, as [first, end) frames; null if none. */
const pauseNear = (lo, hi, a, b) => {
  const runs = [];
  let run = null;
  for (let k = Math.max(0, Math.ceil((lo * SAMPLE_RATE) / HOP)); k < levels.length && k * HOP + WIN <= hi * SAMPLE_RATE; k++) {
    if (levels[k] < quietDb) {
      run ??= [k * HOP, 0];
      run[1] = k * HOP + WIN;
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  const distance = ([s, e]) => Math.max(0, s / SAMPLE_RATE - b, a - e / SAMPLE_RATE);
  const long = runs.filter(([s, e]) => e - s >= MIN_PAUSE * SAMPLE_RATE);
  return long.sort((x, y) => distance(x) - distance(y) || y[1] - y[0] - (x[1] - x[0]))[0] ?? null;
};

// The pause is measured in the audio, since Whisper's gaps are too rough; a boundary with no real pause is never cut.
const opens = [];
const runOns = [];
for (let i = 0, earliest = 0; i < phrases.length - 1; i++) {
  const end = words[ranges[i][1] - 1].end;
  const next = words[ranges[i + 1][0]].start;
  const want = pauseAfter(phrases[i], { sectionEnd: sectionEnds[i] });
  const lo = Math.max(earliest, words[ranges[i][0]].start, Math.min(end, next) - SEARCH_BEFORE);
  const hi = Math.min(words[ranges[i + 1][1] - 1].end, Math.max(end, next) + SEARCH_AFTER);
  const run = pauseNear(lo, hi, Math.min(end, next), Math.max(end, next));
  const pause = run ? (run[1] - run[0]) / SAMPLE_RATE : next - end;
  if (want - pause < MIN_OPEN) continue;
  if (!run) {
    runOns.push({ after: i, at: end });
    continue;
  }
  const frame = Math.round((run[0] + run[1]) / 2);
  opens.push({ after: i, frame, frames: Math.round((want - pause) * SAMPLE_RATE), pause, want });
  earliest = frame / SAMPLE_RATE;
}

let delay = 0;
const shifted = phrases.flatMap((_, i) => {
  const out = words.slice(...ranges[i]).map((w) => ({ ...w, start: w.start + delay, end: w.end + delay }));
  const open = opens.find((o) => o.after === i);
  if (open) delay += open.frames / SAMPLE_RATE;
  return out;
});

/** The recording with each open's silence cut in at its frame, faded over FADE frames on both sides of the cut. */
const withSilences = () => {
  const out = new Float32Array(pcm.length + opens.reduce((n, o) => n + o.frames, 0) * CHANNELS);
  const holes = [];
  let src = 0;
  let dst = 0;
  for (const o of opens) {
    out.set(pcm.subarray(src * CHANNELS, o.frame * CHANNELS), dst * CHANNELS);
    dst += o.frame - src;
    holes.push([dst, dst + o.frames]);
    dst += o.frames;
    src = o.frame;
  }
  out.set(pcm.subarray(src * CHANNELS), dst * CHANNELS);
  for (const [a, b] of holes) {
    for (let f = 0; f < FADE; f++) {
      for (let c = 0; c < CHANNELS; c++) {
        if (a - 1 - f >= 0) out[(a - 1 - f) * CHANNELS + c] *= f / FADE;
        if ((b + f) * CHANNELS + c < out.length) out[(b + f) * CHANNELS + c] *= f / FADE;
      }
    }
  }
  return out;
};

const round2 = (x) => Math.round(x * 100) / 100;
const timingOf = (ws) => ({
  source: `whisper.cpp ${WHISPER_VERSION} ${model}`,
  audio: `videos/${slug}/vo.wav`,
  phrases: phrases.map((text, i) => {
    const span = ws.slice(...ranges[i]);
    return { text, start: round2(span[0].start), end: round2(span[span.length - 1].end) };
  }),
  words: ws.map((w) => ({
    text: w.text,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: w.confidence,
  })),
});

const timingFile = flags.dry ? path.join(workDir, "timing.json") : path.join(videoDir(slug), "timing.json");
writeFileSync(timingFile, `${JSON.stringify(timingOf(flags.dry ? words : shifted), null, 2)}\n`);
if (!flags.dry) {
  mkdirSync(publicDir(slug), { recursive: true });
  writeWav(path.join(publicDir(slug), "vo.wav"), withSilences(), { channels: CHANNELS, filter: "loudnorm=I=-14:TP=-1.5:LRA=7,aresample=48000" });
}

const matched = anchor.filter(Boolean).length;
console.log(`${matched}/${script.length} script words matched Whisper's (${heard.length} heard); the rest interpolated`);
const added = opens.reduce((n, o) => n + o.frames, 0) / SAMPLE_RATE;
console.log(
  `${flags.dry ? "would open" : "opened"} ${opens.length} of ${phrases.length - 1} phrase gaps to the STYLE pauses, +${added.toFixed(2)} s in all`,
);
const after = (i) => `after "${phrases[i].length > 40 ? `${phrases[i].slice(0, 39)}…` : phrases[i]}"`.padEnd(50);
for (const o of opens) {
  console.log(`  ${after(o.after)} ${o.pause.toFixed(2)} → ${o.want.toFixed(2)} s, cut at ${(o.frame / SAMPLE_RATE).toFixed(2)} s`);
}
for (const r of runOns) console.log(`  ${after(r.after)} no pause in the audio near ${r.at.toFixed(2)} s — left as recorded`);
let firstWord = 0;
for (const section of spec.voiceover.sections) {
  const start = shifted[firstWord].start;
  const shift = start - section.window[0];
  console.log(`  ${section.id.padEnd(12)} starts at ${start.toFixed(2)} s (window ${section.window[0]}–${section.window[1]})${Math.abs(shift) > 0.5 ? "  ← check marks tied to this section" : ""}`);
  firstWord += section.phrases.reduce((n, p) => n + p.split(" ").length, 0);
}
const speechEnd = shifted[shifted.length - 1].end;
if (speechEnd > spec.durationSec - 0.3) {
  console.log(`speech ends at ${speechEnd.toFixed(2)} s — raise durationSec to about ${Math.ceil(speechEnd + 0.5)}`);
}
console.log(`${path.relative(ROOT, timingFile)}${flags.dry ? " (raw alignment of the input, before opening gaps)" : ""}`);
