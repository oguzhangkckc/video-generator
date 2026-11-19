// ElevenLabs voice-over for one video. Needs ELEVENLABS_API_KEY in .env (git-ignored).
//   node scripts/voiceover.mjs voices                                  → Turkish-capable models + voices on the account
//   node scripts/voiceover.mjs sample <slug> <voiceId>... [--model id] → out/<slug>/voice-samples/<voiceId>.mp3 (first section)
//   node scripts/voiceover.mjs build <slug> <voiceId> [modelId] [--speed 1.0] [--widen]
//                                                                      → public/videos/<slug>/vo.wav + videos/<slug>/timing.json
// build: one request per phrase (neighbouring phrases as context for continuous prosody), cached in out/<slug>/vo-clips
// so a re-run after a window change costs no credits. Clips are trimmed of silence and laid out with the STYLE pauses
// (src/spec/pauses.ts) inside each section's window, sped up by at most ×1.05 when tight. A section that still does not
// fit stops the build with nothing written; --widen instead moves the windows and durationSec in spec.json to the speech.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PAUSE, pauseAfter } from "../src/spec/pauses.ts";
import { API, apiKey } from "./elevenlabs.mjs";
import { parseArgs } from "./lib/args.mjs";
import { ROOT, SAMPLE_RATE, loadSpec, outDir, publicDir, readPcm, requireSlug, videoDir, writeWav } from "./lib/video.mjs";

const DEFAULT_MODEL = "eleven_multilingual_v2";
const LEAD = 0.2;
const TAIL = 0.15;
const MAX_TEMPO = 1.05;
// Windows written by --widen fit their speech exactly; this keeps float noise from asking for ×1.001.
const FIT_SLACK = 0.005;
const SPEED_RANGE = [0.7, 1.2];
const CONTEXT_PHRASES = 2;
const EDGE = 0.03;
const SILENT_DB = -50;
const OUTRO = 1.7;
const CUT_RATE = 2.8;

let key;
const api = async (method, route, body) => {
  key ??= apiKey();
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${route.split("?")[0]} → ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
};

const ttsRequest = (voiceId, modelId, text, previousText, nextText, speed = 1) => ({
  route: `/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
  body: {
    text,
    model_id: modelId,
    previous_text: previousText || undefined,
    next_text: nextText || undefined,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed },
    // multilingual_v2 rejects language_code; newer models use it to lock Turkish.
    ...(modelId === "eleven_multilingual_v2" ? {} : { language_code: "tr" }),
  },
});

const tts = (...args) => {
  const { route, body } = ttsRequest(...args);
  return api("POST", route, body);
};

const round2 = (x) => Math.round(x * 100) / 100;
const floorTo = (x, step) => Number((Math.floor(x / step + 1e-6) * step).toFixed(2));
const ceilTo = (x, step) => Number((Math.ceil(x / step - 1e-6) * step).toFixed(2));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const wordCount = (text) => text.split(" ").length;

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

/** First and one-past-last sample of the 10 ms windows louder than SILENT_DB (RMS). */
const speechBounds = (samples) => {
  const win = SAMPLE_RATE / 100;
  const floor = 10 ** (SILENT_DB / 10) * win;
  const loud = [];
  for (let i = 0; i < samples.length; i += win) {
    let energy = 0;
    for (let j = i; j < Math.min(i + win, samples.length); j++) energy += samples[j] * samples[j];
    if (energy > floor) loud.push(i);
  }
  if (!loud.length) return null;
  return { onset: loud[0], offset: Math.min(samples.length, loud[loud.length - 1] + win) };
};

/** A phrase as a 48 kHz mono clip trimmed to its speech ± EDGE; `lead` is where the speech starts inside it. */
const phraseClip = async (cacheDir, request, text) => {
  const hash = createHash("sha1").update(request.route + JSON.stringify(request.body)).digest("hex");
  const file = path.join(cacheDir, `${hash}.json`);
  const cached = existsSync(file);
  if (!cached) console.log(`  synthesizing: ${text}`);
  const res = cached ? JSON.parse(readFileSync(file, "utf8")) : await api("POST", request.route, request.body);
  if (!res.audio_base64 || !res.alignment) throw new Error(`No audio or alignment returned for "${text}"`);
  const words = toWords(res.alignment);
  if (words.length !== wordCount(text)) throw new Error(`"${text}": ${words.length} aligned words, expected ${wordCount(text)}`);
  if (!cached) writeFileSync(file, JSON.stringify(res));

  const samples = readPcm(Buffer.from(res.audio_base64, "base64"));
  const bounds = speechBounds(samples);
  if (!bounds) throw new Error(`"${text}": the clip is silent (${path.relative(ROOT, file)})`);
  const edge = Math.round(EDGE * SAMPLE_RATE);
  const from = Math.max(0, bounds.onset - edge);
  const to = Math.min(samples.length, bounds.offset + edge);
  const clamp = (t) => Math.min((to - from) / SAMPLE_RATE, Math.max(0, t - from / SAMPLE_RATE));
  return {
    text,
    cached,
    samples: samples.subarray(from, to),
    lead: (bounds.onset - from) / SAMPLE_RATE,
    spoken: (bounds.offset - bounds.onset) / SAMPLE_RATE,
    words: words.map((w) => ({ text: w.text, start: clamp(w.start), end: clamp(w.end) })),
  };
};

const stretch = (clip, tempo) =>
  tempo === 1
    ? clip
    : {
        ...clip,
        samples: readPcm(clip.samples, { filter: `atempo=${tempo}` }),
        lead: clip.lead / tempo,
        spoken: clip.spoken / tempo,
        words: clip.words.map((w) => ({ ...w, start: w.start / tempo, end: w.end / tempo })),
      };

/** Section k speaks from max(window start + LEAD, previous section's end + PAUSE.section), STYLE pauses between phrases. */
const layout = (sections, clipsBySection, widen) => {
  let prevEnd = -Infinity;
  return sections.map((section, k) => {
    const clips = clipsBySection[k];
    const [s0, s1] = section.window;
    const pauses = clips.map((c, i) => (i < clips.length - 1 ? pauseAfter(c.text) : 0));
    const pause = sum(pauses);
    const spoken = sum(clips.map((c) => c.spoken));
    const start = Math.max(s0 + LEAD, prevEnd + PAUSE.section);
    const available = s1 - TAIL - start;
    const needed = spoken + pause;
    let tempo = 1;
    if (!widen && needed > available + FIT_SLACK) {
      tempo = available > pause ? Math.ceil((spoken / (available - pause)) * 1000) / 1000 : Infinity;
    }
    const fits = tempo <= MAX_TEMPO;
    const end = start + spoken / tempo + pause;
    // A section that does not fit is reported as if shortened to its window, so the next row stands on its own.
    prevEnd = fits ? end : s1 - TAIL;
    return { section, clips, pauses, spoken, pause, start, end, available, needed, tempo, fits };
  });
};

const printOverflow = (plan) => {
  const rows = plan.map((p) => {
    const over = p.needed - p.available;
    return [
      p.section.id,
      p.needed.toFixed(2),
      p.available.toFixed(2),
      p.fits ? "—" : over.toFixed(2),
      p.fits ? (p.tempo > 1 ? `fits at ×${p.tempo.toFixed(3)}` : "fits") : `≈ ${Math.ceil(over * CUT_RATE)}`,
    ];
  });
  const head = ["section", "needed s", "available s", "over by s", `words to cut (${CUT_RATE}/s)`];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
  console.error(line(head));
  for (const [i, r] of rows.entries()) console.error(`${line(r)}${plan[i].fits ? "" : "  ← does not fit"}`);
};

const { positional, flags } = parseArgs(process.argv.slice(2), { model: "string", speed: "number", widen: "boolean" });
const [cmd, ...args] = positional;
const speed = flags.speed ?? 1;
if (!(speed >= SPEED_RANGE[0] && speed <= SPEED_RANGE[1])) {
  console.error(`--speed must be between ${SPEED_RANGE[0]} and ${SPEED_RANGE[1]}`);
  process.exit(1);
}

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
    const res = await tts(voiceId, modelId, spec.voiceover.sections[0].phrases.join(" "), undefined, undefined, speed);
    const file = path.join(dir, `${voiceId}.mp3`);
    writeFileSync(file, Buffer.from(res.audio_base64, "base64"));
    console.log(path.relative(ROOT, file));
  }
} else if (cmd === "build") {
  const slug = requireSlug(args[0]);
  const [, voiceId, modelArg] = args;
  const modelId = flags.model ?? modelArg ?? DEFAULT_MODEL;
  if (!voiceId) throw new Error("Usage: build <slug> <voiceId> [modelId] [--speed 1.0] [--widen]");
  const { file: specFile, json, spec } = loadSpec(slug);
  const sections = spec.voiceover.sections;
  const texts = sections.flatMap((s) => s.phrases);
  const cacheDir = path.join(outDir(slug), "vo-clips");
  mkdirSync(cacheDir, { recursive: true });

  const clips = [];
  for (const [g, text] of texts.entries()) {
    const previous = texts.slice(Math.max(0, g - CONTEXT_PHRASES), g).join(" ");
    const next = texts.slice(g + 1, g + 1 + CONTEXT_PHRASES).join(" ");
    clips.push(await phraseClip(cacheDir, ttsRequest(voiceId, modelId, text, previous, next, speed), text));
  }
  const fresh = clips.filter((c) => !c.cached).length;
  console.log(`${clips.length} phrase clips: ${clips.length - fresh} cached, ${fresh} synthesized → ${path.relative(ROOT, cacheDir)}/`);

  let cursor = 0;
  const plan = layout(
    sections,
    sections.map((s) => clips.slice(cursor, (cursor += s.phrases.length))),
    flags.widen,
  );
  if (plan.some((p) => !p.fits)) {
    console.error(`\nSome sections do not fit their window, even sped up ×${MAX_TEMPO}. Nothing written.`);
    printOverflow(plan);
    console.error("\nShorten those phrases, or run again with --widen to move the windows (and durationSec) to the speech.");
    console.error("The clips are cached, so the re-run costs no credits.");
    process.exit(1);
  }

  const placed = [];
  const allWords = [];
  for (const p of plan) {
    let at = p.start;
    p.clips.forEach((raw, i) => {
      const clip = stretch(raw, p.tempo);
      const offset = Math.round((at - clip.lead) * SAMPLE_RATE);
      placed.push({ offset, samples: clip.samples });
      for (const w of clip.words) allWords.push({ text: w.text, start: offset / SAMPLE_RATE + w.start, end: offset / SAMPLE_RATE + w.end });
      at += clip.spoken + p.pauses[i];
    });
    const words = p.clips.reduce((n, c) => n + c.words.length, 0);
    console.log(
      `${p.section.id.padEnd(12)} ${String(words).padStart(3)} words, ${(p.spoken / p.tempo).toFixed(2)} s spoken + ` +
        `${p.pause.toFixed(2)} s pauses, at ${p.start.toFixed(2)}–${p.end.toFixed(2)} s ` +
        `(window ${p.section.window[0]}–${p.section.window[1]}), atempo ×${p.tempo.toFixed(3)}`,
    );
  }

  if (flags.widen) {
    plan.forEach((p, k) => {
      const window = [floorTo(p.start - LEAD, 0.01), ceilTo(p.end + TAIL, 0.01)];
      const old = json.voiceover.sections[k].window;
      if (window[0] !== old[0] || window[1] !== old[1]) console.log(`  ${p.section.id}: window ${old[0]}–${old[1]} → ${window[0]}–${window[1]}`);
      json.voiceover.sections[k].window = window;
    });
    const durationSec = ceilTo(allWords[allWords.length - 1].end + OUTRO, 0.1);
    if (durationSec !== json.durationSec) console.log(`  durationSec ${json.durationSec} → ${durationSec}`);
    json.durationSec = durationSec;
  }

  const audioEnd = Math.max(...placed.map((p) => p.offset + p.samples.length));
  const videoEnd = Math.round(json.durationSec * SAMPLE_RATE);
  if (audioEnd > videoEnd) console.warn(`speech runs to ${(audioEnd / SAMPLE_RATE).toFixed(2)} s, past durationSec ${json.durationSec} — raise it or use --widen`);
  const pcm = new Float32Array(Math.max(audioEnd, videoEnd));
  for (const { offset, samples } of placed) for (let j = 0; j < samples.length; j++) pcm[offset + j] += samples[j];
  mkdirSync(publicDir(slug), { recursive: true });
  const voOut = path.join(publicDir(slug), "vo.wav");
  writeWav(voOut, pcm, { filter: "aformat=channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=7,aresample=48000" });

  cursor = 0;
  const timing = {
    source: `elevenlabs:${voiceId}/${modelId}`,
    audio: `videos/${slug}/vo.wav`,
    phrases: texts.map((text) => {
      const span = allWords.slice(cursor, (cursor += wordCount(text)));
      return { text, start: round2(span[0].start), end: round2(span[span.length - 1].end) };
    }),
    words: allWords.map((w) => ({
      text: w.text,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
      timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
      confidence: null,
    })),
  };
  const timingFile = path.join(videoDir(slug), "timing.json");
  writeFileSync(timingFile, `${JSON.stringify(timing, null, 2)}\n`);
  if (flags.widen) writeFileSync(specFile, `${JSON.stringify(json, null, 2)}\n`);

  console.log(path.relative(ROOT, voOut));
  console.log(path.relative(ROOT, timingFile));
  if (flags.widen) console.log(`${path.relative(ROOT, specFile)} (windows and durationSec moved — check marks tied to sections)`);
} else {
  console.error(
    "Usage: node scripts/voiceover.mjs voices | sample <slug> <voiceId>... [--model id] [--speed 1.0]\n" +
      "                                | build <slug> <voiceId> [modelId] [--model id] [--speed 1.0] [--widen]",
  );
  process.exit(1);
}
