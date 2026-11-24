import assert from "node:assert/strict";
import { test } from "node:test";
import { ssmlFor, wordsFromBoundaries } from "../lib/tts/azure.mjs";
import { elevenlabs } from "../lib/tts/elevenlabs.mjs";
import { spreadWords } from "../lib/tts/say.mjs";
import { cacheKey, overspend } from "../lib/tts/spend.mjs";

const request = (over = {}) => ({ text: "Kalbin sağ üst köşesi.", voice: "v", model: "m", seed: 7, speed: 1, previous: "Önce.", next: "Sonra.", ...over });

test("a take's cache key ignores the context, so editing a neighbour does not re-bill it", () => {
  assert.equal(cacheKey(elevenlabs, request()), cacheKey(elevenlabs, request({ previous: "Başka bir cümle.", next: "" })));
  assert.notEqual(cacheKey(elevenlabs, request()), cacheKey(elevenlabs, request({ text: "Kalbin sol üst köşesi." })));
  assert.notEqual(cacheKey(elevenlabs, request()), cacheKey(elevenlabs, request({ seed: 8 })));
});

test("spending stops at what the account has, then at the video's budget", () => {
  assert.equal(overspend({ chars: 900, remaining: 1000, spent: 0, budget: 2000 }), null);
  assert.match(overspend({ chars: 900, remaining: 500, spent: 0, budget: 2000 }), /hesapta 500/);
  assert.match(overspend({ chars: 900, remaining: 5000, spent: 1500, budget: 2000 }), /bütçe aşılıyor.*2400/);
  assert.equal(overspend({ chars: 900, remaining: undefined, spent: 1500, budget: undefined }), null, "no budget, no limit");
});

test("azure: phrases get STYLE breaks between them and stressed words get emphasis", () => {
  const ssml = ssmlFor({ phrases: ["Kalbin elektriği cildine ulaşıyor,", "gerilimi çok küçük."], pauses: [0.2, 0.4], voice: "tr-TR-EmelNeural", speed: 1, stress: ["küçük"] });
  assert.match(ssml, /<voice name="tr-TR-EmelNeural">/);
  assert.match(ssml, /ulaşıyor,<break time="200ms"\/> gerilimi/);
  assert.match(ssml, /çok <emphasis level="strong">küçük<\/emphasis>\./);
  assert.doesNotMatch(ssml, /400ms/, "no break after the last phrase");
  const words = wordsFromBoundaries([
    { text: "Kalbin", audioOffset: 1_000_000, duration: 4_000_000, boundaryType: "WordBoundary" },
    { text: ",", audioOffset: 5_000_000, duration: 0, boundaryType: "PunctuationBoundary" },
    { text: "sağ", audioOffset: 7_000_000, duration: 2_000_000, boundaryType: "WordBoundary" },
  ]);
  assert.deepEqual(words, [
    { text: "Kalbin", start: 0.1, end: 0.5 },
    { text: "sağ", start: 0.7, end: 0.9 },
  ]);
});

test("say: the placeholder's word times cover the take in order, longer words longer", () => {
  const words = spreadWords("Bu çizgiyi mutlaka görmüşsündür.", 2);
  assert.equal(words.length, 4);
  assert.equal(words[0].start, 0);
  assert.ok(Math.abs(words.at(-1).end - 2) < 1e-9);
  assert.ok(words[3].end - words[3].start > words[0].end - words[0].start);
});
