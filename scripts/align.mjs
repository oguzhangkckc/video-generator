// Word timings for a finished voice-over (human or any TTS) with Whisper, run locally through whisper.cpp.
//   node scripts/align.mjs <slug> <audio-file> [--model large-v3-turbo] [--dry]
//   node scripts/align.mjs <slug> --timing [--dry]
// → public/videos/<slug>/vo.wav (stereo, −14 LUFS by one gain) + videos/<slug>/timing.json
//   --dry only reports; out/<slug>/align/timing.json gets the raw alignment of the input, e.g. to test against a
//   known timing.
//   --timing skips Whisper and takes the word times of the existing timing.json (e.g. a TTS voice-over with its own
//   alignment), so only the pauses of public/videos/<slug>/vo.wav are opened.
// Whisper hears the spoken form (src/spec/lexicon.ts), so "QRS" is matched as "kü re se"; its words are aligned to
// the script's and the captions always show the script. A pause shorter than its STYLE length (src/spec/pauses.ts)
// is opened with silence inside the existing quiet (scripts/lib/speech.mjs). Every sentence's ending is measured
// (scripts/prosody.py); a recording cannot be regenerated, so flagged sentences are listed to record again, with
// out/<slug>/review.html to hear them.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { downloadWhisperModel, installWhisperCpp, transcribe } from "@remotion/install-whisper-cpp";
import { spoken, spokenWords } from "../src/spec/lexicon.ts";
import { pauseAfter } from "../src/spec/pauses.ts";
import { parseArgs } from "./lib/args.mjs";
import { flagText, writeReview } from "./lib/review.mjs";
import { PROSODY, openPauses, phraseRanges, speechReport } from "./lib/speech.mjs";
import {
  ROOT,
  SAMPLE_RATE,
  duration,
  ffmpeg,
  loadSpec,
  loadTiming,
  outDir,
  publicDir,
  readPcm,
  requireSlug,
  videoDir,
  writeVoice,
  writeWav,
} from "./lib/video.mjs";

const WHISPER_VERSION = "1.7.6";
const WHISPER_DIR = path.join(ROOT, "out/whisper/whisper.cpp");
const MODEL_DIR = path.join(ROOT, "out/whisper/models");
const MATCH = 0.5;
const GAP_COST = 0.7;
const CHANNELS = 2;

const { positional, flags } = parseArgs(process.argv.slice(2), { model: "string", dry: "boolean", timing: "boolean" });
const slug = requireSlug(positional[0]);
const known = flags.timing ? loadTiming(slug) : null;
if (flags.timing && !known) {
  console.error(`--timing needs videos/${slug}/timing.json`);
  process.exit(1);
}
const input = positional[1] ? path.resolve(positional[1]) : known && path.join(publicDir(slug), "vo.wav");
if (!input) {
  console.error("Usage: node scripts/align.mjs <slug> <audio-file> [--model large-v3-turbo] [--dry]\n       node scripts/align.mjs <slug> --timing [--dry]");
  process.exit(1);
}
const model = flags.model ?? "large-v3-turbo";
const { spec } = loadSpec(slug);
const sections = spec.voiceover.sections;
const phrases = sections.flatMap((s) => s.phrases);
const written = phrases.flatMap((p) => p.split(" "));
const groups = phrases.flatMap(spokenWords);
const script = groups.flat();

const workDir = path.join(outDir(slug), "align");
mkdirSync(workDir, { recursive: true });

const knownWords = () => {
  if (known.words.length !== written.length) {
    console.error(`timing.json has ${known.words.length} words, the script ${written.length}; rebuild the voice-over first`);
    process.exit(1);
  }
  return { words: known.words.map((w) => ({ text: w.text, start: w.startMs / 1000, end: w.endMs / 1000, confidence: w.confidence })) };
};

/** Spoken-word times folded back onto the written words they read. */
const fold = (timed) => {
  let k = 0;
  return written.map((text, i) => {
    const span = timed.slice(k, (k += groups[i].length));
    const scores = span.map((w) => w.confidence).filter((c) => c != null);
    return { text, start: span[0].start, end: span[span.length - 1].end, confidence: scores.length === span.length ? Math.min(...scores) : null };
  });
};

const whisperWords = async () => {
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
    additionalArgs: [["--prompt", spoken(phrases.join(" ")).slice(0, 600)]],
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
  const timed = [];
  for (let i = 0; i < script.length; ) {
    if (anchor[i]) {
      timed.push({ text: script[i], start: anchor[i].start, end: anchor[i].end, confidence: anchor[i].score });
      i++;
      continue;
    }
    let k = i;
    while (k < script.length && !anchor[k]) k++;
    const from = timed.length ? timed[timed.length - 1].end : (heard[0]?.start ?? 0);
    const to = k < script.length ? anchor[k].start : Math.max(from, heard[heard.length - 1]?.end ?? audioEnd);
    const total = script.slice(i, k).reduce((s, w) => s + weight(w), 0);
    let cursor = from;
    for (let n = i; n < k; n++) {
      const d = ((to - from) * weight(script[n])) / total;
      timed.push({ text: script[n], start: cursor, end: cursor + d, confidence: null });
      cursor += d;
    }
    i = k;
  }
  return { words: fold(timed), matched: anchor.filter(Boolean).length, heard: heard.length };
};

const { words, matched, heard } = known ? knownWords() : await whisperWords();

const ranges = phraseRanges(phrases);
const sectionEnds = sections.flatMap((s) => s.phrases.map((_, i) => i === s.phrases.length - 1));
const pcm = readPcm(input, { channels: CHANNELS });
const opened = openPauses(pcm, CHANNELS, words, ranges, (i) => pauseAfter(phrases[i], { sectionEnd: sectionEnds[i] }));
const result = flags.dry ? { pcm, words } : opened;

const voFile = path.join(publicDir(slug), "vo.wav");
const measured = flags.dry ? path.join(workDir, "input-48k.wav") : voFile;
if (flags.dry) writeWav(measured, pcm, { channels: CHANNELS });
else {
  mkdirSync(publicDir(slug), { recursive: true });
  writeVoice(voFile, result.pcm, { channels: CHANNELS });
}
const report = speechReport({ wav: measured, pcm: readPcm(measured, { channels: CHANNELS }), channels: CHANNELS, words: result.words, sections });
ranges.forEach(([first], i) => (result.words[first].start = Math.max(result.words[first].start, report.bounds[i].onset)));

const round2 = (x) => Math.round(x * 100) / 100;
const timing = {
  source: known ? known.source : `whisper.cpp ${WHISPER_VERSION} ${model}`,
  audio: `videos/${slug}/vo.wav`,
  phrases: phrases.map((text, i) => ({ text, start: round2(report.bounds[i].onset), end: round2(report.bounds[i].offset) })),
  words: result.words.map((w) => ({
    text: w.text,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: w.confidence,
  })),
};
const timingFile = flags.dry ? path.join(workDir, "timing.json") : path.join(videoDir(slug), "timing.json");
writeFileSync(timingFile, `${JSON.stringify(timing, null, 2)}\n`);

if (!known) console.log(`${matched}/${script.length} script words matched Whisper's (${heard} heard); the rest interpolated`);
const added = opened.cuts.reduce((n, c) => n + c.seconds, 0);
console.log(`${flags.dry ? "would open" : "opened"} ${opened.cuts.length} of ${phrases.length - 1} phrase gaps to the STYLE pauses, +${added.toFixed(2)} s in all`);
const after = (i) => `after "${phrases[i].length > 40 ? `${phrases[i].slice(0, 39)}…` : phrases[i]}"`.padEnd(50);
for (const c of opened.cuts) console.log(`  ${after(c.after)} ${c.have.toFixed(2)} → ${c.want.toFixed(2)} s, cut at ${c.at.toFixed(2)} s`);
for (const i of opened.runOns) console.log(`  ${after(i)} no pause in the audio — left as recorded`);
let firstWord = 0;
for (const section of sections) {
  const start = result.words[firstWord].start;
  const shift = start - section.window[0];
  console.log(`  ${section.id.padEnd(12)} starts at ${start.toFixed(2)} s (window ${section.window[0]}–${section.window[1]})${Math.abs(shift) > 0.5 ? "  ← check marks tied to this section" : ""}`);
  firstWord += section.phrases.reduce((n, p) => n + p.split(" ").length, 0);
}
const speechEnd = result.words[result.words.length - 1].end;
if (speechEnd > spec.durationSec - 0.3) console.log(`speech ends at ${speechEnd.toFixed(2)} s — raise durationSec to about ${Math.ceil(speechEnd + 0.5)}`);

// A recording cannot be re-read by a model: flagged sentences are listed to record again, with the take to hear.
const flagged = report.sentences.filter((s) => s.flags.length);
const mono = readPcm(measured, { channels: 1 });
writeReview(slug, {
  mode: "recording",
  limits: PROSODY,
  items: flagged.map((s) => ({
    n: s.id + 1,
    text: s.text,
    candidates: [
      {
        seed: 0,
        label: `Kayıt, ${s.start.toFixed(2)}–${s.end.toFixed(2)} s`,
        rise: s.rise,
        decay: s.decay,
        flags: s.flags,
        pcm: mono.slice(Math.round(Math.max(0, s.start - 0.1) * SAMPLE_RATE), Math.round((s.end + 0.3) * SAMPLE_RATE)),
      },
    ],
  })),
});
console.log(flagged.length ? `\nRecord again (${flagged.length} of ${report.sentences.length} sentences):` : "\nIntonation: no sentence flagged");
for (const s of flagged) console.log(`  ${String(s.id + 1).padStart(2)}. ${s.start.toFixed(2)} s  ${s.text}  — ${flagText(s.flags)}`);
if (flagged.length) console.log(`  listen: ${path.relative(ROOT, path.join(outDir(slug), "review.html"))}`);
console.log(`${path.relative(ROOT, timingFile)}${flags.dry ? " (raw alignment of the input, before opening gaps)" : ""}`);
