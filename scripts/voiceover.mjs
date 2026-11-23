// ElevenLabs voice-over for one video. Needs ELEVENLABS_API_KEY in .env (git-ignored).
//   node scripts/voiceover.mjs voices                                  → Turkish-capable models + voices on the account
//   node scripts/voiceover.mjs sample <slug> <voiceId>... [--model id] → out/<slug>/voice-samples/<voiceId>.mp3 (first section)
//   node scripts/voiceover.mjs build <slug> [voiceId] [--model id] [--speed 1.0] [--widen] [--offline]
//                                                                      → public/videos/<slug>/vo.wav + videos/<slug>/timing.json
//   node scripts/voiceover.mjs pick <slug> <sentence#> <take>          → spec voiceover.picks, then build --offline
// build: one request per section (neighbouring sections as context), so sentence ends are intoned as in one reading.
// The text sent is the spoken form (src/spec/lexicon.ts); captions keep the written one. Pauses are opened only
// inside existing silences (scripts/lib/speech.mjs). Every sentence's final rise and decay is measured
// (scripts/prosody.py); a flagged sentence gets alternative takes and the best is used unless voiceover.picks says
// otherwise; out/<slug>/review.html lets you listen and choose. Speed-ups stay within ×1.05; a section that still
// does not fit stops the build with nothing written, --widen moves the windows and durationSec instead.
// Requests are cached in out/<slug>/vo-takes, so re-runs and --offline cost no credits.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spoken, spokenWords } from "../src/spec/lexicon.ts";
import { PAUSE, pauseAfter } from "../src/spec/pauses.ts";
import { sentencesOf } from "../src/spec/sentences.ts";
import { API, apiKey } from "./elevenlabs.mjs";
import { parseArgs } from "./lib/args.mjs";
import { flagText, writeReview } from "./lib/review.mjs";
import { PROSODY, analyse, cutPoint, measureProsody, openPauses, phraseBounds, phraseRanges, trimToSound } from "./lib/speech.mjs";
import { ROOT, SAMPLE_RATE, loadSpec, outDir, publicDir, readPcm, requireSlug, videoDir, writeVoice, writeWav } from "./lib/video.mjs";

const DEFAULT_MODEL = "eleven_multilingual_v2";
/** Window start → first sound, and last sound → window end. */
const LEAD = 0.2;
const WINDOW_TAIL = 0.15;
const MAX_TEMPO = 1.05;
// Windows written by --widen fit their speech exactly; this keeps float noise from asking for ×1.001.
const FIT_SLACK = 0.005;
const SPEED_RANGE = [0.7, 1.2];
const OUTRO = 1.7;
const CUT_RATE = 2.8;
/** Alternative takes of a flagged sentence; take 0 is the sentence as read in its section. */
const ALT_SEEDS = [1, 2, 3];
const CONTEXT_SENTENCES = 2;

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

const ttsRequest = (voiceId, modelId, text, { previous, next, seed, speed = 1 } = {}) => ({
  route: `/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
  body: {
    text,
    model_id: modelId,
    previous_text: previous || undefined,
    next_text: next || undefined,
    seed,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed },
    // multilingual_v2 rejects language_code; newer models use it to lock Turkish.
    ...(modelId === "eleven_multilingual_v2" ? {} : { language_code: "tr" }),
  },
});

const round2 = (x) => Math.round(x * 100) / 100;
const floorTo = (x, step) => Number((Math.floor(x / step + 1e-6) * step).toFixed(2));
const ceilTo = (x, step) => Number((Math.ceil(x / step - 1e-6) * step).toFixed(2));
const seedOf = (text) => parseInt(createHash("sha1").update(text).digest("hex").slice(0, 8), 16);

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

/** A cached or fresh take of `phrases` (written form), trimmed to its sound: mono pcm with written-word times. */
const take = async (ctx, request, phrases) => {
  const hash = createHash("sha1").update(request.route + JSON.stringify(request.body)).digest("hex");
  const file = path.join(ctx.cacheDir, `${hash}.json`);
  const cached = existsSync(file);
  if (!cached && ctx.offline) throw new Error(`--offline: not cached yet: "${request.body.text.slice(0, 60)}…"`);
  if (!cached) {
    console.log(`  synthesizing (${request.body.text.length} chars): ${request.body.text.slice(0, 72)}`);
    ctx.chars += request.body.text.length;
  }
  const res = cached ? JSON.parse(readFileSync(file, "utf8")) : await api("POST", request.route, request.body);
  if (!res.audio_base64 || !res.alignment) throw new Error(`No audio or alignment returned for "${request.body.text}"`);
  const heard = toWords(res.alignment);
  const groups = phrases.flatMap(spokenWords);
  const expected = groups.reduce((n, g) => n + g.length, 0);
  if (heard.length !== expected) throw new Error(`"${request.body.text}": ${heard.length} aligned words, expected ${expected}`);
  if (!cached) writeFileSync(file, JSON.stringify(res));

  const written = phrases.flatMap((p) => p.split(" "));
  let k = 0;
  const words = groups.map((g, i) => {
    const first = heard[k];
    k += g.length;
    return { text: written[i], start: first.start, end: heard[k - 1].end };
  });
  const raw = readPcm(Buffer.from(res.audio_base64, "base64"));
  const trimmed = trimToSound(raw, analyse(raw), words[words.length - 1].end);
  if (!trimmed) throw new Error(`"${request.body.text}": the take is silent (${path.relative(ROOT, file)})`);
  const wav = path.join(ctx.cacheDir, `${hash}.wav`);
  if (!existsSync(wav)) writeWav(wav, trimmed.pcm);
  const shift = (t) => Math.max(0, t - trimmed.from);
  return { wav, pcm: trimmed.pcm, words: words.map((w) => ({ ...w, start: shift(w.start), end: shift(w.end) })) };
};

/** Bounds of each phrase in a clip, the pauses and silences between them, and the clip's silence level. */
const inspect = (clip, phrases) => {
  const ranges = phraseRanges(phrases);
  const a = analyse(clip.pcm);
  return { ranges, quietDb: a.quiet, ...phraseBounds(a, clip.words, ranges) };
};

const slice = (clip, from, to) => {
  const a = Math.round(from * SAMPLE_RATE);
  const b = Math.round(to * SAMPLE_RATE);
  return {
    pcm: clip.pcm.slice(a, b),
    words: clip.words.filter((w) => w.start >= from - 1e-6 && w.start < to).map((w) => ({ ...w, start: w.start - from, end: w.end - from })),
  };
};

const concat = (parts) => {
  const pcm = new Float32Array(parts.reduce((n, p) => n + p.pcm.length, 0));
  const words = [];
  let at = 0;
  for (const p of parts) {
    pcm.set(p.pcm, at);
    for (const w of p.words) words.push({ ...w, start: w.start + at / SAMPLE_RATE, end: w.end + at / SAMPLE_RATE });
    at += p.pcm.length;
  }
  return { pcm, words };
};

/** The best take: unflagged first, then the smallest final rise, then the length closest to the section's reading. */
const rank = (candidates) => {
  const base = candidates[0].duration;
  return [...candidates].sort(
    (x, y) =>
      Math.sign(x.flags.length) - Math.sign(y.flags.length) ||
      (x.rise ?? 0) - (y.rise ?? 0) ||
      Math.abs(x.duration - base) - Math.abs(y.duration - base),
  )[0];
};

/** A section with every pause opened to its STYLE length. */
const withPauses = (clip, phrases) => {
  const { pcm, words, cuts, runOns } = openPauses(clip.pcm, 1, clip.words, phraseRanges(phrases), (i) => pauseAfter(phrases[i]));
  return { pcm, words, opened: cuts.reduce((s, c) => s + c.seconds, 0), runOns: runOns.map((i) => phrases[i]) };
};

const stretch = (clip, tempo) =>
  tempo === 1
    ? clip
    : { pcm: readPcm(clip.pcm, { filter: `atempo=${tempo}` }), words: clip.words.map((w) => ({ ...w, start: w.start / tempo, end: w.end / tempo })) };

const printOverflow = (plan) => {
  const rows = plan.map((p) => {
    const over = p.needed - p.available;
    return [
      p.id,
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

/** Final rise and decay of every candidate not measured yet; duration is its sentence's sounding length. */
const measure = (candidates) => {
  const todo = candidates.filter((c) => !c.measured);
  const results = measureProsody(todo.map((c, i) => ({ id: i, ...c.measure, kind: c.kind })));
  for (const m of results) Object.assign(todo[m.id], { rise: m.rise, decay: m.decay, flags: m.flags, measured: true });
  for (const c of candidates) c.duration = c.measure.end - c.measure.start;
};

const build = async (slug, voiceArg, flags) => {
  const { file: specFile, json, spec } = loadSpec(slug);
  const voiceId = voiceArg ?? spec.voiceover.tts?.voice;
  const modelId = flags.model ?? spec.voiceover.tts?.model ?? DEFAULT_MODEL;
  if (!voiceId) throw new Error("Usage: build <slug> <voiceId> (or set voiceover.tts.voice in spec.json)");
  let specChanged = false;
  if (spec.voiceover.tts?.voice !== voiceId || spec.voiceover.tts?.model !== modelId) {
    if (spec.voiceover.picks.length && spec.voiceover.tts) console.warn(`voice or model changed: the picks in spec.json were made for ${spec.voiceover.tts.voice}`);
    json.voiceover.tts = { voice: voiceId, model: modelId };
    specChanged = true;
  }
  const speed = flags.speed ?? 1;
  const ctx = { cacheDir: path.join(outDir(slug), "vo-takes"), offline: flags.offline, chars: 0 };
  mkdirSync(ctx.cacheDir, { recursive: true });

  const sections = spec.voiceover.sections;
  const sentences = sentencesOf(sections);
  const texts = sections.map((s) => s.phrases.join(" "));
  const parts = [];
  let offset = 0;
  for (const [k, section] of sections.entries()) {
    const request = ttsRequest(voiceId, modelId, spoken(texts[k]), {
      previous: texts[k - 1] && spoken(texts[k - 1]),
      next: texts[k + 1] && spoken(texts[k + 1]),
      seed: seedOf(texts[k]),
      speed,
    });
    const clip = await take(ctx, request, section.phrases);
    const seen = inspect(clip, section.phrases);
    const mine = sentences.filter((s) => s.first >= offset && s.first < offset + section.phrases.length);
    // Each sentence is cut out of its section inside the pauses around it, so any take can replace it.
    const ends = mine.map((s, i) => {
      if (i === mine.length - 1) return clip.pcm.length / SAMPLE_RATE;
      const last = s.last - offset;
      const lastEnd = clip.words[seen.ranges[last][1] - 1].end;
      const gap = seen.gaps[last];
      return cutPoint(seen.silences[last], lastEnd)?.at ?? (gap ? (gap[0] + gap[1]) / 2 : (lastEnd + clip.words[seen.ranges[last + 1][0]].start) / 2);
    });
    mine.forEach((s, i) => {
      parts.push({
        section: k,
        sentence: s,
        phrases: section.phrases.slice(s.first - offset, s.last - offset + 1),
        original: {
          seed: 0,
          label: "Bölümdeki okuma",
          kind: s.kind,
          ...slice(clip, i === 0 ? 0 : ends[i - 1], ends[i]),
          measure: { wav: clip.wav, start: seen.bounds[s.first - offset].onset, end: seen.bounds[s.last - offset].offset, quietDb: seen.quietDb },
        },
      });
    });
    offset += section.phrases.length;
  }
  measure(parts.map((p) => p.original));

  const picks = new Map(spec.voiceover.picks.map((p) => [p.sentence, p.seed]));
  const known = new Set(parts.map((p) => p.sentence.text));
  for (const p of spec.voiceover.picks) if (!known.has(p.sentence)) console.warn(`pick ignored, no such sentence any more: "${p.sentence}"`);

  const all = parts.map((p) => p.sentence.text);
  for (const [i, part] of parts.entries()) {
    const picked = picks.get(part.sentence.text);
    const seeds = part.original.flags.length ? ALT_SEEDS : picked ? [picked] : [];
    part.candidates = [part.original];
    for (const seed of seeds) {
      const request = ttsRequest(voiceId, modelId, spoken(part.sentence.text), {
        previous: spoken(all.slice(Math.max(0, i - CONTEXT_SENTENCES), i).join(" ")),
        next: spoken(all.slice(i + 1, i + 1 + CONTEXT_SENTENCES).join(" ")),
        seed,
        speed,
      });
      const clip = await take(ctx, request, part.phrases);
      const seen = inspect(clip, part.phrases);
      part.candidates.push({
        seed,
        label: `Alternatif ${seed}`,
        kind: part.sentence.kind,
        ...clip,
        measure: { wav: clip.wav, start: seen.bounds[0].onset, end: seen.bounds.at(-1).offset, quietDb: seen.quietDb },
      });
    }
  }
  measure(parts.flatMap((p) => p.candidates));
  for (const part of parts) {
    const auto = rank(part.candidates);
    auto.auto = true;
    const picked = part.candidates.find((c) => c.seed === picks.get(part.sentence.text));
    if (picked) picked.picked = true;
    part.chosen = picked ?? auto;
  }
  if (ctx.chars) console.log(`${ctx.chars} characters synthesized (ElevenLabs credits)`);

  const plan = [];
  const assembled = [];
  let prevEnd = -Infinity;
  for (const [k, section] of sections.entries()) {
    const joined = withPauses(concat(parts.filter((p) => p.section === k).map((p) => p.chosen)), section.phrases);
    const { bounds } = inspect(joined, section.phrases);
    const onset = bounds[0].onset;
    const needed = bounds.at(-1).offset - onset;
    const [s0, s1] = section.window;
    const start = Math.max(s0 + LEAD, prevEnd + PAUSE.section);
    const available = s1 - WINDOW_TAIL - start;
    const tempo = !flags.widen && needed > available + FIT_SLACK ? Math.ceil((needed / available) * 1000) / 1000 : 1;
    const fits = tempo <= MAX_TEMPO;
    const end = start + needed / tempo;
    plan.push({ id: section.id, needed, available, tempo, fits, start, end, opened: joined.opened, runOns: joined.runOns });
    prevEnd = fits ? end : s1 - WINDOW_TAIL;
    assembled.push({ clip: fits ? stretch(joined, tempo) : joined, at: start - onset / tempo });
  }
  if (plan.some((p) => !p.fits)) {
    console.error(`\nSome sections do not fit their window, even sped up ×${MAX_TEMPO}. Nothing written.`);
    printOverflow(plan);
    console.error("\nShorten those phrases, or run again with --widen to move the windows (and durationSec) to the speech.");
    console.error("The takes are cached, so the re-run costs no credits.");
    process.exit(1);
  }

  const words = [];
  const placed = [];
  for (const { clip, at } of assembled) {
    const frame = Math.round(at * SAMPLE_RATE);
    placed.push({ frame, samples: clip.pcm });
    for (const w of clip.words) words.push({ ...w, start: w.start + frame / SAMPLE_RATE, end: w.end + frame / SAMPLE_RATE });
  }
  for (const p of plan) {
    console.log(`${p.id.padEnd(12)} ${p.needed.toFixed(2)} s with pauses (+${p.opened.toFixed(2)} s opened), at ${p.start.toFixed(2)}–${p.end.toFixed(2)} s, atempo ×${p.tempo.toFixed(3)}`);
    for (const text of p.runOns) console.log(`  no pause in the take after "${text}" — left as read`);
  }

  if (flags.widen) {
    plan.forEach((p, k) => {
      const window = [floorTo(p.start - LEAD, 0.01), ceilTo(p.end + WINDOW_TAIL, 0.01)];
      const old = json.voiceover.sections[k].window;
      if (window[0] !== old[0] || window[1] !== old[1]) console.log(`  ${p.id}: window ${old[0]}–${old[1]} → ${window[0]}–${window[1]}`);
      json.voiceover.sections[k].window = window;
    });
    const durationSec = ceilTo(words[words.length - 1].end + OUTRO, 0.1);
    if (durationSec !== json.durationSec) console.log(`  durationSec ${json.durationSec} → ${durationSec}`);
    json.durationSec = durationSec;
    specChanged = true;
  }

  const audioEnd = Math.max(...placed.map((p) => p.frame + p.samples.length));
  const videoEnd = Math.round(json.durationSec * SAMPLE_RATE);
  if (audioEnd > videoEnd) console.warn(`speech runs to ${(audioEnd / SAMPLE_RATE).toFixed(2)} s, past durationSec ${json.durationSec} — raise it or use --widen`);
  const pcm = new Float32Array(Math.max(audioEnd, videoEnd));
  for (const { frame, samples } of placed) for (let j = 0; j < samples.length; j++) pcm[frame + j] += samples[j];
  mkdirSync(publicDir(slug), { recursive: true });
  const voOut = path.join(publicDir(slug), "vo.wav");
  writeVoice(voOut, pcm);

  // Phrase bounds in timing.json are where the sound starts and stops, so captions and qa follow what is heard.
  const phrases = sections.flatMap((s) => s.phrases);
  const ranges = phraseRanges(phrases);
  const final = phraseBounds(analyse(pcm), words, ranges).bounds;
  ranges.forEach(([first], i) => (words[first].start = Math.max(words[first].start, final[i].onset)));
  const timing = {
    source: `elevenlabs:${voiceId}/${modelId}`,
    audio: `videos/${slug}/vo.wav`,
    phrases: phrases.map((text, i) => ({ text, start: round2(final[i].onset), end: round2(final[i].offset) })),
    words: words.map((w) => ({
      text: w.text,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
      timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
      confidence: null,
    })),
  };
  const timingFile = path.join(videoDir(slug), "timing.json");
  writeFileSync(timingFile, `${JSON.stringify(timing, null, 2)}\n`);
  if (specChanged) writeFileSync(specFile, `${JSON.stringify(json, null, 2)}\n`);

  const reviewed = parts.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.candidates.length > 1 || p.original.flags.length);
  const review = writeReview(slug, {
    mode: "tts",
    limits: PROSODY,
    items: reviewed.map((p) => ({ n: p.n, text: p.sentence.text, candidates: p.candidates })),
  });
  console.log(`\nIntonation: ${reviewed.length} of ${parts.length} sentences flagged or picked`);
  for (const p of reviewed) {
    const c = p.chosen;
    console.log(`  ${String(p.n).padStart(2)}. ${p.sentence.text}\n      ${flagText(p.original.flags)} → ${c.label}${c.picked ? " (your pick)" : ""}: ${flagText(c.flags)}`);
  }
  console.log(path.relative(ROOT, voOut));
  console.log(path.relative(ROOT, timingFile));
  if (specChanged) console.log(`${path.relative(ROOT, specFile)}${flags.widen ? " (windows and durationSec moved — check marks tied to sections)" : ""}`);
  console.log(`${path.relative(ROOT, review)} — listen and choose: npm run review -- ${slug}`);
};

const { positional, flags } = parseArgs(process.argv.slice(2), { model: "string", speed: "number", widen: "boolean", offline: "boolean" });
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
    const { route, body } = ttsRequest(voiceId, modelId, spoken(spec.voiceover.sections[0].phrases.join(" ")), { speed });
    const res = await api("POST", route, body);
    const file = path.join(dir, `${voiceId}.mp3`);
    writeFileSync(file, Buffer.from(res.audio_base64, "base64"));
    console.log(path.relative(ROOT, file));
  }
} else if (cmd === "build") {
  await build(requireSlug(args[0]), args[1], flags);
} else if (cmd === "pick") {
  const slug = requireSlug(args[0]);
  const [n, seed] = [Number(args[1]), Number(args[2])];
  const { file, json, spec } = loadSpec(slug);
  const all = sentencesOf(spec.voiceover.sections);
  const sentence = all[n - 1];
  if (!sentence || !(seed === 0 || ALT_SEEDS.includes(seed))) {
    console.error(`Usage: pick <slug> <sentence 1–${all.length}> <take 0 | ${ALT_SEEDS.join(" | ")}>`);
    process.exit(1);
  }
  json.voiceover.picks = [...(json.voiceover.picks ?? []).filter((p) => p.sentence !== sentence.text), { sentence: sentence.text, seed }];
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`${path.relative(ROOT, file)}: sentence ${n} → take ${seed}`);
  const res = spawnSync(process.execPath, [path.join(ROOT, "scripts/voiceover.mjs"), "build", slug, "--offline"], { stdio: "inherit" });
  process.exit(res.status ?? 1);
} else {
  console.error(
    "Usage: node scripts/voiceover.mjs voices | sample <slug> <voiceId>... [--model id] [--speed 1.0]\n" +
      "                                | build <slug> [voiceId] [--model id] [--speed 1.0] [--widen] [--offline]\n" +
      "                                | pick <slug> <sentence#> <take>",
  );
  process.exit(1);
}
