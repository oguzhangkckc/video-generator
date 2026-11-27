// Voice-over for one video from a text-to-speech provider (scripts/lib/tts): ElevenLabs, Azure Speech (SSML), or the
// free macOS `say` placeholder. A human recording goes through npm run align instead.
//   node scripts/voiceover.mjs voices [--provider p]                       → voices and models to choose from
//   node scripts/voiceover.mjs sample <slug> <voice>... [--provider p]     → out/<slug>/voice-samples/ (first section)
//   node scripts/voiceover.mjs build <slug> [voice] [--provider p] [--model id] [--speed 1.0] [--widen] [--offline]
//                                          [--estimate] [--over-budget]   → public/videos/<slug>/vo.wav + videos/<slug>/timing.json
//                                          (the placeholder: vo.draft.wav + timing.draft.json, git-ignored; a real build removes them)
//   node scripts/voiceover.mjs pick <slug> <sentence#> <take>              → spec voiceover.picks, then build --offline
//   node scripts/voiceover.mjs listen <metin.json> [--provider say] [--sections a,b] → out/<slug>/metin/ses/: a script draft
//                                          (skill step c) read by the free placeholder voice; no spec, timing or credit
// Every sentence is read on its own, with its neighbours as context, and cached by what its sound depends on (not the
// context), in out/tts-cache: only changed sentences are paid for again. Before anything is sent, the takes to make
// and their characters are listed with what is left on the account; past the video's budget (voiceover.tts.budget)
// the build stops and asks for --over-budget. Sentences are joined with their STYLE pauses; pauses inside a sentence
// are opened in its own silences (scripts/lib/speech.mjs). Every sentence's final rise and decay is measured
// (scripts/prosody.py); a flagged one gets `takes` alternatives and the best is used unless voiceover.picks says
// otherwise (out/<slug>/review.html). The placeholder voice is neither measured nor given alternatives.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spoken, spokenWords } from "../src/spec/lexicon.ts";
import { PAUSE, pauseAfter } from "../src/spec/pauses.ts";
import { sentencesOf } from "../src/spec/sentences.ts";
import { parseArgs } from "./lib/args.mjs";
import { readDraft, variantsOf } from "./lib/draft.mjs";
import { flagText, writeReview } from "./lib/review.mjs";
import { PROSODY, analyse, measureProsody, openPauses, phraseBounds, phraseRanges, trimToSound } from "./lib/speech.mjs";
import { api } from "./lib/tts/elevenlabs.mjs";
import { PROVIDERS, providerOf } from "./lib/tts/index.mjs";
import { cacheDir, cacheKey, estimate, overspend, readLedger, record } from "./lib/tts/spend.mjs";
import {
  ROOT,
  SAMPLE_RATE,
  formatSpec,
  loadSpec,
  outDir,
  publicDir,
  readPcm,
  removeDraftVoice,
  requireSlug,
  videoDir,
  voiceFiles,
  writeVoice,
  writeWav,
} from "./lib/video.mjs";

/** Window start → first sound, and last sound → window end. */
const LEAD = 0.2;
const WINDOW_TAIL = 0.15;
const MAX_TEMPO = 1.05;
// Windows written by --widen fit their speech exactly; this keeps float noise from asking for ×1.001.
const FIT_SLACK = 0.005;
const SPEED_RANGE = [0.7, 1.2];
const OUTRO = 1.7;
const CUT_RATE = 2.8;
/** Alternative takes of a flagged sentence, unless voiceover.tts.takes says otherwise; take 0 is the main reading. */
const DEFAULT_TAKES = 3;
const CONTEXT_SENTENCES = 2;

const round2 = (x) => Math.round(x * 100) / 100;
const floorTo = (x, step) => Number((Math.floor(x / step + 1e-6) * step).toFixed(2));
const ceilTo = (x, step) => Number((Math.ceil(x / step - 1e-6) * step).toFixed(2));
const seedOf = (text) => parseInt(createHash("sha1").update(text).digest("hex").slice(0, 8), 16);

/**
 * Lists what a batch of requests would cost and stops when the account or the video's budget cannot pay for it
 * (exit 3, nothing sent). With --estimate it only reports.
 */
const spend = async (ctx, requests, label) => {
  const { provider } = ctx;
  const { todo, chars } = estimate(provider, requests);
  console.log(`${label}: ${requests.length} okuma, ${requests.length - todo.length} önbellekte → ${todo.length} üretilecek, ${chars} karakter${provider.placeholder ? " (geçici ses, ücretsiz)" : ""}`);
  if (!todo.length || !chars) return;
  if (ctx.offline) throw new Error(`--offline: ${todo.length} okuma önbellekte yok`);
  const remaining = provider.remaining ? await provider.remaining() : undefined;
  const { spent } = readLedger(ctx.slug);
  if (remaining !== undefined) console.log(`  hesapta kalan: ${remaining} karakter`);
  if (ctx.budget !== undefined) console.log(`  video bütçesi: ${spent} / ${ctx.budget} karakter harcandı`);
  if (ctx.estimateOnly) return;
  const why = overspend({ chars, remaining, spent, budget: ctx.overBudget ? undefined : ctx.budget });
  if (why) {
    const askable = remaining === undefined || chars <= remaining;
    console.error(`\n${why}. Hiçbir şey gönderilmedi.${askable ? " Onaylıyorsan --over-budget ile yeniden çalıştır." : ""}`);
    process.exit(3);
  }
};

/** A cached or fresh take. A fresh one is saved before any check, so a take that fails one is still paid for once. */
const fetchTake = async (ctx, request) => {
  const { provider } = ctx;
  const dir = cacheDir(provider);
  mkdirSync(dir, { recursive: true });
  const key = cacheKey(provider, request);
  const meta = path.join(dir, `${key}.json`);
  const audioFile = path.join(dir, `${key}.${provider.ext}`);
  if (existsSync(meta)) return { key, dir, audio: readFileSync(audioFile), ...JSON.parse(readFileSync(meta, "utf8")) };
  if (ctx.offline) throw new Error(`--offline: not cached yet: "${request.text.slice(0, 60)}…"`);
  console.log(`  üretiliyor (${provider.cost(request)} karakter): ${request.text.slice(0, 72)}`);
  const res = await provider.synthesize(request);
  writeFileSync(audioFile, res.audio);
  writeFileSync(meta, JSON.stringify({ words: res.words, text: request.text, voice: request.voice }));
  record(ctx.slug, provider, provider.cost(request), request.text);
  return { key, dir, ...res };
};

/** A take of `phrases` (written form), trimmed to its sound: mono pcm with written-word times. */
const take = async (ctx, request, phrases) => {
  const res = await fetchTake(ctx, request);
  const heard = res.words;
  const groups = phrases.flatMap(spokenWords);
  const expected = groups.reduce((n, g) => n + g.length, 0);
  if (heard.length !== expected) throw new Error(`"${request.text}": ${heard.length} aligned words, expected ${expected}`);
  const written = phrases.flatMap((p) => p.split(" "));
  let k = 0;
  const words = groups.map((g, i) => {
    const first = heard[k];
    k += g.length;
    return { text: written[i], start: first.start, end: heard[k - 1].end };
  });
  const raw = readPcm(res.audio);
  const trimmed = trimToSound(raw, analyse(raw), words[words.length - 1].end);
  if (!trimmed) throw new Error(`"${request.text}": the take is silent (${path.relative(ROOT, res.dir)}/${res.key})`);
  const wav = path.join(res.dir, `${res.key}.trim.wav`);
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

const silence = (seconds) => ({ pcm: new Float32Array(Math.round(seconds * SAMPLE_RATE)), words: [] });

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

/** The best take: unflagged first, then the smallest final rise, then the length closest to the main reading. */
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
const measure = (candidates, placeholder) => {
  const todo = candidates.filter((c) => !c.measured);
  if (placeholder) for (const c of todo) Object.assign(c, { flags: [], measured: true });
  else {
    const results = measureProsody(todo.map((c, i) => ({ id: i, ...c.measure, kind: c.kind })));
    for (const m of results) Object.assign(todo[m.id], { rise: m.rise, decay: m.decay, flags: m.flags, measured: true });
  }
  for (const c of candidates) c.duration = c.measure.end - c.measure.start;
};

const candidate = (clip, phrases, fields) => {
  const seen = inspect(clip, phrases);
  return { ...fields, ...clip, measure: { wav: clip.wav, start: seen.bounds[0].onset, end: seen.bounds.at(-1).offset, quietDb: seen.quietDb } };
};

/** The provider, voice and model a run uses: flags, then voiceover.tts, then the provider's defaults. */
const voiceOf = (spec, voiceArg, flags) => {
  const tts = spec.voiceover.tts;
  const provider = providerOf(flags.provider ?? tts?.provider ?? "elevenlabs");
  const same = tts?.provider === provider.id;
  const voice = voiceArg ?? (same ? tts.voice : undefined) ?? provider.defaults.voice;
  const model = flags.model ?? (same ? tts.model : undefined) ?? provider.defaults.model;
  if (!voice) throw new Error(`Usage: build <slug> <voice> (or set voiceover.tts.voice in spec.json) — npm run voiceover -- voices --provider ${provider.id}`);
  return { provider, voice, model, takes: provider.placeholder ? 0 : (tts?.takes ?? DEFAULT_TAKES), budget: tts?.budget };
};

const build = async (slug, voiceArg, flags) => {
  const { file: specFile, json, spec } = loadSpec(slug);
  const { provider, voice, model, takes, budget } = voiceOf(spec, voiceArg, flags);
  const tts = spec.voiceover.tts;
  let specChanged = false;
  if (tts?.provider !== provider.id || tts?.voice !== voice || tts?.model !== model) {
    if (spec.voiceover.picks.length && tts) console.warn(`voice changed: the picks in spec.json were made for ${tts.provider}:${tts.voice}`);
    json.voiceover.tts = { ...json.voiceover.tts, provider: provider.id, voice, ...(model ? { model } : {}) };
    if (!model) delete json.voiceover.tts.model;
    specChanged = true;
  }
  const speed = flags.speed ?? 1;
  const ctx = { slug, provider, budget, offline: flags.offline, estimateOnly: flags.estimate, overBudget: flags["over-budget"] };
  const placeholder = provider.placeholder;

  const sections = spec.voiceover.sections;
  const phrases = sections.flatMap((s) => s.phrases);
  const sectionAt = sections.flatMap((s, k) => s.phrases.map(() => k));
  const parts = sentencesOf(sections).map((sentence) => ({ sentence, section: sectionAt[sentence.first], phrases: phrases.slice(sentence.first, sentence.last + 1) }));
  const all = parts.map((p) => p.sentence.text);
  const request = (part, i, seed) => ({
    text: spoken(part.phrases.join(" ")),
    phrases: part.phrases.map(spoken),
    pauses: part.phrases.map((p) => pauseAfter(p)),
    previous: spoken(all.slice(Math.max(0, i - CONTEXT_SENTENCES), i).join(" ")),
    next: spoken(all.slice(i + 1, i + 1 + CONTEXT_SENTENCES).join(" ")),
    seed: seed === 0 ? seedOf(part.sentence.text) : seed,
    speed,
    voice,
    model,
    stress: (sections[part.section].stress ?? []).map(spoken),
  });

  const picks = new Map(spec.voiceover.picks.map((p) => [p.sentence, p.seed]));
  const known = new Set(all);
  for (const p of spec.voiceover.picks) if (!known.has(p.sentence)) console.warn(`pick ignored, no such sentence any more: "${p.sentence}"`);
  const pickedSeed = (part) => (placeholder ? undefined : picks.get(part.sentence.text) || undefined);

  const main = parts.map((p, i) => request(p, i, 0));
  const pickedFirst = parts.flatMap((p, i) => (pickedSeed(p) ? [request(p, i, pickedSeed(p))] : []));
  await spend(ctx, [...main, ...pickedFirst], "Ana okuma");
  if (flags.estimate) {
    const alternatives = parts.flatMap((p, i) => Array.from({ length: takes }, (_, k) => request(p, i, k + 1)));
    const { chars } = estimate(provider, alternatives);
    console.log(`Alternatifler: en fazla ${chars} karakter (yalnız tonlaması işaretlenen cümleler, cümle başına ${takes})`);
    return;
  }
  for (const [i, part] of parts.entries()) {
    part.original = candidate(await take(ctx, main[i], part.phrases), part.phrases, { seed: 0, label: "Ana okuma", kind: part.sentence.kind });
  }
  measure(parts.map((p) => p.original), placeholder);

  const seedsOf = (part) => (part.original.flags.length ? Array.from({ length: takes }, (_, k) => k + 1) : pickedSeed(part) ? [pickedSeed(part)] : []);
  const alternatives = parts.flatMap((part, i) => seedsOf(part).map((seed) => ({ part, seed, request: request(part, i, seed) })));
  await spend(ctx, alternatives.map((a) => a.request), "Alternatifler");
  for (const part of parts) part.candidates = [part.original];
  for (const { part, seed, request: r } of alternatives) {
    part.candidates.push(candidate(await take(ctx, r, part.phrases), part.phrases, { seed, label: `Alternatif ${seed}`, kind: part.sentence.kind }));
  }
  measure(parts.flatMap((p) => p.candidates), placeholder);
  for (const part of parts) {
    const auto = rank(part.candidates);
    auto.auto = true;
    const picked = part.candidates.find((c) => c.seed === picks.get(part.sentence.text));
    if (picked) picked.picked = true;
    part.chosen = picked ?? auto;
  }

  const plan = [];
  const assembled = [];
  let prevEnd = -Infinity;
  for (const [k, section] of sections.entries()) {
    // Sentences are read apart, so the pause between two is laid in here; pauses inside one open in its silences.
    const mine = parts.filter((p) => p.section === k);
    const pieces = mine.flatMap((p, j) => (j < mine.length - 1 ? [p.chosen, silence(pauseAfter(p.phrases.at(-1)))] : [p.chosen]));
    const joined = withPauses(concat(pieces), section.phrases);
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
  const files = voiceFiles(slug, { draft: placeholder });
  if (placeholder && existsSync(voiceFiles(slug).timing)) {
    console.warn(`${slug}: a real voice-over exists (videos/${slug}/timing.json) and stays in use; this draft is written beside it`);
  }
  const voOut = path.join(ROOT, "public", files.audio);
  writeVoice(voOut, pcm);

  // Phrase bounds in timing.json are where the sound starts and stops, so captions and qa follow what is heard.
  const ranges = phraseRanges(phrases);
  const final = phraseBounds(analyse(pcm), words, ranges).bounds;
  ranges.forEach(([first], i) => (words[first].start = Math.max(words[first].start, final[i].onset)));
  const timing = {
    source: placeholder ? `placeholder:${provider.id}/${voice}` : `${provider.id}:${voice}${model ? `/${model}` : ""}`,
    audio: files.audio,
    phrases: phrases.map((text, i) => ({ text, start: round2(final[i].onset), end: round2(final[i].offset) })),
    words: words.map((w) => ({
      text: w.text,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
      timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
      confidence: null,
    })),
  };
  const timingFile = files.timing;
  writeFileSync(timingFile, `${JSON.stringify(timing, null, 2)}\n`);
  if (!placeholder) for (const f of removeDraftVoice(slug)) console.log(`draft removed: ${path.relative(ROOT, f)}`);
  if (specChanged) writeFileSync(specFile, `${formatSpec(json)}\n`);
  console.log(`Bu videonun seslendirme harcaması: ${readLedger(slug).spent} karakter (out/${slug}/tts-ledger.json)`);

  if (placeholder) console.log(`\nGeçici ses (${voice}): taslak, tonlama ölçülmedi. Render yalnız --draft ile → out/${slug}.draft.mp4, yayına uygun değil.`);
  else {
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
    console.log(`${path.relative(ROOT, review)} — listen and choose: npm run review -- ${slug}`);
  }
  console.log(path.relative(ROOT, voOut));
  console.log(path.relative(ROOT, timingFile));
  if (specChanged) console.log(`${path.relative(ROOT, specFile)}${flags.widen ? " (windows and durationSec moved — check marks tied to sections)" : ""}`);
};

/** A section read sentence by sentence and joined with its STYLE pauses, as build does. */
const readSection = async (ctx, section, voice) => {
  const pieces = [];
  const sentences = sentencesOf([section]);
  for (const [j, sentence] of sentences.entries()) {
    const phrases = section.phrases.slice(sentence.first, sentence.last + 1);
    const request = {
      text: spoken(phrases.join(" ")),
      phrases: phrases.map(spoken),
      pauses: phrases.map((p) => pauseAfter(p)),
      seed: seedOf(sentence.text),
      speed: 1,
      voice,
      stress: [],
    };
    pieces.push(await take(ctx, request, phrases));
    if (j < sentences.length - 1) pieces.push(silence(pauseAfter(phrases.at(-1))));
  }
  return withPauses(concat(pieces), section.phrases);
};

const listen = async (file, flags) => {
  const provider = providerOf(flags.provider ?? "say");
  if (!provider.placeholder) throw new Error("listen only reads drafts with the free placeholder voice (--provider say); it never spends credits");
  const draft = readDraft(path.resolve(file));
  const slug = requireSlug(draft.slug);
  const ctx = { slug, provider };
  const voice = provider.defaults.voice;
  const dir = path.join(outDir(slug), "metin", "ses");
  mkdirSync(dir, { recursive: true });
  const only = flags.sections?.split(",");
  const variants = only
    ? [{ name: `tam-${only.join("-")}`, sections: draft.sections.filter((s) => only.includes(s.id)) }]
    : variantsOf(draft);
  if (only && variants[0].sections.length !== only.length) throw new Error(`--sections: no such section among ${draft.sections.map((s) => s.id).join(", ")}`);
  for (const variant of variants) {
    const clips = [];
    const rows = [];
    for (const [k, section] of variant.sections.entries()) {
      const clip = await readSection(ctx, section, voice);
      const window = section.window ? section.window[1] - section.window[0] : undefined;
      rows.push(`${section.id} ${(clip.pcm.length / SAMPLE_RATE).toFixed(1)} sn${window ? ` / pencere ${window.toFixed(1)}` : ""}`);
      clips.push(clip);
      if (k < variant.sections.length - 1) clips.push(silence(PAUSE.section));
    }
    const out = path.join(dir, `${variant.name}.wav`);
    const all = concat([silence(0.3), ...clips, silence(0.5)]);
    writeVoice(out, all.pcm);
    console.log(`${path.relative(ROOT, out)}  ${(all.pcm.length / SAMPLE_RATE).toFixed(1)} sn  (${rows.join(", ")})`);
  }
  console.log(`\nGeçici ses (${voice}): yalnız metni dinlemek için; tonlama ve hız gerçek sesi temsil etmez. Spec, timing.json ve vo.wav değişmedi.`);
};

const { positional, flags } = parseArgs(process.argv.slice(2), {
  model: "string",
  speed: "number",
  widen: "boolean",
  offline: "boolean",
  provider: "string",
  estimate: "boolean",
  "over-budget": "boolean",
  sections: "string",
});
const [cmd, ...args] = positional;
const speed = flags.speed ?? 1;
if (!(speed >= SPEED_RANGE[0] && speed <= SPEED_RANGE[1])) {
  console.error(`--speed must be between ${SPEED_RANGE[0]} and ${SPEED_RANGE[1]}`);
  process.exit(1);
}

if (cmd === "voices") {
  const provider = providerOf(flags.provider ?? "elevenlabs");
  if (provider.id === "say") {
    console.log(spawnSync("say", ["-v", "?"], { encoding: "utf8" }).stdout.split("\n").filter((l) => /tr_TR/.test(l)).join("\n"));
  } else if (provider.id === "azure") {
    console.log("Turkish neural voices: tr-TR-EmelNeural (female), tr-TR-AhmetNeural (male)");
  } else {
    const models = await api("GET", "/models");
    console.log("Models with Turkish text-to-speech:");
    for (const m of models.filter((m) => m.can_do_text_to_speech && (m.languages ?? []).some((l) => l.language_id === "tr"))) {
      console.log(`  ${m.model_id.padEnd(28)} ${m.name}`);
    }
    const { voices } = await api("GET", "/voices");
    console.log("Voices on this account:");
    for (const v of voices) console.log(`  ${v.voice_id}  ${v.name.padEnd(22)} [${v.category}] ${Object.values(v.labels ?? {}).join(", ")}`);
  }
} else if (cmd === "sample") {
  const slug = requireSlug(args.shift());
  const { spec } = loadSpec(slug);
  const provider = providerOf(flags.provider ?? spec.voiceover.tts?.provider ?? "elevenlabs");
  const section = spec.voiceover.sections[0];
  const requests = (args.length ? args : [provider.defaults.voice]).filter(Boolean).map((voice) => ({
    text: spoken(section.phrases.join(" ")),
    phrases: section.phrases.map(spoken),
    pauses: section.phrases.map((p) => pauseAfter(p)),
    seed: seedOf(section.phrases.join(" ")),
    speed,
    voice,
    model: flags.model ?? provider.defaults.model,
    stress: (section.stress ?? []).map(spoken),
  }));
  const ctx = { slug, provider, budget: spec.voiceover.tts?.budget, overBudget: flags["over-budget"], estimateOnly: flags.estimate };
  await spend(ctx, requests, "Ses örnekleri");
  if (!flags.estimate) {
    const dir = path.join(outDir(slug), "voice-samples");
    mkdirSync(dir, { recursive: true });
    for (const r of requests) {
      const res = await fetchTake(ctx, r);
      const file = path.join(dir, `${provider.id}-${r.voice}.${provider.ext}`);
      writeFileSync(file, res.audio);
      console.log(path.relative(ROOT, file));
    }
  }
} else if (cmd === "build") {
  await build(requireSlug(args[0]), args[1], flags);
} else if (cmd === "listen") {
  if (!args[0]) throw new Error("Usage: listen <out/<slug>/metin/metin.json> [--provider say]");
  await listen(args[0], flags);
} else if (cmd === "pick") {
  const slug = requireSlug(args[0]);
  const [n, seed] = [Number(args[1]), Number(args[2])];
  const { file, json, spec } = loadSpec(slug);
  const all = sentencesOf(spec.voiceover.sections);
  const sentence = all[n - 1];
  const takes = spec.voiceover.tts?.takes ?? DEFAULT_TAKES;
  if (!sentence || !(Number.isInteger(seed) && seed >= 0 && seed <= takes)) {
    console.error(`Usage: pick <slug> <sentence 1–${all.length}> <take 0–${takes}>`);
    process.exit(1);
  }
  json.voiceover.picks = [...(json.voiceover.picks ?? []).filter((p) => p.sentence !== sentence.text), { sentence: sentence.text, seed }];
  writeFileSync(file, `${formatSpec(json)}\n`);
  console.log(`${path.relative(ROOT, file)}: sentence ${n} → take ${seed}`);
  const res = spawnSync(process.execPath, [path.join(ROOT, "scripts/voiceover.mjs"), "build", slug, "--offline"], { stdio: "inherit" });
  process.exit(res.status ?? 1);
} else {
  console.error(
    `Usage: node scripts/voiceover.mjs voices [--provider ${Object.keys(PROVIDERS).join("|")}]\n` +
      "                                | sample <slug> <voice>... [--provider p] [--model id] [--speed 1.0] [--estimate]\n" +
      "                                | build <slug> [voice] [--provider p] [--model id] [--speed 1.0] [--widen] [--offline] [--estimate] [--over-budget]\n" +
      "                                | pick <slug> <sentence#> <take>\n" +
      "                                | listen <metin.json> [--provider say] [--sections id,id]",
  );
  process.exit(1);
}
