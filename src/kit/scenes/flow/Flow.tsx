import { useId, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import type { LayerOf } from "../../../spec/schema";
import type { CurveFn } from "../../curves";
import { CX, HEIGHT, WIDTH } from "../../format";
import { COLOR, EDGE, SURFACE, tokenColor, type ColorToken } from "../../theme";
import { EASING, envelope, ramp, useTime, windowAlpha } from "../../time";
import { project, strokeAt, viewAt, worldTransform, type Vec } from "../camera2d/camera";
import { GlowDot, MATCH_DOT_R } from "../camera2d/GlowDot";
import { polylineLength, slice, spline, toPath } from "../camera2d/paths";

type FlowLayer = LayerOf<"flow">;
type Progress = FlowLayer["signals"][number]["progress"];

const ns = { vectorEffect: "non-scaling-stroke" as const, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const pathColor = (c: ColorToken | "surface" | "faint") => (c === "surface" || c === "faint" ? EDGE[c] : tokenColor(c));

/** Geometry that only changes with the spec. */
const useGeometry = (layer: FlowLayer) =>
  useMemo(() => {
    const regions = new Map(layer.regions.map((r) => [r.id, r.smooth ? spline(r.points, true) : r.points]));
    const paths = new Map(
      layer.paths.map((p) => {
        const points = p.smooth ? spline(p.points) : p.points;
        return [p.id, { points, length: polylineLength(points) }];
      }),
    );
    const nodes = new Map(layer.nodes.map((n) => [n.id, n]));
    return { regions, paths, nodes };
  }, [layer]);

/** Diagram scene: regions, paths, nodes and the signals that travel through them. */
export const Flow: React.FC<{ layer: FlowLayer; curve: (name: string) => CurveFn }> = ({ layer, curve }) => {
  const t = useTime();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const geo = useGeometry(layer);
  const opacity = Math.max(...layer.visible.map((w) => windowAlpha(t, w)));
  if (opacity <= 0) return null;

  const place = (p: string | Vec): Vec => (Array.isArray(p) ? p : geo.nodes.get(p)!.at);
  const progressAt = (p: Progress) =>
    "times" in p ? ramp(t, p.times, [0, 1], EASING.linear) : ramp(curve(p.curve)(t), p.range, [0, 1], EASING.linear);
  const anchor: Vec = [CX, layer.anchorY];
  const view = viewAt(layer.camera, place, layer.drift, t);
  const toScreen = project(view, anchor);
  const sw = (base: number) => strokeAt(base, view.zoom);
  const lit = (target: string) =>
    Math.max(
      0,
      ...layer.highlight
        .filter((h) => h.target === target)
        .map(({ range: [from, to] }) => envelope(t, [from, from + 0.3], [Math.max(from + 0.3, to - 0.4), to])),
    );
  const pulse = 0.75 + 0.25 * Math.sin(t * 2 * Math.PI * 1.1);
  const closeUp = ramp(view.zoom, [3, 7], [1, 0]);

  const signals = layer.signals.map((s) => {
    const chain = s.along.map((id) => geo.paths.get(id)!);
    const total = chain.reduce((sum, p) => sum + p.length, 0);
    let left = progressAt(s.progress) * total;
    const pieces = chain.map((p) => {
      const take = Math.max(0, Math.min(p.length, left));
      left -= take;
      return take > 0 ? slice(p.points, take / p.length, p.length) : null;
    });
    const p = progressAt(s.progress);
    const tip = [...pieces].reverse().find(Boolean)?.tip;
    return { s, pieces, tip: p > 0 && p < 1 ? tip : undefined };
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

  const dotR = (r: number) => r * view.zoom;

  return (
    <AbsoluteFill style={{ opacity, background: `linear-gradient(180deg, ${COLOR.bgTop} 0%, ${COLOR.bgBottom} 100%)` }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          {layer.frame ? (
            <clipPath id={`${uid}-band`}>
              <rect x={0} y={layer.frame.top} width={WIDTH} height={layer.frame.height} />
            </clipPath>
          ) : null}
          {layer.regions.map((r) => (
            <clipPath key={r.id} id={`${uid}-${r.id}`}>
              <path d={toPath(geo.regions.get(r.id)!, true)} />
            </clipPath>
          ))}
        </defs>

        <g clipPath={layer.frame ? `url(#${uid}-band)` : undefined}>
        <g transform={worldTransform(view, anchor)}>
          {layer.regions.map((r) => {
            const a = r.visible ? windowAlpha(t, r.visible) : 1;
            if (a <= 0 || r.fill === "none") return null;
            return <path key={r.id} d={toPath(geo.regions.get(r.id)!, true)} fill={SURFACE[r.fill]} opacity={a} />;
          })}
          {layer.regions.map((r) => {
            const p = r.sweep ? progressAt(r.sweep.progress) : 0;
            const tint = lit(r.id);
            if (p <= 0 && tint <= 0) return null;
            const inner = (
              <g clipPath={`url(#${uid}-${r.id})`}>
                {tint > 0 ? <rect x={-1e5} y={-1e5} width={2e5} height={2e5} fill={COLOR.secondary} fillOpacity={0.12 * tint} /> : null}
                {r.sweep && p > 0 ? (
                  <>
                    <circle cx={place(r.sweep.origin)[0]} cy={place(r.sweep.origin)[1]} r={Math.max(1, r.sweep.reach * p)} fill={tokenColor(r.sweep.color)} fillOpacity={p < 1 ? 0.2 : 0.14} />
                    {p < 1 ? (
                      <circle cx={place(r.sweep.origin)[0]} cy={place(r.sweep.origin)[1]} r={r.sweep.reach * p} stroke={tokenColor(r.sweep.color)} strokeOpacity={0.7} strokeWidth={sw(3)} {...ns} />
                    ) : null}
                  </>
                ) : null}
              </g>
            );
            return r.clipTo ? (
              <g key={r.id} clipPath={`url(#${uid}-${r.clipTo})`}>
                {inner}
              </g>
            ) : (
              <g key={r.id}>{inner}</g>
            );
          })}
          {layer.regions.map((r) => {
            const a = r.visible ? windowAlpha(t, r.visible) : 1;
            if (a <= 0 || r.edge === "none") return null;
            return <path key={r.id} d={toPath(geo.regions.get(r.id)!, true)} stroke={EDGE[r.edge]} strokeOpacity={a} strokeWidth={sw(2.2)} {...ns} />;
          })}

          {layer.paths.map((p) => {
            const a = p.visible ? windowAlpha(t, p.visible) : 1;
            if (a <= 0) return null;
            const g = lit(p.id) * pulse;
            return (
              <path key={p.id} d={toPath(geo.paths.get(p.id)!.points)} stroke={pathColor(p.color)} strokeOpacity={a * Math.min(1, p.opacity + 0.5 * g)} strokeWidth={sw(p.width + 1.6 * lit(p.id))} {...ns} />
            );
          })}

          {signals.map(({ s, pieces }, i) =>
            s.trail
              ? pieces.map((piece, j) =>
                  piece ? (
                    <g key={`${i}-${j}`}>
                      <path d={toPath(piece.points)} stroke={tokenColor(s.color)} strokeOpacity={0.25} strokeWidth={sw(10)} {...ns} />
                      <path d={toPath(piece.points)} stroke={tokenColor(s.color)} strokeWidth={sw(3.4)} {...ns} />
                    </g>
                  ) : null,
                )
              : null,
          )}

          {layer.fields.map((f, i) =>
            f.emits.map((emit, j) => {
              const p = (t - emit) / f.duration;
              if (p <= 0 || p >= 1) return null;
              const [ox, oy] = place(f.origin);
              return <circle key={`${i}-${j}`} cx={ox} cy={oy} r={f.maxRadius * p} stroke={tokenColor(f.color)} strokeOpacity={0.6 * (1 - p)} strokeWidth={sw(3)} {...ns} />;
            }),
          )}

          {layer.nodes.map((n) => {
            const a = n.visible ? windowAlpha(t, n.visible) : 1;
            if (a <= 0 || n.shape === "glow") return null;
            const [x, y] = n.at;
            if (n.shape === "pad") {
              return a * closeUp > 0 ? (
                <g key={n.id} opacity={a * closeUp}>
                  <circle cx={x} cy={y} r={n.r} fill={COLOR.pad} fillOpacity={0.9} />
                  <circle cx={x} cy={y} r={n.r * 0.34} fill={COLOR.surface} />
                </g>
              ) : null;
            }
            return n.shape === "ring" ? (
              <circle key={n.id} cx={x} cy={y} r={n.r} stroke={tokenColor(n.color)} strokeOpacity={a} strokeWidth={sw(2.4)} {...ns} />
            ) : (
              <circle key={n.id} cx={x} cy={y} r={n.r} fill={tokenColor(n.color)} opacity={a} />
            );
          })}
        </g>

        {signals.map(({ s, tip }, i) => {
          if (!s.head || !tip) return null;
          const [x, y] = toScreen(tip);
          return <GlowDot key={i} x={x} y={y} r={Math.min(40, MATCH_DOT_R * 0.6 * view.zoom)} color={tokenColor(s.color)} />;
        })}

        {layer.nodes.map((n) => {
          const a = n.visible ? windowAlpha(t, n.visible) : 1;
          if (a <= 0) return null;
          const [x, y] = toScreen(n.at);
          const litNow = Math.max(0, ...n.lit.map(([from, to]) => envelope(t, [from, from + 0.15], [to - 0.15, to])));
          const reached = arrivals.get(n.id) ?? [];
          const on = Math.max(0, ...reached.map((arrival) => ramp(t, [arrival, arrival + 0.12])));
          const kick = Math.max(0, ...reached.map((arrival) => (t >= arrival ? Math.exp(-(t - arrival) * 4) : 0)));
          const highlight = lit(n.id);
          return (
            <g key={n.id} opacity={a}>
              {n.shape === "glow" ? (
                <GlowDot x={x} y={y} r={dotR(n.r)} color={litNow > 0 ? COLOR.you : tokenColor(n.color)} intensity={Math.max(litNow, 0.55 + 0.3 * pulse)} />
              ) : litNow > 0 ? (
                <GlowDot x={x} y={y} r={Math.max(dotR(n.r) * 0.75, 12)} color={COLOR.you} intensity={litNow} />
              ) : null}
              {on > 0 ? <GlowDot x={x} y={y} r={Math.max(dotR(MATCH_DOT_R), 12) * on} color={COLOR.you} intensity={0.75 + 0.5 * kick} /> : null}
              {n.flashes.map((f, i) => {
                const dt = t - f;
                if (dt < 0 || dt > 1.5) return null;
                return <circle key={i} cx={x} cy={y} r={dotR(n.r) * (1.4 + dt * 6)} fill="none" stroke={COLOR.you} strokeOpacity={0.85 * Math.exp(-dt * 3)} strokeWidth={4} />;
              })}
              {highlight > 0 ? (
                <circle cx={x} cy={y} r={dotR(n.r) * 2.6 + 6} fill="none" stroke={COLOR.secondary} strokeOpacity={highlight * pulse} strokeWidth={3} />
              ) : null}
            </g>
          );
        })}
        </g>
        {layer.frame ? (
          <path
            d={`M0 ${layer.frame.top}H${WIDTH}M0 ${layer.frame.top + layer.frame.height}H${WIDTH}`}
            stroke={COLOR.gridMajor}
            strokeWidth={2}
          />
        ) : null}
      </svg>
    </AbsoluteFill>
  );
};
