import { useId, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import type { CurveFn } from "../../curves";
import { CX, HEIGHT, WIDTH } from "../../format";
import { adjustFor, currentShot, shotKind, useFraming } from "../../framing";
import { groundGradient, useGround } from "../../ground";
import { COLOR, EDGE, SURFACE, tokenColor, type ColorToken } from "../../theme";
import { envelope, ramp, useTime, windowAlpha } from "../../time";
import { strokeAt, worldTransform } from "../camera2d/camera";
import { GlowDot, MATCH_DOT_R } from "../camera2d/GlowDot";
import { toPath } from "../camera2d/paths";
import { flowElements, flowGeometry, flowState, flowSubject, geometryAt, squeezeSizes, type FlowLayer } from "./model";

const ns = { vectorEffect: "non-scaling-stroke" as const, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const pathColor = (c: ColorToken | "surface" | "faint") => (c === "surface" || c === "faint" ? EDGE[c] : tokenColor(c));

/** Diagram scene: regions, paths, nodes and the signals that travel through them. */
export const Flow: React.FC<{ layer: FlowLayer; curve: (name: string) => CurveFn; name: string }> = ({ layer, curve, name }) => {
  const t = useTime();
  const ground = useGround();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const base = useMemo(() => flowGeometry(layer), [layer]);
  const geo = geometryAt(layer, base, t);
  const framing = useFraming();
  const opacity = Math.max(...layer.visible.map((w) => windowAlpha(t, w)));
  if (opacity <= 0) return null;

  const elementsAt = (u: number) => {
    const g = geometryAt(layer, base, u);
    return flowElements(layer, g, flowState(layer, g, curve, u), u, framing.spokenAt(u));
  };
  const adjust = adjustFor(framing, name, elementsAt, [CX, layer.anchorY], t);
  const st = flowState(layer, geo, curve, t, adjust);
  const { place, progressAt, view, anchor, toScreen, lit, signals, arrivals } = st;
  if (framing.report) {
    const elements = flowElements(layer, geo, st, t, framing.spokenAt(t));
    const shot = currentShot(layer.camera, t);
    framing.report({
      layer: name,
      type: "flow",
      t,
      opacity,
      shot: { kind: shotKind(shot), subject: shot.subject },
      subject: flowSubject(layer, geo, st, t, elements),
      elements,
      adjust,
      ...(layer.squeeze.length ? { actions: squeezeSizes(layer, base, geo, st) } : {}),
    });
  }
  const sw = (base: number) => strokeAt(base, view.zoom);
  const pulse = 0.75 + 0.25 * Math.sin(t * 2 * Math.PI * 1.1);
  const closeUp = ramp(view.zoom, [3, 7], [1, 0]);
  const dotR = (r: number) => r * view.zoom;

  return (
    <AbsoluteFill style={{ opacity, background: groundGradient(ground) }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          {layer.regions.map((r) => (
            <clipPath key={r.id} id={`${uid}-${r.id}`}>
              <path d={toPath(geo.regions.get(r.id)!, true)} />
            </clipPath>
          ))}
        </defs>

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
      </svg>
    </AbsoluteFill>
  );
};
