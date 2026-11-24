// Voice-over providers for scripts/voiceover.mjs. Each one turns a request
//   { text, phrases, pauses, previous, next, seed, speed, voice, model, stress }   (spoken form)
// into { audio, words: [{ text, start, end }] } and says what its sound depends on (key) and what it bills (cost).
// A human recording is not a provider: record it and run npm run align.
import { azure } from "./azure.mjs";
import { elevenlabs } from "./elevenlabs.mjs";
import { say } from "./say.mjs";

export const PROVIDERS = { elevenlabs, azure, say };

export const providerOf = (id) => {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`unknown voice-over provider "${id}" (${Object.keys(PROVIDERS).join(", ")})`);
  return p;
};
