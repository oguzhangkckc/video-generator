// Framing: what matters in a scene stays clear of the overlays. A camera shot written in the spec is the intent;
// when the scene's important elements (an active node, a travelling signal, the part being named…) would fall under
// a label panel, a data strip or the captions, the shot is moved on screen by the smallest shift, and zoomed out
// only when no shift fits. The shift is averaged over ±0.6 s, so the camera eases aside before a panel appears.
// Scenes also report their elements here, for qa (QaProbe logs them as QA_SCENE).
import { createContext, useContext } from "react";
import { HEIGHT, WIDTH } from "./format.ts";
import type { Box } from "./overlays/geometry";

export type Vec = [number, number];
/** A screen-space move of a whole scene around its anchor: p' = anchor + s·(p − anchor) + (dx, dy). */
export type Adjust = { dx: number; dy: number; s: number };
export const IDENTITY: Adjust = { dx: 0, dy: 0, s: 1 };

/** Important elements stay this far inside the frame and this far from a reserved zone. */
const MARGIN = 24;
const GAP = 12;
const STEP = 20;
const MAX_SHIFT: Vec = [360, 720];
const SCALES = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
/**
 * The average runs over a fixed 0.1 s grid (so solved moves can be cached across frames) with Gaussian weights
 * (σ 0.3 s) that slide with t, so the result changes continuously from frame to frame.
 */
const GRID = 0.1;
const SIGMA = 0.3;
const REACH = 9;

const SHIFTS: Vec[] = (() => {
  const out: Vec[] = [];
  for (let dx = -MAX_SHIFT[0]; dx <= MAX_SHIFT[0]; dx += STEP) {
    for (let dy = -MAX_SHIFT[1]; dy <= MAX_SHIFT[1]; dy += STEP) out.push([dx, dy]);
  }
  return out.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
})();

export const applyAdjust = ([x, y]: Vec, anchor: Vec, a: Adjust): Vec => [
  anchor[0] + a.s * (x - anchor[0]) + a.dx,
  anchor[1] + a.s * (y - anchor[1]) + a.dy,
];

export const moveBox = (b: Box, anchor: Vec, a: Adjust): Box => {
  const [x1, y1] = applyAdjust([b.x1, b.y1], anchor, a);
  const [x2, y2] = applyAdjust([b.x2, b.y2], anchor, a);
  return { x1, y1, x2, y2 };
};

export const overlaps = (a: Box, b: Box, gap = 0) => a.x1 < b.x2 + gap && a.x2 > b.x1 - gap && a.y1 < b.y2 + gap && a.y2 > b.y1 - gap;
const fits = (b: Box) => b.x1 >= MARGIN && b.x2 <= WIDTH - MARGIN && b.y1 >= MARGIN && b.y2 <= HEIGHT - MARGIN;

/**
 * The smallest move that puts every important box inside the frame and clear of every zone; identity when the
 * shot is already clear, and also when nothing fits (qa then reports the overlap instead of the camera jumping).
 */
export const solve = (important: Box[], zones: Box[], anchor: Vec): Adjust => {
  if (important.length === 0) return IDENTITY;
  const clear = (boxes: Box[]) => boxes.every((b) => fits(b) && zones.every((z) => !overlaps(b, z, GAP)));
  if (clear(important)) return IDENTITY;
  for (const s of SCALES) {
    const scaled = important.map((b) => moveBox(b, anchor, { dx: 0, dy: 0, s }));
    const w = Math.max(...scaled.map((b) => b.x2)) - Math.min(...scaled.map((b) => b.x1));
    const h = Math.max(...scaled.map((b) => b.y2)) - Math.min(...scaled.map((b) => b.y1));
    if (w > WIDTH - 2 * MARGIN || h > HEIGHT - 2 * MARGIN) continue;
    for (const [dx, dy] of SHIFTS) {
      const moved = scaled.map((b) => ({ x1: b.x1 + dx, y1: b.y1 + dy, x2: b.x2 + dx, y2: b.y2 + dy }));
      if (clear(moved)) return { dx, dy, s };
    }
  }
  return IDENTITY;
};

/** The solved move averaged around t (dx, dy linear, scale in log space): smooth, and early for what is coming. */
export const smoothAdjust = (raw: (t: number) => Adjust, t: number): Adjust => {
  let dx = 0;
  let dy = 0;
  let ls = 0;
  let sum = 0;
  const base = Math.floor(t / GRID);
  for (let j = -REACH; j <= REACH + 1; j++) {
    const g = Math.round((base + j) * GRID * 1000) / 1000;
    const w = Math.exp(-((g - t) ** 2) / (2 * SIGMA * SIGMA));
    const a = raw(g);
    dx += w * a.dx;
    dy += w * a.dy;
    ls += w * Math.log(a.s);
    sum += w;
  }
  return { dx: dx / sum, dy: dy / sum, s: Math.exp(ls / sum) };
};

export type ShotKind = "wide" | "medium" | "close";

/** An element a scene draws, in screen px; `important` ones are kept clear of the overlays. */
export type SceneElement = Box & { id: string; kind: string; important: boolean; say: string[] };
/** A text label drawn by a scene on a data line, with the leader line that ties it to its point, if any. */
export type SceneLabel = Box & { text: string; marker: "bracket" | "leader"; leader?: [Vec, Vec] };
export type SceneReport = {
  layer: string;
  type: string;
  opacity: number;
  shot: { kind: ShotKind; subject?: string[] };
  /** What the shot is about, in screen px; null when the layer has no subject (a transition). */
  subject: Box | null;
  elements: SceneElement[];
  labels?: SceneLabel[];
  /** The drawn data line, sampled in screen px. */
  line?: Vec[];
  adjust: Adjust;
};

export type Framing = {
  /** Off: shots are drawn as written (qa still reports where they put things). */
  enabled: boolean;
  /** Where important elements must not go at t. */
  zonesAt: (t: number) => Box[];
  /** The phrase being spoken at t ("" in a pause). */
  spokenAt: (t: number) => string;
  /** qa only: scenes put what they drew this frame here. */
  reports: Map<string, SceneReport> | null;
};

export const FramingContext = createContext<Framing>({ enabled: false, zonesAt: () => [], spokenAt: () => "", reports: null });
export const useFraming = () => useContext(FramingContext);

/** Solved moves on the grid, per video (a new Framing comes with every spec change) and per scene. */
const solved = new WeakMap<Framing, Map<string, Map<number, Adjust>>>();

/** The move for one scene (`key`) at t, from its important boxes at any time (as drawn with no move). */
export const adjustFor = (framing: Framing, key: string, importantAt: (t: number) => Box[], anchor: Vec, t: number): Adjust => {
  if (!framing.enabled) return IDENTITY;
  const scenes = solved.get(framing) ?? new Map<string, Map<number, Adjust>>();
  solved.set(framing, scenes);
  const cache = scenes.get(key) ?? new Map<number, Adjust>();
  scenes.set(key, cache);
  return smoothAdjust((u) => {
    const hit = cache.get(u);
    if (hit) return hit;
    const a = solve(importantAt(u), framing.zonesAt(u), anchor);
    cache.set(u, a);
    return a;
  }, t);
};

const inPolygon = ([x, y]: Vec, poly: Vec[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const area = (poly: Vec[]) => Math.abs(poly.reduce((s, [x, y], i) => s + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0)) / 2;

/** The smallest shape that contains the point: what a camera aimed there is looking at. */
export const shapeAround = <S extends { id: string; points: Vec[] }>(point: Vec, shapes: S[]): S | undefined =>
  shapes.filter((s) => inPolygon(point, s.points)).sort((a, b) => area(a.points) - area(b.points))[0];

/** Kind of a 2D shot: written, or read from its zoom (wide < 0.8 ≤ medium < 2 ≤ close). */
export const shotKind = (shot: { kind?: ShotKind; zoom: number }): ShotKind =>
  shot.kind ?? (shot.zoom < 0.8 ? "wide" : shot.zoom < 2 ? "medium" : "close");

/** The shot in effect at t: the last one that has started. */
export const currentShot = <S extends { at: number }>(shots: S[], t: number): S => [...shots].reverse().find((s) => s.at <= t) ?? shots[0];

export const unionBox = (boxes: Box[]): Box | null =>
  boxes.length
    ? {
        x1: Math.min(...boxes.map((b) => b.x1)),
        y1: Math.min(...boxes.map((b) => b.y1)),
        x2: Math.max(...boxes.map((b) => b.x2)),
        y2: Math.max(...boxes.map((b) => b.y2)),
      }
    : null;

export const pointBox = ([x, y]: Vec, r: number): Box => ({ x1: x - r, y1: y - r, x2: x + r, y2: y + r });
export const pointsBox = (points: Vec[]): Box | null =>
  points.length
    ? {
        x1: Math.min(...points.map((p) => p[0])),
        y1: Math.min(...points.map((p) => p[1])),
        x2: Math.max(...points.map((p) => p[0])),
        y2: Math.max(...points.map((p) => p[1])),
      }
    : null;
