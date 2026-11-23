import { useId, useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Sfx } from "../../audio/Sfx";
import type { CurveFn } from "../../curves";
import { CX, HEIGHT, WIDTH } from "../../format";
import { adjustFor, currentShot, shotKind, useFraming } from "../../framing";
import { stripBox } from "../../overlays/boxes";
import { COLOR, MONO, tokenColor } from "../../theme";
import { ramp, useTime, windowAlpha } from "../../time";
import { strokeAt, worldTransform } from "../camera2d/camera";
import { GlowDot, MATCH_DOT_R } from "../camera2d/GlowDot";
import { traceElements, traceLabels, traceLine, traceState, LABEL_SIZE, type TraceLayer } from "./model";
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
  const band = layer.frame;
  const panel = layer.panel ? stripBox(layer.panel) : null;
  const area = panel ?? (band ? { x1: 0, y1: band.top, x2: WIDTH, y2: band.top + band.height } : { x1: 0, y1: 0, x2: WIDTH, y2: HEIGHT });
  // A data strip is itself an overlay: only a scene trace moves out of the way of the others.
  const adjust = panel
    ? { dx: 0, dy: 0, s: 1 }
    : adjustFor(framing, name, (u) => traceElements(traceState(layer, wave, clock, u), framing.spokenAt(u)).filter((e) => e.important), [CX, layer.anchorY], t);
  const st = traceState(layer, wave, clock, t, adjust);
  const { pen, view, anchor, toScreen, now, xAt, xFrom, points, parts, penScreen, reach, left } = st;
  if (framing.reports) {
    const elements = traceElements(st, framing.spokenAt(t));
    const shot = currentShot(layer.camera, t);
    const { subject, line } = traceLine(st, area);
    framing.reports.set(name, {
      layer: name,
      type: panel ? "strip" : "trace",
      opacity,
      shot: { kind: shotKind(shot), subject: shot.subject },
      subject,
      elements,
      labels: traceLabels(st),
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
  const clipped = Boolean(band || panel);

  return (
    <>
      {sounds}
      <AbsoluteFill style={{ opacity, background: clipped ? undefined : `linear-gradient(180deg, ${COLOR.bgTop} 0%, ${COLOR.bgBottom} 100%)` }}>
        <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
          <defs>
            {clipped ? (
              <>
                <clipPath id={`${gradientId}-band`}>
                  <rect x={area.x1} y={area.y1} width={area.x2 - area.x1} height={area.y2 - area.y1} rx={panel ? 16 : 0} />
                </clipPath>
                <linearGradient id={`${gradientId}-bg`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={COLOR.bgTop} />
                  <stop offset="1" stopColor={COLOR.bgBottom} />
                </linearGradient>
              </>
            ) : null}
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={pen[0] - 1100} y1={0} x2={pen[0]} y2={0}>
              <stop offset="0" stopColor={color} stopOpacity={0.1} />
              <stop offset="0.55" stopColor={color} stopOpacity={0.7} />
              <stop offset="1" stopColor={color} stopOpacity={1} />
            </linearGradient>
            <radialGradient id={`${gradientId}-vignette`} cx="50%" cy="50%" r="75%">
              <stop offset="0.55" stopColor={COLOR.space} stopOpacity={0} />
              <stop offset="1" stopColor={COLOR.space} stopOpacity={0.85} />
            </radialGradient>
          </defs>
          {panel ? (
            <rect x={area.x1} y={area.y1} width={area.x2 - area.x1} height={area.y2 - area.y1} rx={16} fill={COLOR.labelBackdrop} />
          ) : band ? (
            <rect x={0} y={band.top} width={WIDTH} height={band.height} fill={`url(#${gradientId}-bg)`} />
          ) : null}
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
            {parts.map(({ part, lx, ly, alpha, glow }, i) => (
              <text key={i} x={lx} y={ly} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={LABEL_SIZE * (1 + 0.4 * glow)} fill={glow > 0 ? COLOR.text : tokenColor(part.color)} opacity={Math.max(alpha, glow)} stroke={glow > 0 ? tokenColor(part.color) : COLOR.space} strokeWidth={6} paintOrder="stroke">
                {part.text}
              </text>
            ))}
            <GlowDot x={penScreen[0]} y={penScreen[1]} r={MATCH_DOT_R * view.zoom} color={color} />
          </g>
          {band ? (
            <path d={`M0 ${band.top}H${WIDTH}M0 ${band.top + band.height}H${WIDTH}`} stroke={COLOR.gridMajor} strokeWidth={2} />
          ) : null}
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
