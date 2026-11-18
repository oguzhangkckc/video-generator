import type { EasingName } from "../../time";
import { EASING, ramp } from "../../time";

export type Vec = [number, number];

export type Shot<F> = { at: number; focus: F; zoom: number; rotate: number; easing: EasingName };
export type Drift = { degPerSec: number; px: number; periodSec: number };

/** World point on the anchor, zoom, rotation in degrees. */
export type View = { fx: number; fy: number; zoom: number; rot: number };

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export const viewAt = <F>(shots: Shot<F>[], resolve: (focus: F) => Vec, drift: Drift, t: number): View => {
  const next = shots.findIndex((s) => s.at > t);
  const a = next <= 0 ? shots[next === 0 ? 0 : shots.length - 1] : shots[next - 1];
  const b = next <= 0 ? a : shots[next];
  const p = a === b ? 0 : ramp(t, [a.at, b.at], [0, 1], EASING[b.easing]);

  const [ax, ay] = resolve(a.focus);
  const [bx, by] = resolve(b.focus);
  const zoom = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), p));
  const phase = (2 * Math.PI * t) / drift.periodSec;
  const sway = drift.px / zoom;
  return {
    fx: lerp(ax, bx, p) + sway * Math.sin(phase),
    fy: lerp(ay, by, p) + sway * 0.6 * Math.cos(phase * 0.77),
    zoom,
    rot: lerp(a.rotate, b.rotate, p) + drift.degPerSec * t,
  };
};

export const project = (view: View, anchor: Vec) => {
  const c = Math.cos((view.rot * Math.PI) / 180);
  const s = Math.sin((view.rot * Math.PI) / 180);
  return ([x, y]: Vec): Vec => {
    const dx = (x - view.fx) * view.zoom;
    const dy = (y - view.fy) * view.zoom;
    return [anchor[0] + dx * c - dy * s, anchor[1] + dx * s + dy * c];
  };
};

export const worldTransform = (view: View, anchor: Vec) =>
  `translate(${anchor[0]} ${anchor[1]}) rotate(${view.rot}) scale(${view.zoom}) translate(${-view.fx} ${-view.fy})`;

/** Screen width for strokes drawn with vector-effect="non-scaling-stroke": thicker up close, never vanishing. */
export const strokeAt = (base: number, zoom: number) => base * Math.min(3, Math.max(0.7, Math.sqrt(zoom)));
