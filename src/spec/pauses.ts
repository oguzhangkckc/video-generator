// Shared by the bundle and the Node scripts (type stripping), so it imports nothing.

/** STYLE.md breathing room after a phrase, in seconds. */
export const PAUSE = { section: 0.7, question: 0.6, sentence: 0.4, comma: 0.2, none: 0.1 } as const;

const CLOSE = `["”»']?`;

/** Ends a sentence (., !, ?, …), as opposed to a comma or a phrase that runs on. */
export const endsSentence = (text: string) => new RegExp(`[.!?…]${CLOSE}$`).test(text.trim());

/** Pause after a phrase: section change, a question, sentence end, comma/colon, or none. */
export const pauseAfter = (text: string, { sectionEnd = false }: { sectionEnd?: boolean } = {}): number => {
  if (sectionEnd) return PAUSE.section;
  const t = text.trim();
  if (new RegExp(`\\?${CLOSE}$`).test(t)) return PAUSE.question;
  if (endsSentence(t)) return PAUSE.sentence;
  if (new RegExp(`[,:;]${CLOSE}$`).test(t)) return PAUSE.comma;
  return PAUSE.none;
};
