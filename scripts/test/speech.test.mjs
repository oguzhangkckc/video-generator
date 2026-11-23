import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { FADE, TAIL, analyse, measureProsody, openPauses, phraseBounds, phraseRanges } from "../lib/speech.mjs";
import { SAMPLE_RATE, writeWav } from "../lib/video.mjs";

const amp = (db) => 10 ** (db / 20) * Math.SQRT2;
const tone = (seconds, { db = -12, f0 = 200, f1 = f0, fadeOut = 0.02 } = {}) => {
  const n = Math.round(seconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 + ((f1 - f0) * i) / n;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const tail = Math.min(1, (n - i) / (fadeOut * SAMPLE_RATE));
    const head = Math.min(1, i / (0.02 * SAMPLE_RATE));
    out[i] = amp(db) * head * tail * (0.6 * Math.sin(phase) + 0.3 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase));
  }
  return out;
};
const silence = (seconds) => new Float32Array(Math.round(seconds * SAMPLE_RATE));
const noise = (seconds, db) => Float32Array.from({ length: Math.round(seconds * SAMPLE_RATE) }, () => amp(db) * (Math.random() * 2 - 1) * 0.7);
const join = (...parts) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const phrases = ["Bir iki.", "Üç dört."];
const ranges = phraseRanges(phrases);
// Word times as an aligner would give them: the second phrase's first word starts early, inside the silence.
const wordsFor = (gapStart, nextStart) => [
  { start: 0.05, end: 0.3 },
  { start: 0.3, end: gapStart },
  { start: nextStart - 0.08, end: nextStart + 0.25 },
  { start: nextStart + 0.25, end: nextStart + 0.5 },
];

test("a short pause is opened to its STYLE length inside the silence, later words move with it", () => {
  const pcm = join(silence(0.05), tone(0.5), silence(0.12), tone(0.5), silence(0.2));
  const out = openPauses(pcm, 1, wordsFor(0.55, 0.67), ranges, () => 0.4);
  assert.equal(out.cuts.length, 1);
  const [cut] = out.cuts;
  assert.ok(cut.at >= 0.55 && cut.at <= 0.67 - 0.03, `cut at ${cut.at} lies in the silence`);
  const { gaps } = phraseBounds(analyse(out.pcm), out.words, ranges);
  assert.ok(Math.abs(gaps[0][1] - gaps[0][0] - 0.4) < 0.02, `pause is ${gaps[0][1] - gaps[0][0]}`);
  assert.ok(Math.abs(out.words[2].start - (0.59 + cut.seconds)) < 0.001, "the early-starting word moved with the cut");
});

test("the cut keeps TAIL after the last word and fades over 10–20 ms", () => {
  const pcm = join(silence(0.05), tone(0.5), silence(0.5), tone(0.5));
  const words = wordsFor(0.55, 1.05);
  const out = openPauses(pcm, 1, words, ranges, () => 0.7);
  const [cut] = out.cuts;
  assert.ok(cut.at - words[1].end >= TAIL - 1e-6, `tail ${cut.at - words[1].end}`);
  assert.ok(FADE >= 0.01 && FADE <= 0.02);
});

test("no silence between phrases: nothing is cut, the phrase is reported", () => {
  const pcm = join(silence(0.05), tone(0.5), tone(0.5), silence(0.2));
  const out = openPauses(pcm, 1, wordsFor(0.55, 0.55), ranges, () => 0.4);
  assert.equal(out.cuts.length, 0);
  assert.deepEqual(out.runOns, [0]);
  assert.equal(out.pcm.length, pcm.length);
});

test("a breath counts as pause, but the cut goes into the silence beside it", () => {
  const pcm = join(silence(0.05), tone(0.5), silence(0.08), noise(0.15, -42), silence(0.06), tone(0.5), silence(0.2));
  const words = wordsFor(0.55, 0.84);
  const { gaps, silences } = phraseBounds(analyse(pcm), words, ranges);
  assert.ok(gaps[0][1] - gaps[0][0] > 0.25, `the pause includes the breath (${gaps[0][1] - gaps[0][0]})`);
  const out = openPauses(pcm, 1, words, ranges, () => 0.4);
  const [cut] = out.cuts;
  assert.ok(cut.at >= silences[0][0] && cut.at <= silences[0][1], "cut inside a silence, not the breath");
  assert.ok(cut.at < 0.63 || cut.at > 0.78, `cut at ${cut.at} is outside the breath`);
});

test("a caption break inside a sentence is left as read", () => {
  const pcm = join(silence(0.05), tone(0.5), silence(0.06), tone(0.5));
  const out = openPauses(pcm, 1, wordsFor(0.55, 0.61), phraseRanges(["Bir iki", "üç dört."]), () => 0.1);
  assert.equal(out.cuts.length, 0);
});

const uv = spawnSync("uv", ["--version"]).status === 0;
test("prosody: a falling, fading ending passes; a rising, cut ending is flagged", { skip: !uv && "uv not installed" }, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "prosody-"));
  const good = join(silence(0.1), tone(1, { f0: 230, f1: 180, fadeOut: 0.25 }), silence(0.3));
  // 160 → 300 Hz: the last 0.4 s rises by about 3.6 semitones.
  const bad = join(silence(0.1), tone(1, { f0: 160, f1: 300, fadeOut: 0.005 }), silence(0.3));
  const files = [good, bad].map((pcm, i) => {
    const file = path.join(dir, `${i}.wav`);
    writeWav(file, pcm);
    return { file, a: analyse(pcm) };
  });
  const [ok, flagged] = measureProsody(files.map(({ file, a }, id) => ({ id, wav: file, start: 0.1, end: 1.1, kind: "statement", quietDb: a.quiet })));
  assert.deepEqual(ok.flags, [], JSON.stringify(ok));
  assert.ok(ok.rise <= 0 && ok.decay >= 0.06, JSON.stringify(ok));
  assert.deepEqual(flagged.flags, ["rise", "decay"], JSON.stringify(flagged));
});
