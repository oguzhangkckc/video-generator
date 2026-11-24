// The project's one pronunciation dictionary: how abbreviations, units and symbols are read aloud.
// Captions show the written form; the TTS request and Whisper matching use the spoken form.
// Shared by the bundle and the Node scripts (type stripping), so it imports nothing.

export const LEXICON: Record<string, string> = {
  // Letters and abbreviations (Turkish letter names)
  P: "pe",
  Q: "kü",
  R: "re",
  S: "se",
  T: "te",
  PR: "pe re",
  QRS: "kü re se",
  SA: "se a",
  AV: "a ve",
  EKG: "e ka ge",
  GPS: "ce pe se",
  // Units. One-letter ones (V, A, s, m) are left out: as a word they are as likely a letter, so write them out.
  mV: "milivolt",
  kV: "kilovolt",
  mA: "miliamper",
  "µA": "mikroamper",
  sn: "saniye",
  ms: "milisaniye",
  "µs": "mikrosaniye",
  ns: "nanosaniye",
  km: "kilometre",
  "km/sa": "kilometre bölü saat",
  Hz: "hertz",
  // Symbols
  "≈": "yaklaşık",
  "~": "yaklaşık",
  "≤": "en fazla",
  "≥": "en az",
  "%": "yüzde",
};

/** Single capital letters that are Turkish words, not abbreviations. */
const WORD_LETTERS = new Set(["O"]);
const LEAD = /^[“"«‘'(\[]+/;
const TRAIL = /[.,:;!?…”"»’')\]]+$/;
const APOSTROPHE = /['’]/;

/** Dashes and ellipses standing alone are punctuation, not symbols to read. */
const PUNCTUATION = /^[\p{Pd}…·.,:;!?"“”«»'’()[\]]+$/u;

/** A written token split into its punctuation, its base and a Turkish suffix after an apostrophe ("QRS'in"). */
export const splitToken = (token: string) => {
  if (PUNCTUATION.test(token)) return { lead: token, base: "", suffix: "", trail: "" };
  const lead = token.match(LEAD)?.[0] ?? "";
  const rest = token.slice(lead.length);
  const trail = rest.match(TRAIL)?.[0] ?? "";
  const core = rest.slice(0, rest.length - trail.length);
  const cut = core.search(APOSTROPHE);
  const base = cut > 0 ? core.slice(0, cut) : core;
  const suffix = cut > 0 ? core.slice(cut) : "";
  return { lead, base, suffix, trail };
};

/** Looks like something a voice could misread: digits, an abbreviation, a single letter, a unit or a symbol. */
export const needsReading = (base: string) =>
  base.length > 0 &&
  (/\d/.test(base) ||
    /^[A-ZÇĞİÖŞÜ]{2,}$/.test(base) ||
    (/^[A-ZÇĞİÖŞÜ]$/.test(base) && !WORD_LETTERS.has(base)) ||
    /[a-zµ][A-Z]/.test(base) ||
    /[^\p{L}\p{N}-]/u.test(base) ||
    base in LEXICON);

/** The spoken words for one written token; the suffix keeps its apostrophe so the voice joins it. */
export const spokenToken = (token: string): string[] => {
  const { lead, base, suffix, trail } = splitToken(token);
  const reading = LEXICON[base];
  if (!reading) return [token];
  const words = reading.split(" ");
  words[0] = lead + words[0];
  words[words.length - 1] += suffix + trail;
  return words;
};

/** Per written word of a phrase, the spoken words it becomes. */
export const spokenWords = (phrase: string) => phrase.split(" ").map(spokenToken);

export const spoken = (text: string) => spokenWords(text).flat().join(" ");

/** Written tokens of a phrase that look like they need a reading but have none. */
export const unreadable = (phrase: string) =>
  phrase
    .split(" ")
    .map((token) => splitToken(token).base)
    .filter((base) => needsReading(base) && !(base in LEXICON));
