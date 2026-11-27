// Start a video from the template: node scripts/new.mjs <slug> "<başlık>"
//   → videos/<slug>/spec.json (copy of videos/sablon) + public/videos/<slug>/
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, publicDir, requireSlug, videoDir } from "./lib/video.mjs";

const [slugArg, title] = process.argv.slice(2);
const slug = requireSlug(slugArg);
if (!title) {
  console.error('Usage: node scripts/new.mjs <slug> "<başlık>"');
  process.exit(1);
}
// The folder may already hold the approved script (videos/<slug>/metin.json, skill step c).
if (existsSync(path.join(videoDir(slug), "spec.json"))) {
  console.error(`${path.relative(ROOT, videoDir(slug))}/spec.json already exists`);
  process.exit(1);
}

const template = readFileSync(path.join(videoDir("sablon"), "spec.json"), "utf8");
mkdirSync(videoDir(slug), { recursive: true });
mkdirSync(publicDir(slug), { recursive: true });
// Dropping the flag makes `npm run check` fail until every "[yer tutucu]" has been replaced.
const spec = template
  .replace(/"title": "[^"]*"/, `"title": ${JSON.stringify(title)}`)
  .replace(/^\s*"template": true,\n/m, "");
writeFileSync(path.join(videoDir(slug), "spec.json"), spec);
console.log(`${path.relative(ROOT, videoDir(slug))}/spec.json — composition "${slug}" appears in npm run studio`);
