// One definition of a pause, of where a cut may fall and of how silence goes in, shared by voiceover, align and qa,
// so what a build lays out is what qa measures. All times are seconds; pcm is interleaved float at SAMPLE_RATE.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PAUSE, endsSentence, pauseAfter } from "../../src/spec/pauses.ts";
import { sentencesOf } from "../../src/spec/sentences.ts";
import { ROOT, SAMPLE_RATE } from "./video.mjs";

/**
 * Levels relative to the speech (its loudest 10 % of windows), so a gain change such as the loudness normalisation
 * measures the same. Below PAUSE_BELOW_SPEECH nothing is being said, though a breath may be heard: that is still a
 * pause to a listener. Below QUIET_BELOW_SPEECH it is silence (≈ −50 dBFS at −14 LUFS), the only place a cut may go.
 */
export const PAUSE_BELOW_SPEECH = 30;
export const QUIET_BELOW_SPEECH = 40;
/** Shorter quiet stretches are gaps inside words (stop closures), not pauses. */
export const MIN_PAUSE = 0.05;
/** Natural decay kept after a phrase's last word before any cut. */
export const TAIL = 0.15;
/** A cut never lands closer than this to the next sound. */
export const ONSET_GUARD = 0.03;
export const FADE = 0.015;
/** Prosody limits (STYLE.md "Anlatım"): a final rise above riseSt or a decay below decayS flags a sentence. */
export const PROSODY = { window: 0.4, riseSt: 2, decayS: 0.06 };

const WIN = SAMPLE_RATE / 100;
const HOP = WIN / 2;
const WIN_S = WIN / SAMPLE_RATE;
const k2t = (k) => (k * HOP) / SAMPLE_RATE;

/** Level (dBFS) of 10 ms windows every 5 ms, channels pooled, and the quiet threshold for this recording. */
export const analyse = (pcm, channels = 1) => {
  const frames = pcm.length / channels;
  const levels = new Float32Array(Math.max(0, Math.floor((frames - WIN) / HOP) + 1));
  for (let k = 0; k < levels.length; k++) {
    let energy = 0;
    for (let j = k * HOP * channels; j < (k * HOP + WIN) * channels; j++) energy += pcm[j] * pcm[j];
    levels[k] = 10 * Math.log10(energy / (WIN * channels) + 1e-12);
  }
  const sorted = [...levels].sort((x, y) => x - y);
  const pct = (q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : -120);
  // A noisy room raises the bar above its own floor, so its room tone still counts as quiet.
  const quiet = Math.max(pct(0.9) - QUIET_BELOW_SPEECH, pct(0.05) + 10);
  return { levels, quiet, pause: Math.max(pct(0.9) - PAUSE_BELOW_SPEECH, quiet), duration: frames / SAMPLE_RATE };
};

/** Stretches of at least `min` s under `level` (silence by default) inside [lo, hi], as [start, end]. */
export const quietRuns = (a, lo, hi, min = MIN_PAUSE, level = a.quiet) => {
  const runs = [];
  let run = null;
  for (let k = Math.max(0, Math.ceil((lo * SAMPLE_RATE) / HOP)); k < a.levels.length && k2t(k) + WIN_S <= hi + 1e-9; k++) {
    if (a.levels[k] < level) {
      run ??= [k2t(k), 0];
      run[1] = k2t(k) + WIN_S;
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs.filter(([s, e]) => e - s >= min - 1e-9);
};

/** First and last sound of a whole clip; null when it is silent. */
export const soundSpan = (a) => {
  let first = -1;
  let last = -1;
  for (let k = 0; k < a.levels.length; k++) {
    if (a.levels[k] >= a.quiet) {
      if (first < 0) first = k;
      last = k;
    }
  }
  return first < 0 ? null : { onset: k2t(first), offset: Math.min(a.duration, k2t(last) + WIN_S) };
};

const SEARCH_BEFORE = 0.3;
const SEARCH_AFTER = 0.15;

/** A pause grown to its full length: aligners put word edges inside pauses, which would clip it. */
const grow = (a, [start, end], floor) => {
  let k0 = Math.round((start * SAMPLE_RATE) / HOP);
  let k1 = Math.round(((end - WIN_S) * SAMPLE_RATE) / HOP);
  while (k0 > 0 && k2t(k0 - 1) >= floor && a.levels[k0 - 1] < a.pause) k0--;
  while (k1 + 1 < a.levels.length && a.levels[k1 + 1] < a.pause) k1++;
  return [k2t(k0), k2t(k1) + WIN_S];
};

/**
 * Acoustic bounds of each phrase, the pause between neighbours (null where they run on) and the silence inside
 * that pause where a cut may go (null when it is all breath). Words are aligner times; the pause nearest to each
 * word boundary is taken, so a stop closure inside a word is not.
 */
export const phraseBounds = (a, words, ranges) => {
  const gaps = [];
  const silences = [];
  let earliest = 0;
  for (let i = 0; i < ranges.length - 1; i++) {
    const end = words[ranges[i][1] - 1].end;
    const next = words[ranges[i + 1][0]].start;
    const [x, y] = [Math.min(end, next), Math.max(end, next)];
    const lo = Math.max(earliest, words[ranges[i][0]].start, x - SEARCH_BEFORE);
    const hi = Math.min(words[ranges[i + 1][1] - 1].end, y + SEARCH_AFTER);
    const distance = ([s, e]) => Math.max(0, s - y, x - e);
    const nearest = quietRuns(a, lo, hi, MIN_PAUSE, a.pause).sort((p, q) => distance(p) - distance(q) || q[1] - q[0] - (p[1] - p[0]))[0];
    const run = nearest ? grow(a, nearest, earliest) : null;
    gaps.push(run);
    silences.push(run ? (quietRuns(a, run[0], run[1], 0.02).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0] ?? null) : null);
    if (run) earliest = run[1];
  }
  const span = soundSpan(a) ?? { onset: 0, offset: a.duration };
  const mid = (j) => (words[ranges[j][1] - 1].end + words[ranges[j + 1][0]].start) / 2;
  const bounds = ranges.map((_, i) => ({
    onset: i === 0 ? span.onset : (gaps[i - 1]?.[1] ?? mid(i - 1)),
    offset: i === ranges.length - 1 ? span.offset : (gaps[i]?.[0] ?? mid(i)),
  }));
  return { bounds, gaps, silences };
};

/** Where silence may go in after a phrase: inside its quiet run, ≥ TAIL after the last word, ≥ ONSET_GUARD before the next sound. */
export const cutPoint = (run, lastWordEnd) => {
  if (!run) return null;
  const latest = run[1] - ONSET_GUARD;
  const wanted = Math.max((run[0] + run[1]) / 2, lastWordEnd + TAIL);
  const at = Math.min(wanted, latest);
  return { at, tail: at - lastWordEnd, short: wanted > latest };
};

const fadeAround = (pcm, channels, from, to, fade) => {
  for (let f = 0; f < fade; f++) {
    const gain = f / fade;
    for (let c = 0; c < channels; c++) {
      if (from - 1 - f >= 0) pcm[(from - 1 - f) * channels + c] *= gain;
      if ((to + f) * channels + c < pcm.length) pcm[(to + f) * channels + c] *= gain;
    }
  }
};

/** pcm with `seconds` of silence cut in at each `at`, faded over FADE on both sides of every cut. */
export const insertSilences = (pcm, channels, cuts) => {
  const fade = Math.round(FADE * SAMPLE_RATE);
  const sorted = cuts
    .filter((c) => c.seconds > 0)
    .map((c) => ({ frame: Math.round(c.at * SAMPLE_RATE), frames: Math.round(c.seconds * SAMPLE_RATE) }))
    .sort((p, q) => p.frame - q.frame);
  const out = new Float32Array(pcm.length + sorted.reduce((n, c) => n + c.frames, 0) * channels);
  const holes = [];
  let src = 0;
  let dst = 0;
  for (const c of sorted) {
    out.set(pcm.subarray(src * channels, c.frame * channels), dst * channels);
    dst += c.frame - src;
    holes.push([dst, dst + c.frames]);
    dst += c.frames;
    src = c.frame;
  }
  out.set(pcm.subarray(src * channels), dst * channels);
  for (const [from, to] of holes) fadeAround(out, channels, from, to, fade);
  return out;
};

/**
 * Silence cut in wherever the pause after phrase i is shorter than want(i); a break inside a sentence (PAUSE.none)
 * keeps the reading. Words move by phrase, not by time, since an aligner may start a word inside the silence.
 * Returns the new pcm and words, the cuts made, and the phrases followed by no pause to cut into.
 */
export const openPauses = (pcm, channels, words, ranges, want) => {
  const { gaps, silences } = phraseBounds(analyse(pcm, channels), words, ranges);
  const cuts = [];
  const runOns = [];
  gaps.forEach((run, i) => {
    const have = run ? run[1] - run[0] : 0;
    const wanted = want(i);
    if (wanted <= PAUSE.none || wanted - have < 0.02) return;
    const cut = cutPoint(silences[i], words[ranges[i][1] - 1].end);
    if (cut) cuts.push({ after: i, at: cut.at, seconds: wanted - have, have, want: wanted });
    else runOns.push(i);
  });
  const delay = new Float64Array(words.length);
  for (const c of cuts) for (let k = ranges[c.after + 1][0]; k < words.length; k++) delay[k] += Math.round(c.seconds * SAMPLE_RATE) / SAMPLE_RATE;
  return {
    pcm: insertSilences(pcm, channels, cuts),
    words: words.map((w, k) => ({ ...w, start: w.start + delay[k], end: w.end + delay[k] })),
    cuts,
    runOns,
  };
};

/** A mono clip cut to its sound, keeping 50 ms before it and ≥ TAIL after its last word, edges faded; times move by −from. */
export const trimToSound = (pcm, a, lastWordEnd) => {
  const span = soundSpan(a);
  if (!span) return null;
  const from = Math.max(0, span.onset - 0.05);
  const to = Math.min(a.duration, Math.max(span.offset, lastWordEnd + TAIL) + 0.03);
  const out = pcm.slice(Math.round(from * SAMPLE_RATE), Math.round(to * SAMPLE_RATE));
  const fade = Math.min(Math.round(FADE * SAMPLE_RATE), Math.floor(out.length / 2));
  for (let f = 0; f < fade; f++) {
    out[f] *= f / fade;
    out[out.length - 1 - f] *= f / fade;
  }
  return { pcm: out, from };
};

/** Word ranges [first, end) of each phrase, counting written words. */
export const phraseRanges = (phrases) => {
  let cursor = 0;
  return phrases.map((p) => [cursor, (cursor += p.split(" ").length)]);
};

/**
 * Final pitch rise (semitones) and decay (s) of each sentence, measured with Praat (parselmouth) through uv.
 * items: { id, wav, start, end, kind, quietDb } with quietDb the file's silence level (analyse().quiet);
 * returns { id, rise, decay, flags } for each.
 */
export const measureProsody = (items) => {
  if (items.length === 0) return [];
  const res = spawnSync("uv", ["run", "--quiet", path.join(ROOT, "scripts/prosody.py")], {
    input: JSON.stringify({ limits: PROSODY, items }),
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });
  if (res.error?.code === "ENOENT") throw new Error("uv is not installed: https://docs.astral.sh/uv/ (needed for the prosody check)");
  if (res.status !== 0) throw new Error(`prosody.py failed:\n${res.stderr.slice(-2000)}`);
  return JSON.parse(res.stdout);
};

/**
 * What a listener hears in a finished voice-over: each phrase's acoustic bounds, every pause between phrases
 * against its STYLE length, the spoken time, and each sentence's final rise and decay.
 * words: written words with { start, end } (timing.json order); wav: the file pcm was read from.
 */
export const speechReport = ({ wav, pcm, channels, words, sections }) => {
  const phrases = sections.flatMap((s) => s.phrases);
  const ranges = phraseRanges(phrases);
  const a = analyse(pcm, channels);
  const quietDb = a.quiet;
  const { bounds, gaps } = phraseBounds(a, words, ranges);
  const sectionEnds = sections.flatMap((s) => s.phrases.map((_, i) => i === s.phrases.length - 1));
  const pauses = gaps.map((run, i) => ({
    after: i,
    text: phrases[i],
    at: bounds[i].offset,
    length: run ? run[1] - run[0] : 0,
    want: pauseAfter(phrases[i], { sectionEnd: sectionEnds[i] }),
    sentenceEnd: endsSentence(phrases[i]) || sectionEnds[i],
  }));
  const spokenSeconds = bounds.reduce((sum, b) => sum + (b.offset - b.onset), 0);
  const sentences = sentencesOf(sections).map((s, i) => ({ id: i, ...s, start: bounds[s.first].onset, end: bounds[s.last].offset }));
  const measured = new Map(
    measureProsody(sentences.filter((s) => s.kind !== "fragment").map(({ id, start, end, kind }) => ({ id, wav, start, end, kind, quietDb }))).map((m) => [m.id, m]),
  );
  return {
    bounds,
    pauses,
    spokenSeconds,
    words: words.length,
    sentences: sentences.map((s) => ({ ...s, rise: null, decay: null, flags: [], ...measured.get(s.id) })),
  };
};
