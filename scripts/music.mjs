// Licensed music library: public/kit/music/<id>.<mp3|wav|m4a|ogg|flac> + <id>.json next to it.
//   node scripts/music.mjs list   → every track with its licence data, loudness and a starting `gain` for spec.sound.music
// The JSON must hold: title, author, license, url, downloaded (YYYY-MM-DD), moods (array). Tracks without it fail.
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ROOT, duration, loudness } from "./lib/video.mjs";

// Same level as the ambience beds before ducking; the spec's `duck` takes it further down under the voice.
const BED_LUFS = -24;
const DIR = path.join(ROOT, "public/kit/music");
const REQUIRED = ["title", "author", "license", "url", "downloaded", "moods"];

if (process.argv[2] !== "list") {
  console.error("Usage: node scripts/music.mjs list");
  process.exit(1);
}

mkdirSync(DIR, { recursive: true });
const tracks = readdirSync(DIR).filter((f) => /\.(mp3|wav|m4a|ogg|flac)$/i.test(f));
if (tracks.length === 0) {
  console.log(
    "public/kit/music is empty. Add a licensed track plus <id>.json (see README); until then use the ElevenLabs drone bed (sfx \"space\").",
  );
  process.exit(0);
}

let invalid = 0;
for (const file of tracks.sort()) {
  const id = file.replace(/\.[^.]+$/, "");
  const metaFile = path.join(DIR, `${id}.json`);
  const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) : null;
  const missing = meta ? REQUIRED.filter((k) => meta[k] === undefined || meta[k] === "" || (k === "moods" && !Array.isArray(meta[k]))) : REQUIRED;
  if (missing.length) {
    invalid++;
    console.log(`✗ ${file}: ${meta ? `missing ${missing.join(", ")}` : `no ${id}.json`} — not usable`);
    continue;
  }
  const { lufs } = loudness(path.join(DIR, file));
  const gain = 10 ** ((BED_LUFS - lufs) / 20);
  console.log(
    `✓ ${file}  ${duration(path.join(DIR, file)).toFixed(0)} s  ${lufs.toFixed(1)} LUFS  gain≈${gain.toFixed(2)}  ` +
      `[${meta.moods.join(", ")}]  "${meta.title}" — ${meta.author} (${meta.license})`,
  );
}
process.exit(invalid ? 1 : 0);
