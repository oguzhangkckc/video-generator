// Caption fit for script drafts (skill step c): the browser measures, through the hidden "metin-olcu" composition,
// with the font, size, width and page split npm run check uses for a spec (src/spec/caption-fit.ts).
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, selectComposition } from "@remotion/renderer";
import { ROOT } from "./video.mjs";

const chromiumOptions = { gl: "angle" };

/** The phrases that fit the caption line neither as one page nor as two pages of 2–6 words. */
export const captionMisfits = async (phrases) => {
  if (!phrases.length) return [];
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts"), onProgress: () => {} });
  const browser = await openBrowser("chrome", { chromiumOptions });
  try {
    const composition = await selectComposition({
      serveUrl,
      id: "metin-olcu",
      inputProps: { phrases, misfits: [] },
      puppeteerInstance: browser,
      chromiumOptions,
      logLevel: "error",
    });
    return composition.props.misfits;
  } finally {
    await browser.close({ silent: true });
  }
};
