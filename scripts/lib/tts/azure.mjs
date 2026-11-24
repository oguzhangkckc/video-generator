// Azure Speech (Turkish neural voices, e.g. tr-TR-EmelNeural) through SSML: pauses between phrases are <break>s of
// the STYLE lengths and the section's `stress` words are <emphasis>; word times come from the SDK's word boundaries.
// Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the environment or .env.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "../video.mjs";

const env = (name) => {
  if (process.env[name]) return process.env[name].trim();
  const file = path.join(ROOT, ".env");
  const line = existsSync(file) ? readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(`${name}=`)) : undefined;
  const value = line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  if (!value) throw new Error(`${name} is empty — put it in .env (Azure portal → Speech service → Keys and Endpoint)`);
  return value;
};

const xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pattern = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One sentence as SSML: its phrases with a <break> of `pauses[i]` s after each but the last, stressed words marked. */
export const ssmlFor = ({ phrases, pauses, voice, speed = 1, stress = [] }) => {
  const mark = (text) =>
    stress.reduce(
      (out, w) => out.replace(new RegExp(`(^|\\s)(${pattern(xml(w))})(?=[\\s,.;:!?…]|$)`, "giu"), `$1<emphasis level="strong">$2</emphasis>`),
      xml(text),
    );
  const body = phrases.map((p, i) => mark(p) + (i < phrases.length - 1 ? `<break time="${Math.round(pauses[i] * 1000)}ms"/>` : "")).join(" ");
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="tr-TR"><voice name="${voice}"><prosody rate="${speed}">${body}</prosody></voice></speak>`;
};

/** Word boundary events (offsets and durations in 100 ns ticks) as words in seconds; punctuation is skipped. */
export const wordsFromBoundaries = (events) =>
  events
    .filter((e) => /word/i.test(String(e.boundaryType ?? "WordBoundary")))
    .map((e) => ({ text: e.text, start: e.audioOffset / 1e7, end: (e.audioOffset + e.duration) / 1e7 }));

const sdk = async () => {
  try {
    return await import("microsoft-cognitiveservices-speech-sdk");
  } catch {
    throw new Error("Azure Speech SDK is missing: npm install microsoft-cognitiveservices-speech-sdk");
  }
};

export const azure = {
  id: "azure",
  placeholder: false,
  ext: "wav",
  defaults: { voice: "tr-TR-EmelNeural" },
  key: (r) => ({ voice: r.voice, ssml: ssmlFor(r) }),
  /** Azure bills the spoken text, not the SSML tags. */
  cost: (r) => r.text.length,
  synthesize: async (r) => {
    const speech = await sdk();
    const config = speech.SpeechConfig.fromSubscription(env("AZURE_SPEECH_KEY"), env("AZURE_SPEECH_REGION"));
    config.speechSynthesisOutputFormat = speech.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm;
    const synth = new speech.SpeechSynthesizer(config, null);
    const events = [];
    synth.wordBoundary = (_, e) => events.push({ text: e.text, audioOffset: e.audioOffset, duration: e.duration, boundaryType: e.boundaryType });
    try {
      const result = await new Promise((ok, fail) => synth.speakSsmlAsync(ssmlFor(r), ok, fail));
      if (result.reason !== speech.ResultReason.SynthesizingAudioCompleted) throw new Error(`Azure: ${result.errorDetails ?? result.reason}`);
      return { audio: Buffer.from(result.audioData), words: wordsFromBoundaries(events) };
    } finally {
      synth.close();
    }
  },
};
