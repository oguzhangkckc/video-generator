// STYLE "Ritim": a label is tied to the word it is said with. A label whose term or number the voice-over does not
// say around it (a line left over after its sentence was cut, a technical name the script replaced) is an error.
// Shared by the bundle and the Node scripts (type stripping), so it imports only pure modules.
import { LEXICON } from "./lexicon.ts";
import { QUANTITIES } from "./quantities.ts";

/** Speech this long before and after a label's appearance counts as said with it. */
export const BEFORE = 1;
export const AFTER = 1.5;

const UNITS = new Set(
  [...Object.values(QUANTITIES).flatMap((q) => [...q.units]), ...Object.keys(LEXICON).filter((k) => /[a-zµ]/.test(k))].map((u) =>
    u.toLocaleLowerCase("tr"),
  ),
);
const STOP = new Set(["ve", "ile", "bu", "şu", "da", "de", "en", "çok", "gibi", "mi"]);
const NUMBER_WORDS =
  /^(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz|bin|milyon|milyar|yarım|çeyrek|onda|yüzde|binde|milyonda)/u;

const norm = (w: string) => w.toLocaleLowerCase("tr").split(/['’]/)[0].replace(/[^\p{L}\p{N}]/gu, "");
const wordsOf = (text: string) => text.split(/[^\p{L}\p{N}'’]+/u).map(norm).filter(Boolean);

/** A label term said in a suffixed or narrowed form: "bekleme" ~ "bekliyor", "sağın" ~ "sağ"; short terms exactly. */
export const sameWord = (term: string, said: string) => {
  if (term.length <= 2 || said.length <= 2) return term === said;
  let n = 0;
  while (n < term.length && n < said.length && term[n] === said[n]) n++;
  return n >= 4 || n === Math.min(term.length, said.length);
};

const contentTerms = (label: string) =>
  wordsOf(label).filter((w) => !/\d/.test(w) && w.length >= 2 && !STOP.has(w) && !UNITS.has(w));

const saysNumber = (words: string[]) => words.some((w) => /\d/.test(w) || NUMBER_WORDS.test(w));

type Timed = { text: string; start: number; end: number };
export type Unspoken = { text: string; at: number; missing: string[]; number: boolean };

/** Labels whose terms are mostly unsaid, or that show a number while no number is said, around `at`. */
export const unspokenLabels = (labels: { text: string; at: number }[], phrases: Timed[]): Unspoken[] =>
  labels.flatMap((label) => {
    const heard = phrases.filter((p) => p.end >= label.at - BEFORE && p.start <= label.at + AFTER).flatMap((p) => wordsOf(p.text));
    const terms = contentTerms(label.text);
    const missing = terms.filter((t) => !heard.some((w) => sameWord(t, w)));
    const numberUnsaid = /\d/.test(label.text) && !saysNumber(heard);
    const termsUnsaid = terms.length > 0 && missing.length * 2 > terms.length;
    return termsUnsaid || numberUnsaid ? [{ text: label.text, at: label.at, missing: termsUnsaid ? missing : [], number: numberUnsaid }] : [];
  });
