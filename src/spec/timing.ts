import { pauseAfter } from "./pauses.ts";
import type { Caption, Timing, VideoSpecInput } from "./schema";

export type Phrase = { text: string; start: number; end: number };
export type CaptionPage = { startMs: number; endMs: number; tokens: Caption[] };
type Section = VideoSpecInput["voiceover"]["sections"][number];

/** STYLE.md speaking rate while actually speaking (pauses come on top); drafts use it before any voice-over. */
export const WORDS_PER_SECOND = 2.8;
const LEAD = 0.2;
const TAIL = 0.15;

export const wordCount = (text: string) => text.split(" ").length;
const weight = (word: string) => word.replace(/[^\p{L}\p{N}]/gu, "").length + 1;

export const phraseTexts = (sections: Section[]) => sections.flatMap((s) => s.phrases);

/** Draft timing: phrases at the STYLE.md rate with STYLE pauses between them, squeezed if the window is too short. */
export const estimatePhrases = (sections: Section[]): Phrase[] =>
  sections.flatMap(({ window: [s0, s1], phrases }) => {
    const durations = phrases.map((p) => wordCount(p) / WORDS_PER_SECOND);
    const gaps = phrases.map((text, i) => (i < phrases.length - 1 ? pauseAfter(text) : 0));
    const needed = durations.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
    const squeeze = Math.min(1, Math.max(0.1, s1 - s0 - LEAD - TAIL) / needed);
    let cursor = s0 + LEAD;
    return phrases.map((text, i) => {
      const start = cursor;
      cursor += durations[i] * squeeze;
      const phrase = { text, start, end: cursor };
      cursor += gaps[i] * squeeze;
      return phrase;
    });
  });

/** Spread a phrase's window over its words by length. */
const estimateWords = ({ start, end, text }: Phrase): Caption[] => {
  const parts = text.split(" ");
  const total = parts.reduce((sum, w) => sum + weight(w), 0);
  let cursor = start;
  return parts.map((word) => {
    const duration = ((end - start) * weight(word)) / total;
    const caption: Caption = {
      text: word,
      startMs: Math.round(cursor * 1000),
      endMs: Math.round((cursor + duration) * 1000),
      timestampMs: Math.round((cursor + duration / 2) * 1000),
      confidence: null,
    };
    cursor += duration;
    return caption;
  });
};

/** STYLE: a caption page holds this many words, on one line at the fixed caption size. */
export const PAGE_WORDS = { min: 2, max: 6 };

/**
 * A phrase's words as one page, or, when it has too many words or is too wide, as two pages of 2–6 words each, as even
 * as possible and preferably split after a comma; null when no such split fits.
 */
export const splitPage = <T extends { text: string }>(tokens: T[], fits: (text: string) => boolean): T[][] | null => {
  const join = (ts: T[]) => ts.map((x) => x.text).join(" ");
  if (tokens.length <= PAGE_WORDS.max && fits(join(tokens))) return [tokens];
  let best: { k: number; score: number } | null = null;
  for (let k = PAGE_WORDS.min; k <= tokens.length - PAGE_WORDS.min; k++) {
    const [a, b] = [tokens.slice(0, k), tokens.slice(k)];
    if (a.length > PAGE_WORDS.max || b.length > PAGE_WORDS.max || !fits(join(a)) || !fits(join(b))) continue;
    const pause = /[,;:]$/.test(a[a.length - 1].text) ? 8 : 0;
    const score = Math.abs(join(a).length - join(b).length) - pause;
    if (!best || score < best.score) best = { k, score };
  }
  return best ? [tokens.slice(0, best.k), tokens.slice(best.k)] : null;
};

/** Phrases that fit the caption line neither as one page nor as two pages of 2–6 words (splitPage). */
export const captionMisfits = (phrases: string[], fits: (text: string) => boolean) =>
  phrases.filter((p) => !splitPage(p.split(" ").map((text) => ({ text })), fits));

/**
 * Caption pages from the phrases, filled with the spoken word timings when there are any; a phrase too long for one
 * line becomes two pages (splitPage). `fits` says whether a text fits the caption line at the caption size.
 */
export const captionPages = (phrases: Phrase[], words: Caption[] | null, fits: (text: string) => boolean = () => true): CaptionPage[] => {
  let cursor = 0;
  return phrases.flatMap((phrase) => {
    const count = wordCount(phrase.text);
    const tokens = words ? words.slice(cursor, cursor + count) : estimateWords(phrase);
    cursor += count;
    return (splitPage(tokens, fits) ?? [tokens]).map((part) => ({ startMs: part[0].startMs, endMs: part[part.length - 1].endMs, tokens: part }));
  });
};

/** A timing file only fits the spec it was made from: same phrases, same word count. */
export const timingMatches = (timing: Timing, texts: string[]) =>
  timing.phrases.length === texts.length &&
  timing.phrases.every((p, i) => p.text === texts[i]) &&
  timing.words.length === texts.reduce((n, t) => n + wordCount(t), 0);
