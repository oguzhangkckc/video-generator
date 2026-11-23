// Where everything of a trace is at t, shared by the drawing (Trace.tsx), the framing solver and qa.
import { mentions } from "../../../spec/sentences.ts";
import type { LayerOf } from "../../../spec/schema";
import type { CurveFn } from "../../curves";
import { CX, HEIGHT, WIDTH } from "../../format";
import { IDENTITY, pointBox, pointsBox, type Adjust, type SceneElement, type SceneLabel } from "../../framing";
import { textWidth, type Box } from "../../overlays/geometry";
import { MONO } from "../../theme";
import { envelope, ramp } from "../../time";
import { project, viewAt, type View, type Vec } from "../camera2d/camera";
import { placeLabels } from "./labels";
import type { Waveform } from "./waveform";

export type TraceLayer = LayerOf<"trace">;

const HALF_DIAGONAL = Math.hypot(WIDTH, HEIGHT) / 2;
/** How far back (px at zoom 1) the strip keeps its history. */
const HISTORY_PX = 2400;
/** A corner is sampled on both sides, so vertical edges (square waves) stay vertical. */
const EDGE = 1e-3;
export const LABEL_SIZE = 34;

/** Signal positions to sample between `from` and `to`, always including every corner. */
export const samples = (wave: Waveform, from: number, to: number, step: number) => {
  const xs: number[] = [];
  for (let x = from; x < to; x += step) xs.push(x);
  for (let k = Math.floor(from / wave.period); k <= Math.floor(to / wave.period); k++) {
    for (const c of wave.corners) {
      const x = k * wave.period + c;
      if (x - EDGE > from && x - EDGE < to) xs.push(x - EDGE);
      if (x > from && x < to) xs.push(x);
    }
  }
  xs.push(to);
  return xs.sort((a, b) => a - b);
};

/** Camera, pen, drawn line and parts at t; `adjust` is the framing move. */
export const traceState = (layer: TraceLayer, wave: Waveform, clock: CurveFn, t: number, adjust: Adjust = IDENTITY) => {
  const pen: Vec = [layer.penX * WIDTH, layer.baselineY];
  const home: Vec = [CX, layer.anchorY];
  const written = viewAt(layer.camera, (f) => (f === "frame" ? home : f === "pen" ? pen : f), layer.drift, t);
  const view: View = { ...written, zoom: written.zoom * adjust.s };
  const anchor: Vec = [home[0] + adjust.dx, home[1] + adjust.dy];
  const toScreen = project(view, anchor);
  const now = clock(t);
  const { pxPerX, pxPerY } = layer.grid;

  const reach = HALF_DIAGONAL / view.zoom;
  const left = Math.max(view.fx - reach, pen[0] - HISTORY_PX);
  const xAt = (x: number) => pen[0] - (now - x) * pxPerX;
  const yAt = (v: number) => pen[1] - v * pxPerY;
  const xFrom = now - (pen[0] - left) / pxPerX;
  const step = Math.min(2, 1.2 / view.zoom) / pxPerX;
  /** The line between two signal positions, in world px. */
  const points = (from: number, to: number): Vec[] => samples(wave, from, to, step).map((x) => [xAt(x), yAt(wave.value(x))]);

  const parts = layer.parts.flatMap((part) => {
    const periods = part.once
      ? [0]
      : Array.from({ length: Math.floor(now / wave.period) - Math.floor(xFrom / wave.period) + 1 }, (_, i) => Math.floor(xFrom / wave.period) + i);
    return periods.flatMap((k) => {
      const from = k * (part.once ? 0 : wave.period) + part.range[0];
      const to = k * (part.once ? 0 : wave.period) + part.range[1];
      const drawnTo = Math.min(to, now);
      if (drawnTo <= from || to < xFrom) return [];
      const peak = Math.max(...samples(wave, from, to, (to - from) / 24).map(wave.value));
      const [lx, ly] = toScreen([xAt((from + drawnTo) / 2), yAt(part.labelAt ?? Math.max(peak, 0) + 0.3)]);
      const glow = Math.max(0, ...part.lit.map(([a, b]) => envelope(t, [a, a + 0.2], [Math.max(a + 0.2, b - 0.2), b])));
      return [{ part, from: Math.max(from, xFrom), to, drawnTo, lx, ly, glow, alpha: ramp(drawnTo - from, [0, (to - from) * 0.15]) }];
    });
  });

  const penScreen = toScreen([pen[0], yAt(wave.value(now))]);
  return { pen, view, anchor, toScreen, now, xAt, yAt, xFrom, points, parts, penScreen, reach, left };
};
export type TraceState = ReturnType<typeof traceState>;

/** The pen, which always matters, and each drawn part: important while it is drawn, lit or named. */
export const traceElements = (st: TraceState, spoken: string): SceneElement[] => {
  const out: SceneElement[] = [{ id: "pen", kind: "pen", ...pointBox(st.penScreen, 24), important: true, say: [] }];
  st.parts.forEach((p) => {
    const box = pointsBox(st.points(p.from, p.drawnTo).map(st.toScreen));
    if (!box) return;
    const drawing = st.now > p.from && st.now < p.to;
    const named = p.part.say.some((a) => mentions(spoken, a));
    out.push({ id: `part:${p.part.text}`, kind: "part", ...box, important: p.glow > 0 || drawing || named, say: p.part.say });
  });
  return out;
};

const clip = (b: Box | null, to: Box): Box | null => {
  if (!b) return null;
  const c = { x1: Math.max(b.x1, to.x1), y1: Math.max(b.y1, to.y1), x2: Math.min(b.x2, to.x2), y2: Math.min(b.y2, to.y2) };
  return c.x2 > c.x1 && c.y2 >= c.y1 ? c : null;
};

/** The line as it is seen: its drawn part, in screen px, within `area` (the frame, or a data strip's panel). */
export const traceLine = (st: TraceState, area: Box): { subject: Box | null; line: Vec[] } => {
  const all = st.points(st.xFrom, st.now).map(st.toScreen);
  const seen = all.filter(([x, y]) => x >= area.x1 && x <= area.x2 && y >= area.y1 && y <= area.y2);
  const every = Math.max(1, Math.floor(seen.length / 400));
  return { subject: clip(pointsBox(seen), area), line: seen.filter((_, i) => i % every === 0) };
};

/** Cap height of the mono label font, as a share of its size: the text box that must clear the line. */
const CAP = 0.75;

/**
 * The part labels and where they go (labels.ts): brackets under stretches, leaders over points; `line` is the visible
 * line in screen px, which no label may cross.
 */
export const traceLabels = (st: TraceState, line: Vec[]): (SceneLabel & { size: number; glow: number; alpha: number; color: string })[] => {
  const shown = st.parts.filter((p) => Math.max(p.alpha, p.glow) > 0.05);
  const sized = shown.map((p) => ({ p, size: LABEL_SIZE * (1 + 0.4 * p.glow) }));
  const placed = placeLabels(
    sized.map(({ p, size }) => ({
      text: p.part.text,
      marker: p.part.marker,
      points: st.points(p.from, p.drawnTo).map(st.toScreen),
      width: textWidth(p.part.text, MONO, size, 700),
      height: size * CAP,
    })),
    line,
  );
  return placed.map((l) => {
    const { p, size } = sized.find((s) => s.p.part.text === l.text)!;
    return { ...l, size, glow: p.glow, alpha: p.alpha, color: p.part.color };
  });
};
