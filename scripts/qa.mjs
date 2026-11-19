// Automatic quality checks (STYLE.md). Layout runs in the browser bundle before any render; audio checks the render.
//   node scripts/qa.mjs <slug> [--layout] [--audio] [--every 0.25]
//   No flag: layout, plus audio when out/<slug>.mp4 exists. Writes out/<slug>/qa.json and exits 1 on any error.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { endsSentence } from "../src/spec/pauses.ts";
import { parseArgs } from "./lib/args.mjs";
import { ROOT, duration, loadSpec, outDir, requireSlug, videoDir } from "./lib/video.mjs";

const SAFE_RIGHT = 960;
const SAFE_BOTTOM = 1632;
const FPS = 30;
/** Words per second while speaking (pauses excluded), and the breathing-room limits between sentences. */
const SPOKEN_RATE = [2.6, 3.0];
const PAUSES = { shortSentence: 0.25, meanSentence: 0.35 };
const SILENCE = { noiseDb: -70, minSec: 0.3, tailSec: 0.7 };
/** A data line's box must be empty background: no pixel brighter than `luma` beyond these shares. */
const CLUTTER = { luma: 70, share: 0.004, line: 0.35 };

const { positional, flags } = parseArgs(process.argv.slice(2), { layout: "boolean", audio: "boolean", every: "number" });
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
  const logs = { boxes: null, spec: null };
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
    },
  });
  return { ...logs, durationInFrames: composition.durationInFrames };
};

const overlap = (a, b) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 2 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 2;

/** Anything drawn behind a data line: share of bright pixels in its box, and the fullest row or column (a line). */
const drawingInBox = (png, box) => {
  const x = Math.max(0, Math.floor(box.x1) - 4);
  const y = Math.max(0, Math.floor(box.y1) - 4);
  const w = Math.min(1080 - x, Math.ceil(box.x2 - box.x1) + 8);
  const h = Math.min(1920 - y, Math.ceil(box.y2 - box.y1) + 8);
  if (w < 4 || h < 4) return { share: 0, line: 0 };
  const { stdout } = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", png, "-vf", `crop=${w}:${h}:${x}:${y},format=gray`, "-f", "rawvideo", "-"],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const bright = (v) => v > CLUTTER.luma;
  let best = 0;
  let total = 0;
  for (let r = 0; r < h; r++) {
    let n = 0;
    for (let c = 0; c < w; c++) n += bright(stdout[r * w + c]) ? 1 : 0;
    total += n;
    best = Math.max(best, n / w);
  }
  for (let c = 0; c < w; c++) {
    let n = 0;
    for (let r = 0; r < h; r++) n += bright(stdout[r * w + c]) ? 1 : 0;
    best = Math.max(best, n / h);
  }
  return { share: total / (w * h), line: best };
};

const layout = async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), `qa-${slug}-`));
  const first = await probe(0, { probe: true }, path.join(tmp, "probe.png"));
  const last = first.durationInFrames - 1;
  const frames = [];
  for (let f = 0; f <= last; f += Math.max(1, Math.round(every * FPS))) frames.push(f);
  if (frames.at(-1) !== last) frames.push(last);

  const overlaps = spans();
  const unsafe = spans();
  const seen = new Map();
  for (const frame of frames) {
    const { boxes } = frame === 0 ? first : await probe(frame, { probe: true }, path.join(tmp, "probe.png"));
    if (!boxes) continue;
    for (const b of boxes.boxes) {
      const list = seen.get(b.id) ?? [];
      if (!list.length || frame - list.at(-1).frame >= FPS) list.push({ t: boxes.t, frame, box: b });
      seen.set(b.id, list);
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

  const clutter = spans();
  for (const list of seen.values()) {
    for (const { t, frame, box } of list) {
      if (box.kind !== "label" && box.kind !== "note") continue;
      const png = path.join(tmp, `bg-${frame}.png`);
      if (!existsSync(png)) await probe(frame, { probe: false, overlays: false }, png);
      const { share, line } = drawingInBox(png, box);
      if (share > CLUTTER.share || line > CLUTTER.line) {
        clutter.add(box.id, t, `${box.id} "${box.text}" kutusuna çizim giriyor (parlak piksel %${(share * 100).toFixed(1)}, en dolu satır/sütun %${Math.round(line * 100)})`);
      }
    }
  }
  errors.push(...clutter.list().map((m) => `etiket alanı: ${m}`));
  rmSync(tmp, { recursive: true, force: true });
  return { frames: frames.length, sound: first.spec?.sound };
};

const audio = async (sound) => {
  if (!existsSync(mp4)) {
    errors.push(`ses: ${path.relative(ROOT, mp4)} yok — önce npm run render -- ${slug}`);
    return {};
  }
  const end = duration(mp4);

  const timingFile = path.join(videoDir(slug), "timing.json");
  const rates = {};
  if (!existsSync(timingFile)) warnings.push("konuşma: timing.json yok (taslak ses hizalanmadı)");
  else {
    const { phrases, words } = JSON.parse(readFileSync(timingFile, "utf8"));
    const spoken = phrases.reduce((sum, p) => sum + (p.end - p.start), 0);
    rates.spoken = words.length / spoken;
    if (rates.spoken < SPOKEN_RATE[0] || rates.spoken > SPOKEN_RATE[1]) {
      warnings.push(`konuşma hızı: konuşulan sürede ${rates.spoken.toFixed(2)} kelime/sn (hedef ${SPOKEN_RATE.join("–")})`);
    }
    const gaps = phrases.slice(0, -1).map((p, i) => ({ p, gap: phrases[i + 1].start - p.end }));
    const sentences = gaps.filter(({ p }) => endsSentence(p.text));
    for (const { p, gap } of sentences) {
      if (gap < PAUSES.shortSentence) warnings.push(`duraklama: ${fmt(p.end)} "${p.text}" sonrası ${gap.toFixed(2)} sn (en az ${PAUSES.shortSentence})`);
    }
    rates.meanSentencePause = sentences.length ? sentences.reduce((sum, g) => sum + g.gap, 0) / sentences.length : 0;
    rates.minPause = gaps.length ? Math.min(...gaps.map((g) => g.gap)) : 0;
    if (sentences.length && rates.meanSentencePause < PAUSES.meanSentence) {
      errors.push(`duraklama: cümle aralarının ortalaması ${rates.meanSentencePause.toFixed(2)} sn (en az ${PAUSES.meanSentence})`);
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
  return { rates, silences: starts.length };
};

const sound = runLayout ? (await layout()).sound : (await probe(0, { probe: true }, path.join(os.tmpdir(), `qa-${slug}.png`))).spec?.sound;
const audioResult = runAudio ? await audio(sound) : null;
if (browserState) await browserState.instance.close({ silent: true });

const report = { slug, checked: { layout: runLayout, audio: runAudio }, errors, warnings, audio: audioResult };
mkdirSync(outDir(slug), { recursive: true });
writeFileSync(path.join(outDir(slug), "qa.json"), `${JSON.stringify(report, null, 2)}\n`);

const rows = [
  ["Yerleşim (çakışma, güvenli alan)", runLayout ? (errors.some((e) => /^(yerleşim|güvenli alan)/.test(e)) ? "HATA" : "temiz") : "—"],
  ["Etiket alanı (çizgi/nesne)", runLayout ? (errors.some((e) => e.startsWith("etiket alanı")) ? "HATA" : "temiz") : "—"],
  ["Konuşma hızı (konuşulan süre)", runAudio ? (warnings.some((w) => w.startsWith("konuşma")) ? "uyarı" : "temiz") : "—"],
  ["Duraklamalar", runAudio ? (errors.some((e) => e.startsWith("duraklama")) ? "HATA" : warnings.some((w) => w.startsWith("duraklama")) ? "uyarı" : "temiz") : "—"],
  ["Dijital sessizlik", runAudio ? (errors.some((e) => e.startsWith("sessizlik")) ? "HATA" : "temiz") : "—"],
  ["Yatak sürekliliği", runAudio ? (errors.some((e) => e.startsWith("yatak")) ? "HATA" : warnings.some((w) => w.startsWith("yatak")) ? "uyarı" : "temiz") : "—"],
];
console.log(`\nQA ${slug}`);
for (const [name, result] of rows) console.log(`  ${name.padEnd(36)} ${result}`);
if (audioResult?.rates?.spoken) {
  console.log(`  ${"Kelime/sn (konuşulan süre)".padEnd(36)} ${audioResult.rates.spoken.toFixed(2)}`);
  console.log(`  ${"Cümle arası ort. / en kısa ara".padEnd(36)} ${audioResult.rates.meanSentencePause.toFixed(2)} / ${audioResult.rates.minPause.toFixed(2)} sn`);
}
for (const e of errors) console.log(`  ✗ ${e}`);
for (const w of warnings) console.log(`  ! ${w}`);
console.log(errors.length ? `\n${errors.length} hata, ${warnings.length} uyarı → ${path.relative(ROOT, outDir(slug))}/qa.json` : `\nOK (${warnings.length} uyarı)`);
if (errors.length) process.exitCode = 1;
