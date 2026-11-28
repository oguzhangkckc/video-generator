// Whether a phrase fits the caption line (STYLE "Yerleşim": one size, never shrunk; two pages at most). Bundle only:
// it measures with the browser's canvas, so npm run text asks a hidden composition (Root.tsx, "metin-olcu").
import { textWidth } from "../kit/overlays/geometry";
import { captionsSchema, layoutSchema } from "../kit/overlays/schema";
import { SANS } from "../kit/theme";
import { captionMisfits } from "./timing";

export const CAPTION_DEFAULTS = { size: captionsSchema.parse({}).size, width: layoutSchema.parse({}).contentWidth };

export const captionFits = (size: number, width: number) => (text: string) => textWidth(text, SANS, size, 800) <= width;

/**
 * Inter (with the Turkish letters of latin-ext) loaded, so a measure taken before the first frame is not one of the
 * fallback font.
 */
export const captionFontReady = async () => {
  await document.fonts.load(`800 60px "${SANS}"`, "AaİıŞşĞğÜüÖöÇç");
};

/** Draft phrases (skill step c) that fit neither as one page nor as two, at the default caption size and width. */
export const draftCaptionMisfits = async (phrases: string[]) => {
  await captionFontReady();
  return captionMisfits(phrases, captionFits(CAPTION_DEFAULTS.size, CAPTION_DEFAULTS.width));
};
