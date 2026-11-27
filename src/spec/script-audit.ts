// STYLE "Anlatım" rules a script can be checked against without timing: npm run check, npm run text and the
// resolver share it, so a draft (out/<slug>/metin/metin.json) is held to the same rules as a spec.
// Shared by the bundle and the Node scripts (type stripping), so it imports only pure modules.
import { avoidedIn } from "./avoid.ts";
import { needsReading, splitToken, unreadable } from "./lexicon.ts";
import { endsOnQuestionWord, sentencesOf } from "./sentences.ts";

/** Rules a spec may knowingly break, named in `styleExceptions` as `{ rule, why }`; "etiket-sozu" is checked by resolve.ts. */
export const WAIVABLE = ["peki-siniri", "acik-final", "etiket-sozu"] as const;
export type WaivableRule = (typeof WAIVABLE)[number];

export const PEKI_LIMIT = 2;

export type Finding = {
  level: "error" | "warning";
  rule: string;
  text: string;
  message: string;
  waived?: boolean;
};

type Section = { id?: string; phrases: string[] };

const PEKI = /^peki\b/i;
const isQuestion = (text: string) => /\?["”»']?$/.test(text.trim());

export const auditScript = (sections: Section[], { template = false, waived = [] as readonly string[] } = {}): Finding[] => {
  const out: Finding[] = [];
  const error = (rule: string, text: string, message: string) => out.push({ level: "error", rule, text, message, ...(waived.includes(rule) ? { waived: true } : {}) });
  const phrases = sections.flatMap((s) => s.phrases);

  phrases.forEach((p, i) => {
    if (i > 0 && PEKI.test(phrases[i - 1]) && PEKI.test(p)) {
      error("peki-art-arda", p, `"${phrases[i - 1]}" / "${p}": two "Peki…?" questions in a row`);
    }
    const missing = template ? [] : unreadable(p);
    if (missing.length) {
      error("okunus", p, `"${p}": no reading for ${missing.map((m) => `"${m}"`).join(", ")} — add it to src/spec/lexicon.ts or write it out`);
    }
  });
  if (template) return out;

  const sentences = sentencesOf(sections);
  for (const s of sentences) {
    if (s.kind === "fragment") continue;
    const tokens = s.text.trim().split(/\s+/);
    const last = splitToken(tokens[tokens.length - 1]).base;
    if (needsReading(last)) {
      error("kisaltma-sonu", s.text, `"${s.text}" ends on "${last}"; end a sentence on a word ("…dalgası: T." → "Sonra T dalgası geliyor: toparlanma.")`);
    }
    if (endsOnQuestionWord(s.text)) {
      error("soru-kelimesi-sonu", s.text, `"${s.text}" ends on its question word, which then takes the stress ("Peki o sivri tepe ne?" → "Peki ya o sivri tepe?")`);
    }
  }

  const openers = sections.filter((s) => {
    const first = sentencesOf([s])[0];
    return first && PEKI.test(first.text) && isQuestion(first.text);
  });
  if (openers.length > PEKI_LIMIT) {
    error(
      "peki-siniri",
      openers.map((s) => s.phrases[0]).join(" / "),
      `${openers.length} sections open with "Peki…?" (${openers.map((s) => s.id ?? "?").join(", ")}); at most ${PEKI_LIMIT} — open the others with a plain claim, a surprising number or an "Ama…" twist`,
    );
  }

  const end = sentences.at(-1);
  if (end && end.kind !== "fragment" && isQuestion(end.text)) {
    error("acik-final", end.text, `the video ends on a question ("${end.text}"); the final answers the hook's question instead of opening a new one`);
  }

  for (const p of phrases) {
    for (const a of avoidedIn(p)) {
      out.push({ level: "warning", rule: "kacinilacak", text: p, message: `"${p}": "${a.match}…" — ${a.why}; instead: ${a.instead}` });
    }
  }
  return out;
};

/** Rule ids a spec waives through `styleExceptions: [{ rule, why }]`. */
export const waivedRules = (exceptions: readonly (string | { rule: string })[]) =>
  exceptions.flatMap((e) => (typeof e === "string" ? [] : [e.rule]));
