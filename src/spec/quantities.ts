// Physical quantities named by the voice-over and shown by labels, so the two never mix (voltage vs current…).
// Shared by the bundle and the Node scripts (type stripping), so it imports nothing.

export const QUANTITIES = {
  gerilim: { words: ["gerilim", "voltaj", "volt", "milivolt", "kilovolt"], units: ["kV", "mV", "V"] },
  akım: { words: ["akım", "amper", "miliamper", "mikroamper"], units: ["mA", "µA", "A"] },
  süre: { words: ["süre", "saniye", "milisaniye", "mikrosaniye", "nanosaniye", "dakika"], units: ["ms", "µs", "ns", "sn", "s", "dk"] },
  hız: { words: ["hız", "sürat", "saatte"], units: ["km/sa", "km/h", "km/s", "m/s"] },
  uzaklık: { words: ["uzaklık", "mesafe", "metre", "kilometre", "santimetre", "milimetre"], units: ["km", "cm", "mm", "m"] },
  sıklık: { words: ["kez", "frekans", "sıklık", "hertz"], units: ["GHz", "MHz", "kHz", "Hz"] },
} as const;

export type Quantity = keyof typeof QUANTITIES;
const NAMES = Object.keys(QUANTITIES) as Quantity[];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
// Longest unit first, so "km/sa" wins over "km" and "mV" over "V".
const UNIT_TABLE = NAMES.flatMap((q) => QUANTITIES[q].units.map((unit) => ({ unit, q }))).sort((a, b) => b.unit.length - a.unit.length);
// Labels are often set in capitals ("0,1 SN"), so units match regardless of case.
const UNIT_RE = new RegExp(`\\d\\s*(${UNIT_TABLE.map((u) => escape(u.unit)).join("|")})(?![\\p{L}/])`, "iu");

/** The quantity of a label that shows a number with a unit ("≈ 1 mV" → gerilim); null without one. */
export const labelQuantity = (text: string): Quantity | null => {
  const unit = text.match(UNIT_RE)?.[1]?.toLowerCase();
  return unit ? UNIT_TABLE.find((u) => u.unit.toLowerCase() === unit)!.q : null;
};

const norm = (w: string) => w.toLocaleLowerCase("tr").replace(/[^\p{L}]/gu, "");

/** Quantities a phrase names by word, suffixes allowed ("akımı", "milisaniyede"). */
export const namedQuantities = (text: string): Set<Quantity> => {
  const words = text.split(/\s+/).map(norm);
  return new Set(NAMES.filter((q) => QUANTITIES[q].words.some((stem) => words.some((w) => w.startsWith(stem)))));
};

type Timed = { text: string; start: number; end: number };

/** Labels whose unit is a different quantity from every one the phrase being spoken as they appear names. */
export const quantityMismatches = (labels: { text: string; at: number }[], phrases: Timed[]) =>
  labels.flatMap((label) => {
    const q = labelQuantity(label.text);
    if (!q) return [];
    const phrase = [...phrases].reverse().find((p) => p.start <= label.at + 0.05) ?? phrases[0];
    if (!phrase) return [];
    const named = namedQuantities(phrase.text);
    return named.size && !named.has(q) ? [{ label: label.text, at: label.at, phrase: phrase.text, label_q: q, named: [...named] }] : [];
  });
