// STYLE "Anlatım" rules a script can be checked against without timing: npm run check, npm run text and the
// resolver share it, so a draft (out/<slug>/metin/metin.json) is held to the same rules as a spec.
// Shared by the bundle and the Node scripts (type stripping), so it imports only pure modules.
import { avoidedIn } from "./avoid.ts";
import { AFTER, BEFORE, unspokenLabels } from "./label-speech.ts";
import { needsReading, splitToken, unreadable } from "./lexicon.ts";
import { quantityMismatches } from "./quantities.ts";
import { endsOnQuestionWord, sentencesOf } from "./sentences.ts";
import { estimatePhrases } from "./timing.ts";
import { unboundVisualNouns } from "./visual-words.ts";

/** Rules a spec may knowingly break, named in `styleExceptions` as `{ rule, why }`; "etiket-sozu" is checked by resolve.ts. */
export const WAIVABLE = ["peki-siniri", "acik-final", "etiket-sozu", "gorsel-soz"] as const;
export type WaivableRule = (typeof WAIVABLE)[number];

export const PEKI_LIMIT = 2;

export type Finding = {
  level: "error" | "warning";
  rule: string;
  text: string;
  message: string;
  waived?: boolean;
};

type Section = { id?: string; window?: [number, number]; phrases: string[] };

/** A data line planned in a draft (skill step c): its text, and the phrase it appears with (+ offset, default 0.3 s). */
export type PlannedLabel = { text: string; cue: string; offset?: number };

const PEKI = /^peki\b/i;
const isQuestion = (text: string) => /\?["”»']?$/.test(text.trim());

/**
 * A draft's planned data lines against its words, on the draft timing estimate: each one says what is said around it
 * (as resolve.ts does for a spec) and names the quantity the voice-over names (as qa does after the render).
 */
const auditPlannedLabels = (sections: Section[], labels: PlannedLabel[], out: Finding[]) => {
  const error = (rule: string, text: string, message: string) => out.push({ level: "error", rule, text, message });
  if (!sections.every((s) => s.window)) {
    error("etiket-plani", "", "planned labels need every section's window (the draft timing estimate)");
    return;
  }
  const phrases = estimatePhrases(sections.map((s) => ({ id: s.id ?? "", window: s.window!, phrases: s.phrases })));
  const placed = labels.flatMap((l) => {
    const phrase = phrases.find((p) => p.text.startsWith(l.cue));
    if (!phrase) {
      error("etiket-plani", l.text, `"${l.text}": no phrase starts with "${l.cue}"`);
      return [];
    }
    return [{ text: l.text, at: phrase.start + (l.offset ?? 0.3) }];
  });
  for (const u of unspokenLabels(placed, phrases)) {
    const why = [u.missing.length ? `not said: ${u.missing.join(", ")}` : "", u.number ? "shows a number while none is said" : ""].filter(Boolean);
    error("etiket-sozu", u.text, `"${u.text}": ${why.join("; ")} (−${BEFORE}…+${AFTER} s) — say it, reword the label, or drop it`);
  }
  for (const m of quantityMismatches(placed, phrases)) {
    out.push({
      level: "warning",
      rule: "nicelik",
      text: m.label,
      message: `"${m.label}" shows ${m.label_q} while "${m.phrase}" names ${m.named.join(", ")} — the voice-over and the label name the same quantity`,
    });
  }
};

export const auditScript = (
  sections: Section[],
  {
    template = false,
    waived = [] as readonly string[],
    labels = [] as PlannedLabel[],
    say = undefined as readonly string[] | undefined,
  }: { template?: boolean; waived?: readonly string[]; labels?: PlannedLabel[]; say?: readonly string[] } = {},
): Finding[] => {
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
  // A draft has no scenes yet; a spec passes every `say` alias of its layers.
  if (say) {
    for (const p of phrases) {
      for (const noun of unboundVisualNouns(p, say)) {
        out.push({
          level: "warning",
          rule: "gorsel-soz",
          text: p,
          message: `"${p}": "${noun}" points at something on screen, but no scene element has it in \`say\` — tie it to the element so qa checks it is on screen`,
          ...(waived.includes("gorsel-soz") ? { waived: true } : {}),
        });
      }
    }
  }
  if (labels.length) auditPlannedLabels(sections, labels, out);
  return out;
};

/** Rule ids a spec waives through `styleExceptions: [{ rule, why }]`. */
export const waivedRules = (exceptions: readonly (string | { rule: string })[]) =>
  exceptions.flatMap((e) => (typeof e === "string" ? [] : [e.rule]));
