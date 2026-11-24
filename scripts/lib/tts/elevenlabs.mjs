// ElevenLabs text-to-speech with character timestamps. Billed per character of `text` (the context fields are free).
import { API, apiKey } from "../../elevenlabs.mjs";

export const DEFAULT_MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true };

let key;
export const api = async (method, route, body) => {
  key ??= apiKey();
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${route.split("?")[0]} → ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
};

const toWords = ({ characters, character_start_times_seconds: starts, character_end_times_seconds: ends }) => {
  const words = [];
  let current = null;
  characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (current) words.push(current);
      current = null;
      return;
    }
    current ??= { text: "", start: starts[i], end: ends[i] };
    current.text += ch;
    current.end = ends[i];
  });
  if (current) words.push(current);
  return words;
};

export const elevenlabs = {
  id: "elevenlabs",
  placeholder: false,
  ext: "mp3",
  defaults: { model: DEFAULT_MODEL },
  /** Everything the sound depends on but the context, so editing one sentence does not re-bill its neighbours. */
  key: (r) => ({ voice: r.voice, model: r.model, text: r.text, seed: r.seed, speed: r.speed, settings: SETTINGS }),
  cost: (r) => r.text.length,
  synthesize: async (r) => {
    const res = await api("POST", `/text-to-speech/${r.voice}/with-timestamps?output_format=mp3_44100_128`, {
      text: r.text,
      model_id: r.model,
      previous_text: r.previous || undefined,
      next_text: r.next || undefined,
      seed: r.seed,
      voice_settings: { ...SETTINGS, speed: r.speed },
      // multilingual_v2 rejects language_code; newer models use it to lock Turkish.
      ...(r.model === DEFAULT_MODEL ? {} : { language_code: "tr" }),
    });
    if (!res.audio_base64 || !res.alignment) throw new Error(`No audio or alignment returned for "${r.text}"`);
    return { audio: Buffer.from(res.audio_base64, "base64"), words: toWords(res.alignment) };
  },
  /** Characters left on the account this month. */
  remaining: async () => {
    const s = await api("GET", "/user/subscription");
    return s.character_limit - s.character_count;
  },
};
