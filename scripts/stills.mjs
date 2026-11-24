// Stills from one bundle and one browser.
//   node scripts/stills.mjs <slug> <frame|12.5s>... [--every N] [--out dir] [--sheet] [--ground]
//   → out/<slug>/stills/f0450.png … (+ sheet.png: a contact sheet of exactly these frames)
//   --ground: the ground in qa's key colour, as qa's emptiness measure sees the frame.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { FPS_DEFAULT, parseArgs } from "./lib/args.mjs";
import { ROOT, ffmpeg, outDir, requireSlug } from "./lib/video.mjs";

const { positional, flags } = parseArgs(process.argv.slice(2), { every: "number", out: "string", sheet: "boolean", ground: "boolean" });
const slug = requireSlug(positional.shift());
const picks = positional.map((p) => (p.endsWith("s") ? Math.round(Number(p.slice(0, -1)) * FPS_DEFAULT) : Number(p)));
if (picks.some((f) => !Number.isInteger(f) || f < 0) || (picks.length === 0 && !flags.every)) {
  console.error("Usage: node scripts/stills.mjs <slug> <frame|12.5s>... [--every N] [--out dir] [--sheet] [--ground]");
  process.exit(1);
}

const chromiumOptions = { gl: "angle" };
const inputProps = flags.ground ? { qa: { ground: true } } : {};
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts") });
const browser = await openBrowser("chrome", { chromiumOptions });
const composition = await selectComposition({ serveUrl, id: slug, inputProps, puppeteerInstance: browser, chromiumOptions });
const last = composition.durationInFrames - 1;
const every = flags.every ? Array.from({ length: Math.floor(last / flags.every) + 1 }, (_, i) => i * flags.every) : [];
const frames = [...new Set([...picks.map((f) => Math.min(f, last)), ...every])].sort((a, b) => a - b);

const dir = flags.out ? path.resolve(flags.out) : path.join(outDir(slug), "stills");
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (f.endsWith(".png")) rmSync(path.join(dir, f));

const files = [];
for (const frame of frames) {
  const output = path.join(dir, `f${String(frame).padStart(4, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output, inputProps, puppeteerInstance: browser, chromiumOptions, overwrite: true });
  files.push(output);
  console.log(path.relative(ROOT, output));
}
await browser.close({ silent: true });

if (flags.sheet && files.length > 0) {
  const cols = Math.min(6, files.length);
  const rows = Math.ceil(files.length / cols);
  const list = path.join(dir, "sheet.txt");
  writeFileSync(list, files.map((f) => `file '${f}'`).join("\n"));
  const sheet = path.join(dir, "sheet.png");
  ffmpeg("-f", "concat", "-safe", "0", "-i", list, "-vf", `scale=270:-2,tile=${cols}x${rows}:padding=6:color=black`, "-frames:v", "1", sheet);
  rmSync(list);
  console.log(path.relative(ROOT, sheet));
}
