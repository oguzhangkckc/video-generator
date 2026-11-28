// Nouns with which the narration points at something drawn on screen ("bu çizgi", "kalbin yazdığı yazı", "haritada").
// Such a word names a scene element just as "kalp" does, so it should be tied to one (`say`): then qa checks that the
// element is on screen while the sentence says it. Shared by the bundle and the Node scripts, so it imports only pure
// modules.
import { mentions } from "./sentences.ts";

export const VISUAL_NOUNS = ["çizgi", "yazı", "tepe", "düzlük", "eğri", "grafik", "şema", "şerit", "harita"] as const;

/** Plural, possessive and case endings a noun takes; whole words only, so "yazıyor", "yazıcı" or "çizgili" do not count. */
const ENDING =
  /^(l[ae]r)?(s?[ıiuü]|l[ae]r[ıi])?n?(d[ae]|t[ae]|d[ae]n|t[ae]n|d[ae]ki|t[ae]ki|[ae]|y[ae]|y[ıiuü]|[ıiuü]|[ıiuü]n|n[ıiuü]n|y?l[ae])?$/u;
const SOFT: Record<string, string> = { k: "ğ", p: "b", ç: "c", t: "d" };

const norm = (w: string) => w.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]/gu, "");

/** Whether `word` is `noun` with an ending ("çizgiyi", "düzlüğü", "haritada"). */
export const isFormOf = (word: string, noun: string) => {
  const w = norm(word);
  const soft = SOFT[noun.at(-1)!] ? noun.slice(0, -1) + SOFT[noun.at(-1)!] : null;
  return [noun, soft].some((stem) => stem !== null && w.startsWith(stem) && ENDING.test(w.slice(stem.length)));
};

/** The visual nouns a phrase says. */
export const visualNounsIn = (text: string): string[] =>
  VISUAL_NOUNS.filter((noun) => text.split(/\s+/).some((w) => isFormOf(w, noun)));

type Said = { say?: readonly string[] };
type SceneLayer = Said & {
  type: string;
  regions?: Said[];
  paths?: Said[];
  nodes?: Said[];
  parts?: Said[];
  location?: Said;
  hero?: Said;
};

/** Every `say` alias of a spec's layers: the words the narration uses for its scene elements. */
export const sayAliases = (layers: readonly SceneLayer[]): string[] =>
  layers.flatMap((l) =>
    [l, ...(l.regions ?? []), ...(l.paths ?? []), ...(l.nodes ?? []), ...(l.parts ?? []), l.location ?? {}, l.hero ?? {}].flatMap((e) => e.say ?? []),
  );

/**
 * The visual nouns a phrase says that no scene element is tied to: an element is tied when one of its `say` aliases
 * contains the noun and the phrase says that alias.
 */
export const unboundVisualNouns = (text: string, aliases: readonly string[]): string[] =>
  visualNounsIn(text).filter((noun) => !aliases.some((a) => a.split(/\s+/).some((w) => isFormOf(w, noun)) && mentions(text, a)));
