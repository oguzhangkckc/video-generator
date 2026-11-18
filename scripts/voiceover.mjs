// ElevenLabs voice-over for one video. Needs ELEVENLABS_API_KEY in .env (git-ignored).
//   node scripts/voiceover.mjs voices                                  → Turkish-capable models + voices on the account
//   node scripts/voiceover.mjs sample <slug> <voiceId>... [--model id] → out/<slug>/voice-samples/<voiceId>.mp3 (first section)
//   node scripts/voiceover.mjs build <slug> <voiceId> [modelId]        → public/videos/<slug>/vo.wav + videos/<slug>/timing.json
// build: one request per voiceover section (with neighbouring text for continuous prosody), fitted into the section's
// window — first with the voice's own speed setting, then a uniform stretch only for what is left.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { API, apiKey } from "./elevenlabs.mjs";
import { parseArgs } from "./lib/args.mjs";
import { ROOT, ffmpeg, loadSpec, outDir, publicDir, requireSlug, videoDir } from "./lib/video.mjs";

const DEFAULT_MODEL = "eleven_multilingual_v2";
const LEAD = 0.2;
const TAIL = 0.15;
const MAX_TEMPO = 1.2;

const key = apiKey();

const api = async (method, route, body) => {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${route.split("?")[0]} → ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
};

const tts = (voiceId, modelId, text, previousText, nextText, speed = 1) =>
  api("POST", `/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    text,
    model_id: modelId,
    previous_text: previousText || undefined,
    next_text: nextText || undefined,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed },
    // multilingual_v2 rejects language_code; newer models use it to lock Turkish.
    ...(modelId === "eleven_multilingual_v2" ? {} : { language_code: "tr" }),
  });

const round2 = (x) => Math.round(x * 100) / 100;

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

const { positional, flags } = parseArgs(process.argv.slice(2), { model: "string" });
const [cmd, ...args] = positional;

if (cmd === "voices") {
  const models = await api("GET", "/models");
  console.log("Models with Turkish text-to-speech:");
  for (const m of models.filter((m) => m.can_do_text_to_speech && (m.languages ?? []).some((l) => l.language_id === "tr"))) {
    console.log(`  ${m.model_id.padEnd(28)} ${m.name}`);
  }
  const { voices } = await api("GET", "/voices");
  console.log("Voices on this account:");
  for (const v of voices) {
    const labels = Object.values(v.labels ?? {}).join(", ");
    console.log(`  ${v.voice_id}  ${v.name.padEnd(22)} [${v.category}] ${labels}`);
  }
} else if (cmd === "sample") {
  const slug = requireSlug(args.shift());
  const { spec } = loadSpec(slug);
  const modelId = flags.model ?? DEFAULT_MODEL;
  const dir = path.join(outDir(slug), "voice-samples");
  mkdirSync(dir, { recursive: true });
  for (const voiceId of args) {
    const res = await tts(voiceId, modelId, spec.voiceover.sections[0].phrases.join(" "));
    const file = path.join(dir, `${voiceId}.mp3`);
    writeFileSync(file, Buffer.from(res.audio_base64, "base64"));
    console.log(path.relative(ROOT, file));
  }
} else if (cmd === "build") {
  const slug = requireSlug(args[0]);
  const [, voiceId, modelId = DEFAULT_MODEL] = args;
  if (!voiceId) throw new Error("Usage: build <slug> <voiceId> [modelId]");
  const { spec } = loadSpec(slug);
  const sections = spec.voiceover.sections;
  const sectionText = sections.map((s) => s.phrases.join(" "));
  const tmp = path.join(outDir(slug), "vo-tmp");
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  mkdirSync(publicDir(slug), { recursive: true });

  const allWords = [];
  const placed = [];
  for (let k = 0; k < sections.length; k++) {
    const [s0, s1] = sections[k].window;
    const available = s1 - TAIL - (s0 + LEAD);
    const synth = async (speed) => {
      const res = await tts(voiceId, modelId, sectionText[k], sectionText[k - 1], sectionText[k + 1], speed);
      if (!res.alignment) throw new Error(`No alignment returned for section "${sections[k].id}"`);
      const words = toWords(res.alignment);
      const expected = sectionText[k].split(" ").length;
      if (words.length !== expected) throw new Error(`Section "${sections[k].id}": ${words.length} aligned words, expected ${expected}`);
      return { res, words, spoken: words[words.length - 1].end - words[0].start };
    };

    let take = await synth(1);
    let speed = 1;
    if (take.spoken / available > 1.03) {
      speed = Math.min(MAX_TEMPO, (take.spoken / available) * 1.02);
      take = await synth(speed);
    }
    const { res, words, spoken } = take;
    const raw = path.join(tmp, `section${k}.mp3`);
    writeFileSync(raw, Buffer.from(res.audio_base64, "base64"));

    const first = words[0].start;
    const tempo = Math.max(1, spoken / available);
    if (tempo > MAX_TEMPO) console.warn(`section "${sections[k].id}": speeding up ×${tempo.toFixed(2)} (over ${MAX_TEMPO}) — shorten the text or widen its window`);

    const preRoll = Math.min(0.05, first);
    const at = (t) => s0 + LEAD + (t - first) / tempo;
    const fitted = path.join(tmp, `section${k}.wav`);
    ffmpeg("-i", raw, "-af", `atrim=start=${(first - preRoll).toFixed(3)},asetpts=PTS-STARTPTS,atempo=${tempo.toFixed(3)},aresample=48000`, fitted);
    placed.push({ file: fitted, delayMs: Math.round((s0 + LEAD - preRoll / tempo) * 1000) });

    for (const w of words) allWords.push({ text: w.text, start: at(w.start), end: at(w.end) });
    console.log(
      `section "${sections[k].id}": ${words.length} words, ${spoken.toFixed(2)}s spoken in ${available.toFixed(2)}s window, voice speed ×${speed.toFixed(2)}, stretch ×${tempo.toFixed(2)}`,
    );
  }

  const graph = [
    ...placed.map((p, i) => `[${i}:a]adelay=${p.delayMs}:all=1[s${i}]`),
    `${placed.map((_, i) => `[s${i}]`).join("")}amix=inputs=${placed.length}:normalize=0,` +
      `apad=whole_dur=${spec.durationSec},atrim=0:${spec.durationSec},aformat=channel_layouts=stereo,` +
      `loudnorm=I=-14:TP=-1.5:LRA=7,aresample=48000[vo]`,
  ].join(";");
  const voOut = path.join(publicDir(slug), "vo.wav");
  ffmpeg(...placed.flatMap((p) => ["-i", p.file]), "-filter_complex", graph, "-map", "[vo]", "-c:a", "pcm_s16le", voOut);

  const words = allWords.map((w) => ({
    text: w.text,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: null,
  }));
  let cursor = 0;
  const phrases = sections.flatMap((s) => s.phrases).map((text) => {
    const n = text.split(" ").length;
    const span = allWords.slice(cursor, cursor + n);
    cursor += n;
    return { text, start: round2(span[0].start), end: round2(span[span.length - 1].end) };
  });
  const timing = {
    source: `elevenlabs:${voiceId}/${modelId}`,
    audio: `videos/${slug}/vo.wav`,
    phrases,
    words,
  };
  const timingFile = path.join(videoDir(slug), "timing.json");
  writeFileSync(timingFile, `${JSON.stringify(timing, null, 2)}\n`);

  rmSync(tmp, { recursive: true, force: true });
  console.log(path.relative(ROOT, voOut));
  console.log(path.relative(ROOT, timingFile));
} else {
  console.error(
    "Usage: node scripts/voiceover.mjs voices | sample <slug> <voiceId>... [--model id] | build <slug> <voiceId> [modelId]",
  );
  process.exit(1);
}
