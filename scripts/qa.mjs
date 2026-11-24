// Automatic quality checks (STYLE.md). Layout runs in the browser bundle before any render; audio checks the render.
//   node scripts/qa.mjs <slug> [--layout] [--audio] [--every 0.25] [--from s] [--to s]
//   --from/--to: layout only over that stretch (for iterating on a section); the full run decides.
//   No flag: layout, plus audio when out/<slug>.mp4 exists. Writes out/<slug>/qa.json and exits 1 on any error.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { GROUND_KEY } from "../src/kit/ground.ts";
import { quantityMismatches } from "../src/spec/quantities.ts";
import { parseArgs } from "./lib/args.mjs";
import { composition, coverFindings } from "./lib/composition.mjs";
import { flagText } from "./lib/review.mjs";
import { speechReport } from "./lib/speech.mjs";
import { ROOT, duration, loadSpec, loadTiming, outDir, readPcm, requireSlug } from "./lib/video.mjs";

const SAFE_RIGHT = 960;
const SAFE_BOTTOM = 1632;
const FPS = 30;
/** Words per second while speaking (pauses excluded), and the breathing-room limits between sentences. */
const SPOKEN_RATE = [2.6, 3.0];
const PAUSES = { shortSentence: 0.25, meanSentence: 0.35 };
const SILENCE = { noiseDb: -70, minSec: 0.3, tailSec: 0.7 };
/** Ground under darken, a panel or a shadow is GROUND_KEY darkened; minShade keeps near-black content (water) out. */
const GROUND = { tolerance: 12, minShade: 0.1 };
/** Longer than this with no change on screen is a freeze (ffmpeg freezedetect noise in dB). */
const FREEZE = { seconds: 0.3, noiseDb: -60 };

const { positional, flags } = parseArgs(process.argv.slice(2), { layout: "boolean", audio: "boolean", every: "number", from: "number", to: "number" });
const inRange = (t) => t >= (flags.from ?? 0) && t <= (flags.to ?? Infinity);
const slug = requireSlug(positional[0]);
const { json: rawSpec } = loadSpec(slug);
const mp4 = path.join(ROOT, "out", `${slug}.mp4`);
const runLayout = flags.layout || !flags.audio;
const runAudio = flags.audio || (!flags.layout && existsSync(mp4));
const every = flags.every ?? 0.25;

const errors = [];
const warnings = [];
const fmt = (t) => `${t.toFixed(2)} s`;

/** Collapse a stream of (key, t) findings into one line per key with its time span. */
const spans = () => {
  const map = new Map();
  return {
    add: (key, t, message) => {
      const s = map.get(key);
      if (s) s.to = t;
      else map.set(key, { from: t, to: t, message });
    },
    list: () => [...map.values()].map((s) => `${s.from === s.to ? fmt(s.from) : `${fmt(s.from)}–${fmt(s.to)}`}: ${s.message}`),
  };
};

const chromiumOptions = { gl: "angle" };
let browserState = null;
const browser = async () => {
  if (browserState) return browserState;
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts") });
  const instance = await openBrowser("chrome", { chromiumOptions });
  browserState = { serveUrl, instance };
  return browserState;
};

/** Renders one frame and returns what QaProbe logged (boxes, resolved soundtrack). */
const probe = async (frame, qa, output) => {
  const { serveUrl, instance } = await browser();
  const inputProps = { qa };
  const composition = await selectComposition({ serveUrl, id: slug, inputProps, puppeteerInstance: instance, chromiumOptions });
  const logs = { boxes: null, spec: null, scene: null };
  // A scene logs again when it renders again (a 3D model that loaded): the last report per layer counts.
  const layers = new Map();
  await renderStill({
    serveUrl,
    composition,
    frame,
    output,
    inputProps,
    puppeteerInstance: instance,
    chromiumOptions,
    overwrite: true,
    scale: qa.probe ? 0.25 : 1,
    onBrowserLog: ({ text }) => {
      if (text.startsWith("QA_BOXES ")) logs.boxes = JSON.parse(text.slice(9));
      if (text.startsWith("QA_SPEC ")) logs.spec = JSON.parse(text.slice(8));
      if (text.startsWith("QA_SCENE ")) logs.scene = JSON.parse(text.slice(9));
      if (text.startsWith("QA_LAYER ")) {
        const r = JSON.parse(text.slice(9));
        layers.set(r.layer, r);
      }
    },
  });
  if (logs.scene) logs.scene.layers = [...layers.values()];
  return { ...logs, durationInFrames: composition.durationInFrames };
};

const overlap = (a, b) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 2 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 2;

/** Share of a full-size frame that is empty: 40 px cells showing nothing but ground (rendered in GROUND_KEY). */
const emptyShare = (png) => {
  const [W, H, C] = [1080, 1920, 40];
  const { stdout } = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", png, "-vf", `scale=${W}:${H}`, "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stdout.length < W * H * 3) return null;
  const [kr, kg, kb] = GROUND_KEY;
  const kk = kr * kr + kg * kg + kb * kb;
  const isGround = (i) => {
    const [r, g, b] = [stdout[i], stdout[i + 1], stdout[i + 2]];
    const k = (r * kr + g * kg + b * kb) / kk;
    return k >= GROUND.minShade && (r - k * kr) ** 2 + (g - k * kg) ** 2 + (b - k * kb) ** 2 <= GROUND.tolerance ** 2;
  };
  let empty = 0;
  for (let cy = 0; cy < H; cy += C) {
    for (let cx = 0; cx < W; cx += C) {
      let ground = true;
      for (let y = cy; y < cy + C && ground; y++) {
        for (let x = cx; x < cx + C && ground; x++) ground = isGround((y * W + x) * 3);
      }
      if (ground) empty++;
    }
  }
  return empty / ((W / C) * (H / C));
};

/** STYLE "Kapak": the first seconds, every COVER.every frames, judged with no grace; frame 0 saved as cover.png. */
const COVER = { seconds: 3, every: 2 };
const cover = async (tmp, first, last, labelAlign) => {
  const samples = [];
  for (let frame = 0; frame <= Math.min(last, COVER.seconds * FPS); frame += COVER.every) {
    const { boxes, scene } = frame === 0 ? first : await probe(frame, { probe: true }, path.join(tmp, "probe.png"));
    if (!boxes || !scene) continue;
    const full = path.join(tmp, "full.png");
    await probe(frame, { probe: false, ground: true }, full);
    samples.push({ t: boxes.t, boxes: boxes.boxes, strict: boxes.strict, band: boxes.band, scene, empty: emptyShare(full) });
  }
  await probe(0, {}, path.join(outDir(slug), "cover.png"));
  return coverFindings({ samples, labelAlign, titled: rawSpec.titles.length > 0 });
};

const layout = async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), `qa-${slug}-`));
  const first = await probe(0, { probe: true }, path.join(tmp, "probe.png"));
  const last = first.durationInFrames - 1;
  let frames = [];
  for (let f = 0; f <= last; f += Math.max(1, Math.round(every * FPS))) frames.push(f);
  if (frames.at(-1) !== last) frames.push(last);
  frames = frames.filter((f) => inRange(f / FPS));

  const overlaps = spans();
  const unsafe = spans();
  const samples = [];
  for (const [i, frame] of frames.entries()) {
    const png = path.join(tmp, "probe.png");
    const { boxes, scene } = frame === 0 ? first : await probe(frame, { probe: true }, png);
    if (!boxes) continue;
    // Emptiness needs the full-size frame (fine lines vanish at probe size); every other sample is enough.
    let empty = null;
    if (i % 2 === 0) {
      const full = path.join(tmp, "full.png");
      await probe(frame, { probe: false, ground: true }, full);
      empty = emptyShare(full);
    }
    if (scene) samples.push({ t: boxes.t, boxes: boxes.boxes, band: boxes.band, scene, empty });
    for (const b of boxes.boxes) {
      if (b.x2 > SAFE_RIGHT + 0.5) unsafe.add(`${b.id}:right`, boxes.t, `${b.id} "${b.text}" reaches x ${Math.round(b.x2)} (right safe area starts at ${SAFE_RIGHT})`);
      if (b.y2 > SAFE_BOTTOM + 0.5) unsafe.add(`${b.id}:bottom`, boxes.t, `${b.id} "${b.text}" reaches y ${Math.round(b.y2)} (bottom safe area starts at ${SAFE_BOTTOM})`);
      if (b.x1 < -0.5) unsafe.add(`${b.id}:left`, boxes.t, `${b.id} "${b.text}" starts off-screen (x ${Math.round(b.x1)})`);
    }
    for (let i = 0; i < boxes.boxes.length; i++) {
      for (let j = i + 1; j < boxes.boxes.length; j++) {
        const [a, b] = [boxes.boxes[i], boxes.boxes[j]];
        if (overlap(a, b)) overlaps.add(`${a.id}|${b.id}`, boxes.t, `${a.id} "${a.text}" overlaps ${b.id} "${b.text}"`);
      }
    }
  }
  errors.push(...overlaps.list().map((m) => `yerleşim: ${m}`), ...unsafe.list().map((m) => `güvenli alan: ${m}`));

  mkdirSync(outDir(slug), { recursive: true });
  writeFileSync(path.join(outDir(slug), "qa-samples.json"), JSON.stringify(samples));
  const labelOf = (id) => rawSpec.labels[Number(/\[(\d+)\]/.exec(id)?.[1])];
  const labelAlign = (id) => labelOf(id)?.align ?? "left";
  const labelPointTo = (id) => labelOf(id)?.pointTo;
  const found = composition({
    samples,
    step: frames.length > 1 ? (frames[1] - frames[0]) / FPS : every,
    labelAlign,
    labelPointTo,
    phrases: (first.spec?.phrases ?? []).filter((p) => inRange(p.start) && inRange(p.end)),
    transitions: (first.spec?.transitions ?? []).filter((tr) => inRange(tr.at)),
    sections: (first.spec?.sections ?? []).filter((s) => inRange(s.window[0]) && inRange(s.window[1])),
  });
  for (const f of first.spec?.findings ?? []) errors.push(f.replace(/^transitions: /, "geçiş: ").replace(/^camera: /, "kamera: "));
  errors.push(...found.errors);
  warnings.push(...found.warnings);
  if (inRange(0)) errors.push(...(await cover(tmp, first, last, labelAlign)));
  rmSync(tmp, { recursive: true, force: true });
  return { frames: frames.length, spec: first.spec, stats: found.stats };
};

/** Stretches of the render where nothing on screen changes. */
const freezes = () => {
  const { stderr } = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", mp4, "-vf", `freezedetect=n=${FREEZE.noiseDb}dB:d=${FREEZE.seconds}`, "-an", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const starts = [...stderr.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const lengths = [...stderr.matchAll(/freeze_duration: ([\d.]+)/g)].map((m) => Number(m[1]));
  starts.forEach((s, i) => errors.push(`donma: ${fmt(s)}–${fmt(s + (lengths[i] ?? FREEZE.seconds))} görüntü değişmiyor (en fazla ${FREEZE.seconds} sn)`));
  return starts.length;
};

/** A label with a unit shown while the voice names another quantity ("akım" under "≈ 1 mV"). */
const quantities = (shown) => {
  for (const m of quantityMismatches(shown?.labels ?? [], shown?.phrases ?? [])) {
    warnings.push(`nicelik: ${fmt(m.at)} etiket "${m.label}" ${m.label_q}, seslendirme "${m.phrase}" ${m.named.join("/")} diyor`);
  }
};

const audio = async (sound) => {
  if (!existsSync(mp4)) {
    errors.push(`ses: ${path.relative(ROOT, mp4)} yok — önce npm run render -- ${slug}`);
    return {};
  }
  const end = duration(mp4);

  // Speech is measured on the voice-over alone (the render has music under it), as the listener hears it.
  const timing = loadTiming(slug);
  const rates = {};
  let intonation = null;
  if (!timing) warnings.push("konuşma: timing.json yok (taslak ses hizalanmadı)");
  else {
    const wav = path.join(ROOT, "public", timing.audio ?? `videos/${slug}/vo.wav`);
    const words = timing.words.map((w) => ({ start: w.startMs / 1000, end: w.endMs / 1000 }));
    const report = speechReport({ wav, pcm: readPcm(wav, { channels: 2 }), channels: 2, words, sections: rawSpec.voiceover.sections });
    // The placeholder voice (macOS say) only times sections and captions: its rate and intonation say nothing.
    const placeholder = timing.source.startsWith("placeholder");
    rates.spoken = report.words / report.spokenSeconds;
    if (!placeholder && (rates.spoken < SPOKEN_RATE[0] || rates.spoken > SPOKEN_RATE[1])) {
      warnings.push(`konuşma hızı: konuşulan sürede ${rates.spoken.toFixed(2)} kelime/sn (hedef ${SPOKEN_RATE.join("–")})`);
    }
    const sentenceEnds = report.pauses.filter((p) => p.sentenceEnd);
    for (const p of sentenceEnds) {
      if (p.length < PAUSES.shortSentence) warnings.push(`duraklama: ${fmt(p.at)} "${p.text}" sonrası ${p.length.toFixed(2)} sn (en az ${PAUSES.shortSentence})`);
    }
    rates.meanSentencePause = sentenceEnds.length ? sentenceEnds.reduce((sum, p) => sum + p.length, 0) / sentenceEnds.length : 0;
    rates.minPause = sentenceEnds.length ? Math.min(...sentenceEnds.map((p) => p.length)) : 0;
    if (sentenceEnds.length && rates.meanSentencePause < PAUSES.meanSentence) {
      errors.push(`duraklama: cümle aralarının ortalaması ${rates.meanSentencePause.toFixed(2)} sn (en az ${PAUSES.meanSentence})`);
    }
    // A recording cannot be regenerated, so its flagged sentences are a list to record again.
    const recorded = timing.source.startsWith("whisper");
    intonation = placeholder
      ? { placeholder: true, sentences: [] }
      : { recorded, sentences: report.sentences.map(({ text, kind, start, rise, decay, flags }) => ({ text, kind, start, rise, decay, flags })) };
    for (const s of placeholder ? [] : report.sentences.filter((x) => x.flags.length)) {
      const values = `yükselme ${s.rise == null ? "—" : `${s.rise.toFixed(1)} yt`}, sönüm ${s.decay == null ? "—" : `${Math.round(s.decay * 1000)} ms`}`;
      warnings.push(`tonlama: ${fmt(s.end)} "${s.text}" ${flagText(s.flags)} (${values})${recorded ? " — yeniden kaydet" : ""}`);
    }
  }

  const { stderr } = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", mp4, "-af", `silencedetect=noise=${SILENCE.noiseDb}dB:d=${SILENCE.minSec}`, "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  starts.forEach((s, i) => {
    if (s < end - SILENCE.tailSec) errors.push(`sessizlik: ${fmt(s)}–${fmt(ends[i] ?? end)} arası ${SILENCE.noiseDb} dB altında`);
  });

  const lengths = JSON.parse(readFileSync(path.join(ROOT, "src/kit/audio/sfx-durations.json"), "utf8"));
  const beds = [
    ...sound.beds.map((b) => ({ name: `yatak "${b.id}"`, at: b.at, length: lengths[b.id], loop: b.loop, fadeOut: b.fadeOut })),
    ...(sound.music
      ? [{ name: `müzik "${sound.music.file}"`, at: sound.music.at ?? 0, length: duration(path.join(ROOT, "public", sound.music.file)), loop: sound.music.loop, fadeOut: sound.music.fadeOut }]
      : []),
  ];
  if (beds.length === 0) warnings.push("yatak: ambiyans ya da müzik yok");
  for (const b of beds) {
    const audibleUntil = Math.min(end, b.fadeOut ? b.fadeOut[1] : end);
    const runsOut = b.at + b.length;
    if (!b.loop && runsOut < audibleUntil - 0.05) {
      errors.push(`yatak: ${b.name} ${fmt(runsOut)}'de bitiyor ama ${fmt(audibleUntil)}'e kadar duyulmalı — loop: true ya da daha erken fadeOut`);
    }
  }
  return { rates, intonation, silences: starts.length };
};

const laid = runLayout ? await layout() : null;
const shown = laid ? laid.spec : (await probe(0, { probe: true }, path.join(os.tmpdir(), `qa-${slug}.png`))).spec;
quantities(shown);
const audioResult = runAudio ? await audio(shown?.sound) : null;
const ranged = flags.from != null || flags.to != null;
const frozen = existsSync(mp4) && !ranged ? freezes() : null;
if (browserState) await browserState.instance.close({ silent: true });

const report = { slug, checked: { layout: runLayout, audio: runAudio }, errors, warnings, audio: audioResult };
mkdirSync(outDir(slug), { recursive: true });
writeFileSync(path.join(outDir(slug), "qa.json"), `${JSON.stringify(report, null, 2)}\n`);

const rows = [
  ["Yerleşim (çakışma, güvenli alan)", runLayout ? (errors.some((e) => /^(yerleşim|güvenli alan)/.test(e)) ? "HATA" : "temiz") : "—"],
  ...[
    ["Önemli öğe (üst yazı altı, kare dışı)", "önemli öğe"],
    ["Özne boyu (≥ %35)", "özne"],
    ["Boş alan (≤ %40)", "boş alan"],
    ["Kenar kırpması", "kenar"],
    ["Bağlam (söylenen yer ekranda)", "bağlam"],
    ["Veri etiketleri", "veri etiketi"],
    ["Kılavuz (etiketten öğeye)", "kılavuz"],
    ["Kapak (ilk 3 sn, kare kare)", "kapak"],
    ["Altyazı (sabit boyut)", "altyazı"],
    ["Bağlam planı (özne bütün ≥ 1 sn)", "siluet"],
    ["Kavram kartı (koyu zemin)", "kart"],
    ["Geçişler", "geçiş"],
    ["Kamera (geniş → yakın)", "kamera"],
  ].map(([name, prefix]) => [
    name,
    runLayout ? (errors.some((e) => e.startsWith(prefix)) ? "HATA" : warnings.some((w) => w.startsWith(prefix)) ? "uyarı" : "temiz") : "—",
  ]),
  ["Donma (render)", frozen === null ? "—" : frozen ? "HATA" : "temiz"],
  ["Konuşma hızı (konuşulan süre)", runAudio ? (audioResult?.intonation?.placeholder ? "— (geçici ses)" : warnings.some((w) => w.startsWith("konuşma")) ? "uyarı" : "temiz") : "—"],
  ["Duraklamalar", runAudio ? (errors.some((e) => e.startsWith("duraklama")) ? "HATA" : warnings.some((w) => w.startsWith("duraklama")) ? "uyarı" : "temiz") : "—"],
  [
    "Tonlama (cümle sonları)",
    audioResult?.intonation?.placeholder
      ? "— (geçici ses)"
      : runAudio && audioResult?.intonation
      ? warnings.some((w) => w.startsWith("tonlama"))
        ? `uyarı${audioResult.intonation.recorded ? " (yeniden kaydet)" : ""}`
        : "temiz"
      : "—",
  ],
  ["Nicelik tutarlılığı", warnings.some((w) => w.startsWith("nicelik")) ? "uyarı" : "temiz"],
  ["Dijital sessizlik", runAudio ? (errors.some((e) => e.startsWith("sessizlik")) ? "HATA" : "temiz") : "—"],
  ["Yatak sürekliliği", runAudio ? (errors.some((e) => e.startsWith("yatak")) ? "HATA" : warnings.some((w) => w.startsWith("yatak")) ? "uyarı" : "temiz") : "—"],
];
console.log(`\nQA ${slug}${flags.from != null || flags.to != null ? ` (yalnız ${flags.from ?? 0}–${flags.to ?? "son"} sn)` : ""}`);
for (const [name, result] of rows) console.log(`  ${name.padEnd(36)} ${result}`);
if (laid?.stats) {
  const { subjectMin, emptyMax } = laid.stats;
  console.log(`  ${"En küçük özne / en boş kare".padEnd(36)} %${Math.round(subjectMin * 100)} / ${emptyMax == null ? "—" : `%${Math.round(emptyMax * 100)}`}`);
}
if (audioResult?.rates?.spoken) {
  console.log(`  ${"Kelime/sn (konuşulan süre)".padEnd(36)} ${audioResult.rates.spoken.toFixed(2)}`);
  console.log(`  ${"Cümle sonu arası ort. / en kısa".padEnd(36)} ${audioResult.rates.meanSentencePause.toFixed(2)} / ${audioResult.rates.minPause.toFixed(2)} sn`);
  const s = audioResult.intonation?.sentences ?? [];
  const checked = s.filter((x) => x.kind === "statement" || x.kind === "wh-question");
  console.log(`  ${"İşaretli cümle (tonlama)".padEnd(36)} ${checked.filter((x) => x.flags.length).length} / ${checked.length}`);
}
for (const e of errors) console.log(`  ✗ ${e}`);
for (const w of warnings) console.log(`  ! ${w}`);
console.log(errors.length ? `\n${errors.length} hata, ${warnings.length} uyarı → ${path.relative(ROOT, outDir(slug))}/qa.json` : `\nOK (${warnings.length} uyarı)`);
if (errors.length) process.exitCode = 1;
