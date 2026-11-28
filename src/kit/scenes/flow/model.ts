// Where everything of a flow scene is at t, shared by the drawing (Flow.tsx), the framing solver and qa.
import { mentions } from "../../../spec/sentences.ts";
import type { LayerOf } from "../../../spec/schema";
import type { CurveFn } from "../../curves";
import { CX } from "../../format";
import { IDENTITY, circlePoints, currentShot, pointBox, pointsBox, shapeAround, unionBox, type Adjust, type SceneElement } from "../../framing";
import type { Box } from "../../overlays/geometry";
import { EASING, envelope, ramp, windowAlpha } from "../../time";
import { project, viewAt, type View, type Vec } from "../camera2d/camera";
import { polylineLength, slice, spline } from "../camera2d/paths";
import { sideWeight, squeezeLevel, warpPoint, type SqueezeSpec } from "./squeeze.ts";

export type FlowLayer = LayerOf<"flow">;
type Progress = FlowLayer["signals"][number]["progress"];

/** A node stays important this long after it fires or a wave reaches it. */
const HOLD = 1.5;
/** A travelling signal's way that matters, in seconds around its tip, marked every `spacing` screen px. */
const ROUTE = { behind: 0.25, ahead: 0.5, spacing: 40 };

/** The point `d` world px along a chain of paths. */
const along = (chain: { points: Vec[]; length: number }[], d: number): Vec => {
  let left = d;
  for (const path of chain) {
    if (left <= path.length) return slice(path.points, path.length ? left / path.length : 0, path.length).tip;
    left -= path.length;
  }
  return chain[chain.length - 1].points[chain[chain.length - 1].points.length - 1];
};

/** Geometry that only changes with the spec. */
export const flowGeometry = (layer: FlowLayer) => {
  const regions = new Map(layer.regions.map((r) => [r.id, r.smooth ? spline(r.points, true) : r.points]));
  const paths = new Map(
    layer.paths.map((p) => {
      const points = p.smooth ? spline(p.points) : p.points;
      return [p.id, { points, length: polylineLength(points) }];
    }),
  );
  const nodes = new Map(layer.nodes.map((n) => [n.id, n]));
  return { regions, paths, nodes };
};
export type FlowGeometry = ReturnType<typeof flowGeometry>;

const squeezesOf = (layer: FlowLayer, geo: FlowGeometry): SqueezeSpec[] =>
  layer.squeeze.map((s) => ({ ...s, center: Array.isArray(s.center) ? s.center : geo.nodes.get(s.center)!.at }));

/** The geometry at t: what a squeeze moves is drawn, framed and measured where it is now. */
export const geometryAt = (layer: FlowLayer, geo: FlowGeometry, t: number): FlowGeometry => {
  const squeezes = squeezesOf(layer, geo).filter((s) => squeezeLevel(s.range, t) > 0);
  if (!squeezes.length) return geo;
  const warp = (id: string, p: Vec) => warpPoint(squeezes, layer.groups, id, p, t);
  return {
    regions: new Map([...geo.regions].map(([id, points]) => [id, points.map((p) => warp(id, p))])),
    paths: new Map(
      [...geo.paths].map(([id, path]) => {
        const points = path.points.map((p) => warp(id, p));
        return [id, { points, length: polylineLength(points) }];
      }),
    ),
    nodes: new Map([...geo.nodes].map(([id, n]) => [id, { ...n, at: warp(id, n.at) }])),
  };
};

/**
 * Each squeeze's group as drawn now: the mean distance of its fully moved points (regions, paths, nodes) from the
 * centre, in world px (camera zoom divided out), so qa can see the group really get smaller.
 */
export const squeezeSizes = (layer: FlowLayer, base: FlowGeometry, now: FlowGeometry, st: FlowState) =>
  squeezesOf(layer, base).map((s, i) => {
    const members = (id: string) => !s.group || (layer.groups[s.group] ?? []).includes(id);
    const pairs: [Vec, Vec][] = [];
    const take = (id: string, from: Vec[], to: Vec[]) => {
      if (members(id)) from.forEach((p, k) => sideWeight(s.side, p) >= 0.9 && pairs.push([p, to[k]]));
    };
    for (const [id, points] of base.regions) take(id, points, now.regions.get(id)!);
    for (const [id, path] of base.paths) take(id, path.points, now.paths.get(id)!.points);
    for (const [id, n] of base.nodes) take(id, [n.at], [now.nodes.get(id)!.at]);
    const c = st.toScreen(s.center);
    const size = pairs.length
      ? pairs.reduce((sum, [, p]) => {
          const q = st.toScreen(p);
          return sum + Math.hypot(q[0] - c[0], q[1] - c[1]);
        }, 0) /
        pairs.length /
        st.view.zoom
      : null;
    return { kind: "squeeze" as const, id: `${s.group ?? "yarı-düzlem"}#${i}`, range: s.range, scale: s.scale, size };
  });

/** Camera, signals and lights at t; `adjust` is the framing move (p' = anchor + s·(p − anchor) + d). */
export const flowState = (layer: FlowLayer, geo: FlowGeometry, curve: (name: string) => CurveFn, t: number, adjust: Adjust = IDENTITY) => {
  const place = (p: string | Vec): Vec => (Array.isArray(p) ? p : geo.nodes.get(p)!.at);
  const progressAt = (p: Progress, u = t) =>
    "times" in p ? ramp(u, p.times, [0, 1], EASING.linear) : ramp(curve(p.curve)(u), p.range, [0, 1], EASING.linear);
  const written = viewAt(layer.camera, place, layer.drift, t);
  const view: View = { ...written, zoom: written.zoom * adjust.s };
  const anchor: Vec = [CX + adjust.dx, layer.anchorY + adjust.dy];
  const toScreen = project(view, anchor);
  const lit = (target: string) =>
    Math.max(
      0,
      ...layer.highlight
        .filter((h) => h.target === target)
        .map(({ range: [from, to] }) => envelope(t, [from, from + 0.3], [Math.max(from + 0.3, to - 0.4), to])),
    );

  const signals = layer.signals.map((s) => {
    const chain = s.along.map((id) => geo.paths.get(id)!);
    const total = chain.reduce((sum, p) => sum + p.length, 0);
    const p = progressAt(s.progress);
    let left = p * total;
    const pieces = chain.map((path) => {
      const take = Math.max(0, Math.min(path.length, left));
      left -= take;
      return take > 0 ? slice(path.points, take / path.length, path.length) : null;
    });
    const tip = [...pieces].reverse().find(Boolean)?.tip;
    const moving = p > 0 && p < 1;
    const route: Vec[] = [];
    if (moving) {
      const [from, to] = [progressAt(s.progress, t - ROUTE.behind) * total, progressAt(s.progress, t + ROUTE.ahead) * total];
      const step = ROUTE.spacing / view.zoom;
      for (let d = from; d < to; d += step) route.push(along(chain, d));
      route.push(along(chain, to));
    }
    return { s, pieces, tip: moving ? tip : undefined, route };
  });

  const arrivals = new Map<string, number[]>();
  for (const f of layer.fields) {
    const [ox, oy] = place(f.origin);
    for (const id of f.lights) {
      const [x, y] = geo.nodes.get(id)!.at;
      const times = f.emits.map((emit) => emit + (f.duration * Math.hypot(x - ox, y - oy)) / f.maxRadius);
      arrivals.set(id, [...(arrivals.get(id) ?? []), ...times]);
    }
  }
  return { place, progressAt, view, anchor, toScreen, lit, signals, arrivals };
};
export type FlowState = ReturnType<typeof flowState>;

/**
 * Every visible element in screen px. Important: a node that is lit, firing, reached by a wave or highlighted; a
 * travelling signal's head and its way (just drawn and the next half second, as points); a region that is highlighted
 * or being swept; and anything the phrase being spoken names.
 */
export const flowElements = (layer: FlowLayer, geo: FlowGeometry, st: FlowState, t: number, spoken: string): SceneElement[] => {
  const said = (say: string[]) => say.some((a) => mentions(spoken, a));
  const shown = (w: FlowLayer["nodes"][number]["visible"]) => (w ? windowAlpha(t, w) : 1) > 0;
  const regionBox = (id: string) => pointsBox(geo.regions.get(id)!.map(st.toScreen))!;
  const out: SceneElement[] = [];
  for (const r of layer.regions) {
    const p = r.sweep ? st.progressAt(r.sweep.progress) : 0;
    // A region clipped to another (a chamber inside an organ) is only seen inside it.
    const own = regionBox(r.id);
    const inside = r.clipTo ? regionBox(r.clipTo) : own;
    const box = { x1: Math.max(own.x1, inside.x1), y1: Math.max(own.y1, inside.y1), x2: Math.min(own.x2, inside.x2), y2: Math.min(own.y2, inside.y2) };
    const hidden = !shown(r.visible);
    // A region with no fill and no edge is an invisible stand-in: it draws only while swept or highlighted, or as the
    // part of a filled region it is clipped to (a chamber of the heart is seen as that part of the heart).
    const outline = geo.regions.get(r.id)!.map(st.toScreen);
    const parent = r.clipTo ? layer.regions.find((x) => x.id === r.clipTo) : undefined;
    const draws = r.fill !== "none" || r.edge !== "none" || p > 0 || st.lit(r.id) > 0 || (parent !== undefined && parent.fill !== "none");
    const seen = outline.filter(([x, y]) => x >= inside.x1 && x <= inside.x2 && y >= inside.y1 && y <= inside.y2);
    const drawn = draws ? [parent ? seen : [...outline, outline[0]]] : [];
    out.push({ id: r.id, kind: "region", ...box, important: !hidden && (st.lit(r.id) > 0 || (p > 0 && p < 1) || said(r.say)), say: r.say, hidden, drawn });
  }
  for (const p of layer.paths) {
    const line = geo.paths.get(p.id)!.points.map(st.toScreen);
    const box = pointsBox(line)!;
    const hidden = !shown(p.visible);
    out.push({ id: p.id, kind: "path", ...box, important: !hidden && (st.lit(p.id) > 0 || said(p.say)), say: p.say, hidden, drawn: [line] });
  }
  for (const n of layer.nodes) {
    const near = (times: number[]) => times.some((x) => t >= x && t <= x + HOLD);
    const active =
      n.lit.some(([from, to]) => t >= from && t <= to) || near(st.arrivals.get(n.id) ?? []) || near(n.flashes) || st.lit(n.id) > 0;
    const r = Math.max(18, n.r * st.view.zoom * 2.6 + 6);
    const hidden = !shown(n.visible);
    const drawn = [circlePoints(st.toScreen(n.at), Math.max(4, n.r * st.view.zoom), 16)];
    out.push({ id: n.id, kind: "node", ...pointBox(st.toScreen(n.at), r), important: !hidden && (active || said(n.say)), say: n.say, hidden, drawn });
  }
  st.signals.forEach(({ s, tip, route }, i) => {
    if (tip && s.head) out.push({ id: `signal${i}`, kind: "signal", ...pointBox(st.toScreen(tip), 24), important: true, say: [] });
    route.forEach((at, k) => out.push({ id: `signal${i}:route${k}`, kind: "route", ...pointBox(st.toScreen(at), 12), important: true, say: [] }));
  });
  return out;
};

/**
 * What the shot is about: its `subject` ids, else the smallest region around the camera's focus, else every region.
 */
export const flowSubject = (layer: FlowLayer, geo: FlowGeometry, st: FlowState, t: number, elements: SceneElement[]): Box | null => {
  const shot = currentShot(layer.camera, t);
  if (shot.subject) return unionBox(elements.filter((e) => !e.hidden && shot.subject!.includes(e.id)));
  const regions = elements.filter((e) => e.kind === "region" && !e.hidden);
  const around = shapeAround(
    st.place(shot.focus),
    layer.regions.filter((r) => regions.some((e) => e.id === r.id)).map((r) => ({ id: r.id, points: geo.regions.get(r.id)! })),
  );
  return around ? (regions.find((e) => e.id === around.id) ?? null) : unionBox(regions);
};
