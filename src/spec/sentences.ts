// Sentences of a script: the unit of intonation, which may span several caption phrases.
// Shared by the bundle and the Node scripts (type stripping), so it imports only pure modules.
import { endsSentence } from "./pauses.ts";

/** Turkish question words; a question built on one should fall at the end, like a statement. */
const QUESTION_WORDS = /^(ne|neyi|neye|neden|nede|niye|niçin|nasıl|nere\p{L}*|kim\p{L}*|hangi\p{L}*|kaç\p{L}*)$/u;
const YES_NO = /^(mi|mı|mu|mü)(\p{L}*)$/u;

const norm = (w: string) => w.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]/gu, "");

export type SentenceKind = "statement" | "wh-question" | "yes-no" | "fragment";

/** Statements and question-word questions should fall at the end; yes/no questions and fragments may rise. */
export const sentenceKind = (text: string): SentenceKind => {
  const t = text.trim();
  if (!endsSentence(t)) return "fragment";
  if (!/\?["”»']?$/.test(t)) return "statement";
  const words = t.split(/\s+/).map(norm);
  if (words.some((w) => YES_NO.test(w))) return "yes-no";
  return words.some((w) => QUESTION_WORDS.test(w)) ? "wh-question" : "yes-no";
};

/** A question whose last word is the question word ("…tepe ne?") puts the stress on the wrong word. */
export const endsOnQuestionWord = (text: string) => {
  const t = text.trim();
  if (!/\?["”»']?$/.test(t)) return false;
  const words = t.split(/\s+/).map(norm).filter(Boolean);
  return words.length > 1 && QUESTION_WORDS.test(words[words.length - 1]);
};

const SOFT: Record<string, string> = { p: "b", ç: "c", t: "d", k: "ğ" };
/** A word with a suffix, allowing the final consonant to soften before it ("kalp" → "kalbin", "ağaç" → "ağacı"). */
const startsWord = (word: string, stem: string) =>
  word.startsWith(stem) || (stem.length > 2 && SOFT[stem.at(-1)!] !== undefined && word.startsWith(stem.slice(0, -1) + SOFT[stem.at(-1)!]));

/** Whether `text` says `alias`: its words in order, each allowed a suffix ("sağ üst köşe" in "sağ üst köşesinden"). */
export const mentions = (text: string, alias: string) => {
  const words = text.split(/\s+/).map(norm).filter(Boolean);
  const want = alias.split(/\s+/).map(norm).filter(Boolean);
  if (!want.length) return false;
  return words.some((_, i) => want.every((w, j) => words[i + j] !== undefined && startsWord(words[i + j], w)));
};

export type Sentence = { text: string; first: number; last: number; kind: SentenceKind };

/** Consecutive phrases joined into sentences; a section's last phrase always closes one. */
export const sentencesOf = (sections: { phrases: string[] }[]): Sentence[] => {
  const out: Sentence[] = [];
  let offset = 0;
  for (const { phrases } of sections) {
    let from = 0;
    phrases.forEach((phrase, i) => {
      if (!endsSentence(phrase) && i < phrases.length - 1) return;
      const text = phrases.slice(from, i + 1).join(" ");
      out.push({ text, first: offset + from, last: offset + i, kind: endsSentence(phrase) ? sentenceKind(text) : "fragment" });
      from = i + 1;
    });
    offset += phrases.length;
  }
  return out;
};
