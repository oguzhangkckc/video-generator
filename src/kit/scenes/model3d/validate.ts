import { staticFile } from "remotion";
import { layerName } from "../../../spec/scenes";
import type { Spec } from "../../../spec/schema";
import { splitPointer } from "../../overlays/pointer";

const GLB_MAGIC = 0x46546c67;

const gltfJson = async (file: string): Promise<{ nodes?: { name?: string }[] }> => {
  const res = await fetch(staticFile(file));
  if (!res.ok) throw new Error(`${file}: not found under public/ (${res.status})`);
  const data = await res.arrayBuffer();
  const view = new DataView(data);
  if (view.byteLength >= 20 && view.getUint32(0, true) === GLB_MAGIC) {
    const length = view.getUint32(12, true);
    return JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, length)));
  }
  return JSON.parse(new TextDecoder().decode(data));
};

/**
 * Runs in calculateMetadata (so `npm run check` covers it): every part a model3d layer names must exist in the
 * file, and the model's licence record (<id>.json) must be credited with the same url.
 */
export const validateModels = async (spec: Spec) => {
  for (const [i, layer] of spec.layers.entries()) {
    if (layer.type !== "model3d") continue;
    const where = `layers[${i}] (model3d ${layer.file})`;
    const names = new Set(((await gltfJson(layer.file)).nodes ?? []).map((n) => n.name).filter(Boolean));
    const name = layerName(layer, i);
    const used = [
      ...layer.highlight.map((h) => h.part),
      ...(layer.explode?.parts ?? []),
      ...layer.camera.flatMap((c) => (typeof c.target === "string" ? [c.target] : [])),
      ...spec.labels.flatMap((l) => (l.pointTo && splitPointer(l.pointTo)[0] === name ? [splitPointer(l.pointTo)[1]] : [])),
    ];
    for (const part of used) {
      if (!names.has(part)) throw new Error(`${where}: no part "${part}" — the file has: ${[...names].join(", ")}`);
    }

    const metaFile = layer.file.replace(/\.(glb|gltf)$/, ".json");
    const res = await fetch(staticFile(metaFile));
    if (!res.ok) throw new Error(`${where}: missing licence record ${metaFile} (npm run models -- list)`);
    const meta = (await res.json()) as { url?: string; license?: string };
    if (!spec.credits.some((c) => c.kind === "model" && c.url === meta.url)) {
      throw new Error(`${where}: credits needs { "kind": "model", "url": "${meta.url}", "license": "${meta.license}" }`);
    }
  }
};
