// macOS `say` (Yelda, Turkish) as a free placeholder voice: good enough to time sections and test captions, never
// for a final render or an intonation check. Word times are spread over the sentence by length.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { duration } from "../video.mjs";

/**
 * Words per minute at speed 1. Yelda's rate moves in steps: on a 93-word explainer qa measured 2.74 spoken words a
 * second at 270 (STYLE 2.8), 2.89 at 280–290 and 1.92 at the old 170.
 */
const RATE = 270;
/** The rate is in the cache key: a recalibrated RATE must not reuse takes read at the old speed. */
const wpmOf = (speed) => Math.round(RATE * speed);

const weight = (word) => word.replace(/[^\p{L}\p{N}]/gu, "").length + 1;

/** Spread `seconds` over the words of `text` by length (the same split as the spoken form, so counts match). */
export const spreadWords = (text, seconds) => {
  const parts = text.split(/\s+/).filter(Boolean);
  const total = parts.reduce((n, w) => n + weight(w), 0);
  let at = 0;
  return parts.map((w) => {
    const d = (seconds * weight(w)) / total;
    const word = { text: w, start: at, end: at + d };
    at += d;
    return word;
  });
};

export const say = {
  id: "say",
  placeholder: true,
  ext: "aiff",
  defaults: { voice: "Yelda" },
  key: (r) => ({ voice: r.voice, text: r.text, wpm: wpmOf(r.speed) }),
  cost: () => 0,
  synthesize: async (r) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "say-"));
    try {
      const file = path.join(dir, "take.aiff");
      const run = spawnSync("say", ["-v", r.voice, "-r", String(wpmOf(r.speed)), "-o", file, r.text], { encoding: "utf8" });
      if (run.status !== 0) throw new Error(`say -v ${r.voice} failed: ${run.stderr || run.error}`);
      return { audio: readFileSync(file), words: spreadWords(r.text, duration(file)) };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
};
