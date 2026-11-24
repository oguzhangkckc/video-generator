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

/** One caption page per phrase, filled with the spoken word timings when there are any. */
export const captionPages = (phrases: Phrase[], words: Caption[] | null): CaptionPage[] => {
  let cursor = 0;
  return phrases.map((phrase) => {
    const count = wordCount(phrase.text);
    const tokens = words ? words.slice(cursor, cursor + count) : estimateWords(phrase);
    cursor += count;
    return { startMs: tokens[0].startMs, endMs: tokens[tokens.length - 1].endMs, tokens };
  });
};

/** A timing file only fits the spec it was made from: same phrases, same word count. */
export const timingMatches = (timing: Timing, texts: string[]) =>
  timing.phrases.length === texts.length &&
  timing.phrases.every((p, i) => p.text === texts[i]) &&
  timing.words.length === texts.reduce((n, t) => n + wordCount(t), 0);
