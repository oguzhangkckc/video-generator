// Regression check after a library change.
//   node scripts/compare.mjs <dirA> <dirB> [--min 0.995]   → SSIM of every same-named PNG; diff images for failures
//   node scripts/compare.mjs <a.wav> <b.wav> [--max -60]    → null test: peak of (a − b) in dBFS
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { ROOT, ffmpeg } from "./lib/video.mjs";

const { positional, flags } = parseArgs(process.argv.slice(2), { min: "number", max: "number" });
const [a, b] = positional.map((p) => path.resolve(p));
if (!a || !b || !existsSync(a) || !existsSync(b)) {
  console.error("Usage: node scripts/compare.mjs <dirA> <dirB> [--min 0.995] | <a.wav> <b.wav> [--max -60]");
  process.exit(1);
}

const stderrOf = (args) => spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8" }).stderr;

if (/\.(wav|flac|mp3|m4a|mkv|mp4)$/i.test(a)) {
  const max = flags.max ?? -60;
  const err = stderrOf([
    "-i", a, "-i", b, "-filter_complex",
    "[1:a]volume=-1[inv];[0:a][inv]amix=inputs=2:normalize=0,astats=measure_perchannel=none:measure_overall=Peak_level",
    "-f", "null", "-",
  ]);
  const peak = Number(/Peak level dB:\s*(-?[\d.]+|-inf)/.exec(err)?.[1].replace("-inf", "-Infinity"));
  const ok = peak <= max;
  console.log(`audio difference peak: ${peak === -Infinity ? "-inf (bit-identical)" : `${peak.toFixed(1)} dBFS`} (limit ${max}) → ${ok ? "OK" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
}

const min = flags.min ?? 0.995;
const names = readdirSync(a).filter((f) => f.endsWith(".png") && f !== "sheet.png").sort();
const diffDir = path.join(ROOT, "out", "compare");
const failures = [];
let worst = { name: "", ssim: 1 };
let missing = 0;

for (const name of names) {
  const other = path.join(b, name);
  if (!existsSync(other)) {
    missing++;
    console.log(`${name}: missing in ${path.relative(ROOT, b)}`);
    continue;
  }
  const err = stderrOf(["-i", path.join(a, name), "-i", other, "-lavfi", "ssim", "-f", "null", "-"]);
  const ssim = Number(/All:([\d.]+)/.exec(err)?.[1]);
  if (ssim < worst.ssim) worst = { name, ssim };
  if (!(ssim >= min)) {
    failures.push({ name, ssim });
    mkdirSync(diffDir, { recursive: true });
    ffmpeg("-i", path.join(a, name), "-i", other, "-lavfi", "blend=all_mode=difference,eq=contrast=4", path.join(diffDir, name));
  }
}

console.log(`${names.length - missing} frames compared, worst SSIM ${worst.ssim.toFixed(5)} (${worst.name}), limit ${min}`);
for (const f of failures) console.log(`  FAIL ${f.name}: ${f.ssim.toFixed(5)} → out/compare/${f.name}`);
process.exit(failures.length || missing ? 1 : 0);
