// STYLE "Kamera ve geçişler" on the spec itself: every scene change is a declared transition (through > match >
// flash, a flash only with a reason), and a scene shows the wide context before its first close-up.
import { splitPointer } from "../kit/overlays/pointer";
import { viewAt } from "../kit/scenes/camera2d/camera";
import type { Layer, Spec } from "./schema";

type Shot2D = { at: number; zoom: number; kind?: "wide" | "medium" | "close" };

/** The key a layer goes by in transitions and qa reports: its id, else type#index. */
export const layerName = (layer: Layer, index: number) => ("id" in layer && layer.id) || `${layer.type}#${index}`;

/** Full-frame scenes (a trace with a panel is a data strip, an overlay); effects such as haze are not scenes. */
const isScene = (layer: Layer) =>
  layer.type === "flow" || layer.type === "globe" || layer.type === "cityMap" || layer.type === "model3d" || (layer.type === "trace" && !layer.panel);

/** When a scene is on screen, as [from, to] spans. */
const spansOf = (layer: Layer): [number, number][] => {
  if (layer.type === "globe" || layer.type === "model3d") return [layer.window];
  if (layer.type === "flow" || layer.type === "trace" || layer.type === "cityMap") {
    return layer.visible.map((w) => [w.in ? w.in[0] : 0, w.out ? w.out[1] : Infinity]);
  }
  return [];
};

const ZOOM = { wide: 0.8, close: 2 };
/** A shot's written kind while it holds, else the kind its zoom reads as. */
const kindAt = (shots: Shot2D[], drift: { degPerSec: number; px: number; periodSec: number }, t: number) => {
  const written = [...shots].reverse().find((s) => s.at <= t)?.kind;
  if (written) return written;
  const zoom = viewAt(shots.map((s) => ({ ...s, focus: 0, rotate: 0, easing: "linear" as const })), () => [0, 0], drift, t).zoom;
  return zoom < ZOOM.wide ? "wide" : zoom >= ZOOM.close ? "close" : "medium";
};

/** Element ids a transition may name in a layer (model3d parts are only known once the file loads). */
const elementIds = (layer: Layer): string[] | null => {
  if (layer.type === "flow") return [...layer.nodes, ...layer.regions, ...layer.paths].map((e) => e.id);
  if (layer.type === "trace") return ["pen", ...layer.parts.map((p) => `part:${p.text}`)];
  if (layer.type === "globe") return ["hero", "location"];
  if (layer.type === "cityMap") return ["marker"];
  return null;
};

/** Problems with the scenes of a resolved spec, as messages; empty when the camera and transitions follow STYLE. */
export const sceneFindings = (spec: Spec): string[] => {
  const out: string[] = [];
  const scenes = spec.layers.map((layer, i) => ({ layer, name: layerName(layer, i) })).filter(({ layer }) => isScene(layer));
  const names = new Set(spec.layers.map((l, i) => layerName(l, i)));

  for (const tr of spec.transitions) {
    for (const end of [tr.from, tr.to]) if (!names.has(end)) out.push(`transitions: no layer "${end}"`);
    if (tr.kind === "flash" && !tr.why) out.push(`transitions: ${tr.from} → ${tr.to} is a colour flash; write why (STYLE: the last resort)`);
    if (tr.kind !== "flash" && !tr.via) out.push(`transitions: ${tr.from} → ${tr.to} (${tr.kind}) needs via: { from, to } elements`);
    if (tr.via) {
      for (const [side, id] of [
        [tr.from, tr.via.from],
        [tr.to, tr.via.to],
      ] as const) {
        const layer = spec.layers.find((l, i) => layerName(l, i) === side);
        const ids = layer && elementIds(layer);
        if (ids && !ids.includes(id)) out.push(`transitions: ${side} has no element "${id}" (${ids.join(", ")})`);
      }
    }
  }

  spec.layers.forEach((layer, i) => {
    if (layer.type !== "flow") return;
    const name = layerName(layer, i);
    const ids = new Set(elementIds(layer));
    for (const [group, members] of Object.entries(layer.groups)) {
      for (const m of members) if (!ids.has(m)) out.push(`${name}.groups.${group}: no element "${m}"`);
    }
    layer.squeeze.forEach((s, k) => {
      const where = `${name}.squeeze[${k}]`;
      if (!s.group && !s.side) out.push(`${where}: name a group, a side or both`);
      if (s.group && !layer.groups[s.group]) out.push(`${where}: no group "${s.group}" (${Object.keys(layer.groups).join(", ") || "none"})`);
      if (typeof s.center === "string" && !layer.nodes.some((n) => n.id === s.center)) out.push(`${where}.center: no node "${s.center}"`);
    });
  });

  spec.labels.forEach((l, i) => {
    if (!l.pointTo) return;
    const [name, id] = splitPointer(l.pointTo);
    const layer = spec.layers.find((x, j) => layerName(x, j) === name);
    const ids = layer && elementIds(layer);
    if (!layer) out.push(`labels[${i}].pointTo: no layer "${name}" (${[...names].join(", ")})`);
    else if (ids && !ids.includes(id)) out.push(`labels[${i}].pointTo: ${name} has no element "${id}" (${ids.join(", ")})`);
  });

  for (let a = 0; a < scenes.length; a++) {
    for (let b = a + 1; b < scenes.length; b++) {
      for (const [a0, a1] of spansOf(scenes[a].layer)) {
        for (const [b0, b1] of spansOf(scenes[b].layer)) {
          const from = Math.max(a0, b0);
          const to = Math.min(a1, b1);
          if (to <= from) continue;
          const declared = spec.transitions.some(
            (tr) =>
              [tr.from, tr.to].sort().join() === [scenes[a].name, scenes[b].name].sort().join() && tr.at >= from - 0.5 && tr.at <= to + 0.5,
          );
          if (!declared) {
            out.push(`transitions: ${scenes[a].name} and ${scenes[b].name} are both on screen ${from.toFixed(1)}–${Math.min(to, spec.durationSec).toFixed(1)} s with no transition declared`);
          }
        }
      }
    }
  }

  for (const { layer, name } of scenes) {
    if (layer.type === "flow" || layer.type === "trace") {
      const [start, end] = spansOf(layer).reduce((s, [x, y]) => [Math.min(s[0], x), Math.max(s[1], y)], [Infinity, -Infinity]);
      const landed = spec.transitions.some((tr) => tr.to === name && tr.kind !== "flash");
      const shots: Shot2D[] = layer.camera;
      let wide = 0;
      let opening = landed;
      for (let t = Math.max(0, start); t <= Math.min(end, spec.durationSec); t += 0.1) {
        const kind = kindAt(shots, layer.drift, t);
        if (opening && kind === "close") continue;
        opening = false;
        if (kind === "wide") wide += 0.1;
        if (kind === "close" && wide < 1 - 1e-6) {
          out.push(`camera: ${name} goes close at ${t.toFixed(1)} s with ${wide.toFixed(1)} s of wide shot before it (at least 1 s: context before detail)`);
          break;
        }
      }
    }
    if (layer.type === "globe") {
      const firstDescend = layer.camera.findIndex((s) => s.type === "descend");
      if (firstDescend > 0 && !layer.camera.slice(0, firstDescend).some((s) => s.type === "pullback")) {
        out.push(`camera: ${name} descends before any pullback (wide) shot`);
      }
    }
  }
  return out;
};
