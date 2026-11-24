// 3D models for the model3d layer: public/kit/models/<id>.glb plus <id>.json (title, author, license, url, downloaded).
//   node scripts/models.mjs list                                        → validates the library, lists part names
//   node scripts/models.mjs pack <file.gltf> <id> [--max 1024] [--jpeg]  → one self-contained GLB, textures downscaled
// Only pack models whose license allows modification (CC0 preferred); the JSON must say where it came from.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "./lib/args.mjs";
import { ROOT, ffmpeg } from "./lib/video.mjs";

const DIR = path.join(ROOT, "public/kit/models");
const REQUIRED = ["title", "author", "license", "url", "downloaded"];
const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const pad4 = (n) => (4 - (n % 4)) % 4;

/** JSON chunk of a .glb, or the parsed .gltf. */
const readGltfJson = (file) => {
  const data = readFileSync(file);
  if (!file.endsWith(".glb")) return JSON.parse(data.toString("utf8"));
  if (data.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${file}: not a GLB`);
  const length = data.readUInt32LE(12);
  return JSON.parse(data.subarray(20, 20 + length).toString("utf8"));
};

/** Names of the nodes that carry a mesh: the parts a spec can highlight or explode. */
const partNames = (gltf) => (gltf.nodes ?? []).filter((n) => n.mesh !== undefined && n.name).map((n) => n.name);

const list = () => {
  const models = existsSync(DIR) ? readdirSync(DIR).filter((f) => /\.(glb|gltf)$/.test(f)) : [];
  if (models.length === 0) console.log("public/kit/models is empty.");
  let bad = 0;
  for (const file of models) {
    const id = file.replace(/\.(glb|gltf)$/, "");
    const metaFile = path.join(DIR, `${id}.json`);
    const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) : null;
    const missing = meta ? REQUIRED.filter((k) => !meta[k]) : REQUIRED;
    const parts = partNames(readGltfJson(path.join(DIR, file)));
    const mb = (statSync(path.join(DIR, file)).size / 1e6).toFixed(1);
    if (missing.length) {
      bad++;
      console.log(`✗ ${file}  missing ${missing.join(", ")} in ${id}.json`);
    } else {
      console.log(`✓ ${file}  ${mb} MB  "${meta.title}" — ${meta.author} (${meta.license})`);
    }
    console.log(`    parts: ${parts.join(", ") || "(none)"}`);
  }
  if (bad) process.exitCode = 1;
};

const pack = (src, id, { max, jpeg }) => {
  const gltf = JSON.parse(readFileSync(src, "utf8"));
  const base = path.dirname(src);
  const tmp = mkdtempSync(path.join(os.tmpdir(), "models-pack-"));
  const chunks = [];
  let offset = 0;
  const append = (buf) => {
    const at = offset;
    chunks.push(buf);
    offset += buf.length;
    const fill = pad4(offset);
    if (fill) {
      chunks.push(Buffer.alloc(fill));
      offset += fill;
    }
    return at;
  };

  const bufferStarts = (gltf.buffers ?? []).map((b) => {
    if (!b.uri || b.uri.startsWith("data:")) throw new Error("pack expects external .bin buffers");
    return append(readFileSync(path.join(base, decodeURIComponent(b.uri))));
  });
  for (const view of gltf.bufferViews ?? []) {
    view.byteOffset = (view.byteOffset ?? 0) + bufferStarts[view.buffer];
    view.buffer = 0;
  }

  gltf.images?.forEach((image, i) => {
    if (!image.uri) return;
    const input = path.join(base, decodeURIComponent(image.uri));
    const output = path.join(tmp, `${i}.${jpeg ? "jpg" : "png"}`);
    const scale = `scale='min(${max},iw)':'min(${max},ih)':force_original_aspect_ratio=decrease`;
    ffmpeg("-i", input, "-vf", scale, ...(jpeg ? ["-q:v", "3"] : []), output);
    const bytes = readFileSync(output);
    gltf.bufferViews.push({ buffer: 0, byteOffset: append(bytes), byteLength: bytes.length });
    image.bufferView = gltf.bufferViews.length - 1;
    image.mimeType = jpeg ? "image/jpeg" : "image/png";
    delete image.uri;
  });
  rmSync(tmp, { recursive: true, force: true });

  gltf.buffers = [{ byteLength: offset }];
  let json = Buffer.from(JSON.stringify(gltf), "utf8");
  json = Buffer.concat([json, Buffer.alloc(pad4(json.length), 0x20)]);
  const bin = Buffer.concat(chunks);
  const total = 12 + 8 + json.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const chunkHeader = (length, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(length, 0);
    h.writeUInt32LE(type, 4);
    return h;
  };
  const out = path.join(DIR, `${id}.glb`);
  writeFileSync(out, Buffer.concat([header, chunkHeader(json.length, CHUNK_JSON), json, chunkHeader(bin.length, CHUNK_BIN), bin]));
  console.log(`${path.relative(ROOT, out)}  ${(total / 1e6).toFixed(1)} MB  parts: ${partNames(gltf).join(", ")}`);
  if (!existsSync(path.join(DIR, `${id}.json`))) console.log(`now write ${id}.json (${REQUIRED.join(", ")})`);
};

const { positional, flags } = parseArgs(process.argv.slice(2), { max: "number", jpeg: "boolean" });
const [command, ...rest] = positional;
if (command === "list") list();
else if (command === "pack" && rest.length === 2) pack(path.resolve(rest[0]), rest[1], { max: flags.max ?? 1024, jpeg: flags.jpeg ?? false });
else {
  console.error("Usage: node scripts/models.mjs list | pack <file.gltf> <id> [--max 1024] [--jpeg]");
  process.exit(1);
}
