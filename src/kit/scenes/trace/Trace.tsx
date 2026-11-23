import { useId, useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Sfx } from "../../audio/Sfx";
import type { CurveFn } from "../../curves";
import { CX, HEIGHT, WIDTH } from "../../format";
import { adjustFor, currentShot, shotKind, useFraming } from "../../framing";
import { groundGradient, useGround } from "../../ground";
import { stripBox } from "../../overlays/boxes";
import { COLOR, MONO, tokenColor } from "../../theme";
import { ramp, useTime, windowAlpha } from "../../time";
import { strokeAt, worldTransform } from "../camera2d/camera";
import { GlowDot, MATCH_DOT_R } from "../camera2d/GlowDot";
import { traceElements, traceLabels, traceLine, traceState, type TraceLayer } from "./model";
import { waveform, type Waveform } from "./waveform";

const beepTimes = (layer: TraceLayer, clock: CurveFn, wave: Waveform, fps: number, frames: number) => {
  if (!layer.beep) return [];
  const { ranges } = layer.beep;
  const times: number[] = [];
  for (const peak of wave.peaks) {
    const index = (t: number) => Math.floor((clock(t) - peak) / wave.period);
    let previous = index(0);
    for (let f = 1; f < frames; f++) {
      const t = f / fps;
      const i = index(t);
      if (i > previous && ranges.some(([a, b]) => t >= a && t <= b)) times.push(t);
      previous = i;
    }
  }
  return times.sort((a, b) => a - b);
};

const toPoints = (points: [number, number][]) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

/**
 * Scrolling line; the pen's position follows a curve, so it can share a clock with a counter or a diagram. Full
 * frame as a scene; with `panel`, a data strip in a dark panel on top of the scenes.
 */
export const Trace: React.FC<{ layer: TraceLayer; curve: (name: string) => CurveFn; name: string }> = ({ layer, curve, name }) => {
  const t = useTime();
  const { fps, durationInFrames } = useVideoConfig();
  const gradientId = `trace-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const framing = useFraming();
  const ground = useGround();
  const clock = curve(layer.clock);
  const wave = useMemo(() => waveform(layer.waveform), [layer.waveform]);
  const beeps = useMemo(
    () => beepTimes(layer, clock, wave, fps, durationInFrames),
    [layer, clock, wave, fps, durationInFrames],
  );
  const sounds = layer.beep
    ? beeps.map((at, i) => <Sfx key={i} id={layer.beep!.id} at={at} gain={layer.beep!.gain} />)
    : null;

  const opacity = Math.max(...layer.visible.map((w) => windowAlpha(t, w)));
  if (opacity <= 0) return <>{sounds}</>;

  const { pxPerY, minorX, minorY, majorEvery, legend } = layer.grid;
  const panel = layer.panel ? stripBox(layer.panel) : null;
  const area = panel ?? { x1: 0, y1: 0, x2: WIDTH, y2: HEIGHT };
  // A data strip is itself an overlay: only a scene trace moves out of the way of the others.
  const adjust = panel
    ? { dx: 0, dy: 0, s: 1 }
    : adjustFor(framing, name, (u) => traceElements(traceState(layer, wave, clock, u), framing.spokenAt(u)).filter((e) => e.important), [CX, layer.anchorY], t);
  const st = traceState(layer, wave, clock, t, adjust);
  const { pen, view, anchor, toScreen, now, xAt, xFrom, points, parts, penScreen, reach, left } = st;
  const { subject, line } = traceLine(st, area);
  const labels = traceLabels(st, line);
  if (framing.report) {
    const shot = currentShot(layer.camera, t);
    framing.report({
      layer: name,
      type: panel ? "strip" : "trace",
      opacity,
      shot: { kind: shotKind(shot), subject: shot.subject },
      subject,
      elements: traceElements(st, framing.spokenAt(t)),
      labels,
      line,
      adjust,
    });
  }
  const color = tokenColor(layer.color);
  const right = view.fx + reach;
  const top = view.fy - reach;
  const bottom = view.fy + reach;
  const trace = xFrom < now ? toPoints(points(xFrom, now)) : "";

  let minor = "";
  let major = "";
  for (let j = Math.ceil(xFrom / minorX); ; j++) {
    const x = xAt(j * minorX);
    if (x > right) break;
    const d = `M${x.toFixed(1)} ${top.toFixed(0)}V${bottom.toFixed(0)}`;
    if (j % majorEvery === 0) major += d;
    else minor += d;
  }
  const pxMinorY = minorY * pxPerY;
  for (let i = Math.ceil((top - pen[1]) / pxMinorY); pen[1] + i * pxMinorY <= bottom; i++) {
    const d = `M${left.toFixed(0)} ${(pen[1] + i * pxMinorY).toFixed(1)}H${right.toFixed(0)}`;
    if (i % majorEvery === 0) major += d;
    else minor += d;
  }

  const legendAlpha = legend ? ramp(view.zoom, [1.15, 1.5], [1, 0]) : 0;
  const clipped = Boolean(panel);

  return (
    <>
      {sounds}
      <AbsoluteFill style={{ opacity, background: clipped ? undefined : groundGradient(ground) }}>
        <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
          <defs>
            {clipped ? (
              <>
                <clipPath id={`${gradientId}-band`}>
                  <rect x={area.x1} y={area.y1} width={area.x2 - area.x1} height={area.y2 - area.y1} rx={panel ? 16 : 0} />
                </clipPath>
                <linearGradient id={`${gradientId}-bg`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={ground.top} />
                  <stop offset="1" stopColor={ground.bottom} />
                </linearGradient>
              </>
            ) : null}
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={pen[0] - 1100} y1={0} x2={pen[0]} y2={0}>
              <stop offset="0" stopColor={color} stopOpacity={0.1} />
              <stop offset="0.55" stopColor={color} stopOpacity={0.7} />
              <stop offset="1" stopColor={color} stopOpacity={1} />
            </linearGradient>
            <radialGradient id={`${gradientId}-vignette`} cx="50%" cy="50%" r="75%">
              <stop offset="0.55" stopColor={ground.space} stopOpacity={0} />
              <stop offset="1" stopColor={ground.space} stopOpacity={0.85} />
            </radialGradient>
          </defs>
          {panel ? <rect x={area.x1} y={area.y1} width={area.x2 - area.x1} height={area.y2 - area.y1} rx={16} fill={COLOR.labelBackdrop} /> : null}
          <g clipPath={clipped ? `url(#${gradientId}-band)` : undefined}>
            <g transform={worldTransform(view, anchor)}>
              <path d={minor} stroke={COLOR.gridMinor} strokeWidth={strokeAt(1, view.zoom)} vectorEffect="non-scaling-stroke" />
              <path d={major} stroke={COLOR.gridMajor} strokeWidth={strokeAt(1.6, view.zoom)} vectorEffect="non-scaling-stroke" />
              {trace ? (
                <>
                  <polyline points={trace} fill="none" stroke={`url(#${gradientId})`} strokeOpacity={0.2} strokeWidth={strokeAt(10, view.zoom)} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <polyline points={trace} fill="none" stroke={`url(#${gradientId})`} strokeWidth={strokeAt(3.4, view.zoom)} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </>
              ) : null}
              {parts.map(({ part, from, drawnTo, alpha, glow }, i) => (
                <polyline key={i} points={toPoints(points(from, drawnTo))} fill="none" stroke={tokenColor(part.color)} strokeOpacity={Math.min(1, 0.85 * alpha + 0.15 * glow)} strokeWidth={strokeAt(5 + 4 * glow, view.zoom)} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            {clipped ? null : <rect width={WIDTH} height={HEIGHT} fill={`url(#${gradientId}-vignette)`} />}
            {labels.map((l, i) => {
              const ink = tokenColor(l.color as Parameters<typeof tokenColor>[0]);
              const a = Math.max(l.alpha, l.glow);
              return (
                <g key={i} opacity={a}>
                  {l.leader ? (
                    <line x1={l.leader[0][0]} y1={l.leader[0][1]} x2={l.leader[1][0]} y2={l.leader[1][1]} stroke={ink} strokeOpacity={0.7} strokeWidth={2} />
                  ) : null}
                  {l.bracket ? (
                    <path d={`M${l.bracket.x1} ${l.bracket.y - 12}V${l.bracket.y}H${l.bracket.x2}V${l.bracket.y - 12}`} fill="none" stroke={ink} strokeWidth={2.5} />
                  ) : null}
                  <text x={(l.x1 + l.x2) / 2} y={l.y2} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={l.size} fill={l.glow > 0 ? COLOR.text : ink} stroke={l.glow > 0 ? ink : COLOR.space} strokeWidth={6} paintOrder="stroke">
                    {l.text}
                  </text>
                </g>
              );
            })}
            <GlowDot x={penScreen[0]} y={penScreen[1]} r={MATCH_DOT_R * view.zoom} color={color} />
          </g>
        </svg>
        {legendAlpha > 0 ? (
          <div
            style={{
              position: "absolute",
              left: panel ? area.x1 + 40 : 80,
              top: clipped ? area.y2 - 34 : toScreen([0, pen[1]])[1] + 230,
              opacity: legendAlpha,
              fontFamily: MONO,
              fontWeight: 500,
              fontSize: 24,
              letterSpacing: "0.12em",
              color: COLOR.muted,
            }}
          >
            {legend}
          </div>
        ) : null}
      </AbsoluteFill>
    </>
  );
};
