// A script draft from skill step c), before any spec exists: out/<slug>/metin/metin.json.
//   { slug, durationSec, sections: [{ id, window, phrases }], options: { kanca: [phrases…], final: [phrases…] }, claims }
// `sections` is the recommended text; each hook option replaces the first section's phrases, each final option the
// last one's. The promise→answer and the one-line takeaway stay out of the file so the editor reads it blind.
import { readFileSync } from "node:fs";

export const readDraft = (file) => {
  const draft = JSON.parse(readFileSync(file, "utf8"));
  const ok =
    typeof draft.slug === "string" &&
    Array.isArray(draft.sections) &&
    draft.sections.length >= 2 &&
    draft.sections.every((s) => typeof s.id === "string" && Array.isArray(s.phrases) && s.phrases.length && s.phrases.every((p) => typeof p === "string"));
  if (!ok) throw new Error(`${file}: expected { slug, sections: [{ id, window, phrases: [string…] }] } with at least two sections`);
  return draft;
};

/** The full text and one variant per hook and final option, each a list of sections. */
export const variantsOf = (draft) => {
  const { sections, options = {} } = draft;
  const swap = (index, phrases) => sections.map((s, i) => (i === index ? { ...s, phrases } : s));
  return [
    { name: "tam", sections },
    ...(options.kanca ?? []).map((phrases, i) => ({ name: `kanca-${i + 1}`, sections: swap(0, phrases) })),
    ...(options.final ?? []).map((phrases, i) => ({ name: `final-${i + 1}`, sections: swap(sections.length - 1, phrases) })),
  ];
};
