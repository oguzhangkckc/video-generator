// ElevenLabs sound effects → public/kit/sfx/<id>.wav, shared by every video. Needs ELEVENLABS_API_KEY in .env.
//   node scripts/sfx.mjs             → generates the missing ones, then (re)processes all
//   node scripts/sfx.mjs lock boom   → regenerates the named ones, then (re)processes all
// Prompts, durations and mix levels live in src/kit/audio/sfx-catalog.json; add a new sound there first.
// Raw API output stays in out/sfx-raw/ so trimming/levels can be retuned without spending credits.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { API, apiKey } from "./elevenlabs.mjs";
import { ROOT, duration } from "./lib/video.mjs";

const TARGET_LUFS = -16;
const RAW_DIR = path.join(ROOT, "out/sfx-raw");
const OUT_DIR = path.join(ROOT, "public/kit/sfx");
const SOUNDS = JSON.parse(readFileSync(path.join(ROOT, "src/kit/audio/sfx-catalog.json"), "utf8"));

const generate = async (key, id) => {
  const { seconds, prompt } = SOUNDS[id];
  const res = await fetch(`${API}/sound-generation?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: prompt, duration_seconds: seconds, prompt_influence: 0.5, model_id: "eleven_text_to_sound_v2" }),
  });
  if (!res.ok) throw new Error(`sound-generation ${id} → ${res.status}: ${(await res.text()).slice(0, 400)}`);
  writeFileSync(path.join(RAW_DIR, `${id}.mp3`), Buffer.from(await res.arrayBuffer()));
  console.log(`generated ${id} (${seconds}s)`);
};

// Leading silence would offset every cue; the tail fade avoids a click at the cut.
const SHAPE =
  "silenceremove=start_periods=1:start_threshold=-50dB,areverse,afade=t=in:d=0.04,areverse," +
  "aresample=48000,aformat=channel_layouts=stereo";

const measure = (input) => {
  const { stderr } = spawnSync("ffmpeg", [
    "-hide_banner", "-i", input, "-af", `${SHAPE},loudnorm=I=${TARGET_LUFS}:TP=-2:print_format=json`, "-f", "null", "-",
  ], { encoding: "utf8" });
  return JSON.parse(stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1));
};

const processSound = (id) => {
  const input = path.join(RAW_DIR, `${id}.mp3`);
  const m = measure(input);
  const norm =
    `loudnorm=I=${TARGET_LUFS}:TP=-2:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
    `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-af", `${SHAPE},${norm},aresample=48000`, "-c:a", "pcm_s16le", path.join(OUT_DIR, `${id}.wav`),
  ]);
  console.log(`  ${id.padEnd(8)} ${Number(m.input_i).toFixed(1)} LUFS → ${TARGET_LUFS}`);
};

// Looping beds need each file's real length at render time; written here so a clean clone has it without the API.
const INDEX = path.join(ROOT, "src/kit/audio/sfx-durations.json");
const writeIndex = () => {
  const lengths = Object.fromEntries(
    Object.keys(SOUNDS)
      .filter((id) => existsSync(path.join(OUT_DIR, `${id}.wav`)))
      .map((id) => [id, Math.round(duration(path.join(OUT_DIR, `${id}.wav`)) * 1000) / 1000]),
  );
  writeFileSync(INDEX, `${JSON.stringify(lengths, null, 2)}\n`);
  console.log(`${path.relative(ROOT, INDEX)}: ${Object.keys(lengths).length} sounds`);
};

const args = process.argv.slice(2);
if (args.includes("--index")) {
  writeIndex();
  process.exit(0);
}
const named = args;
const unknown = named.filter((id) => !(id in SOUNDS));
if (unknown.length) {
  console.error(`Unknown sound(s): ${unknown.join(", ")}. Known: ${Object.keys(SOUNDS).join(", ")}`);
  process.exit(1);
}

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });
const todo = named.length ? named : Object.keys(SOUNDS).filter((id) => !existsSync(path.join(RAW_DIR, `${id}.mp3`)));
if (todo.length) {
  const key = apiKey();
  for (const id of todo) await generate(key, id);
}
console.log(`processing → ${path.relative(ROOT, OUT_DIR)}`);
for (const id of Object.keys(SOUNDS)) processSound(id);
writeIndex();
