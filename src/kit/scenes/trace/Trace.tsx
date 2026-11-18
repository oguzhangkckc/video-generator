import { useId, useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { LayerOf } from "../../../spec/schema";
import { Sfx } from "../../audio/Sfx";
import type { CurveFn } from "../../curves";
import { CX, HEIGHT, WIDTH } from "../../format";
import { COLOR, MONO, tokenColor } from "../../theme";
import { envelope, ramp, useTime, windowAlpha } from "../../time";
import { project, strokeAt, viewAt, worldTransform, type Vec } from "../camera2d/camera";
import { GlowDot, MATCH_DOT_R } from "../camera2d/GlowDot";
import { waveform, type Waveform } from "./waveform";

type TraceLayer = LayerOf<"trace">;

const HALF_DIAGONAL = Math.hypot(WIDTH, HEIGHT) / 2;
/** How far back (px at zoom 1) the strip keeps its history. */
const HISTORY_PX = 2400;
/** A corner is sampled on both sides, so vertical edges (square waves) stay vertical. */
const EDGE = 1e-3;

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

/** Signal positions to sample between `from` and `to`, always including every corner. */
const samples = (wave: Waveform, from: number, to: number, step: number) => {
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

/** Scrolling line; the pen's position follows a curve, so it can share a clock with a counter or a diagram. */
export const Trace: React.FC<{ layer: TraceLayer; curve: (name: string) => CurveFn }> = ({ layer, curve }) => {
  const t = useTime();
  const { fps, durationInFrames } = useVideoConfig();
  const gradientId = `trace-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
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

  const { pxPerX, pxPerY, minorX, minorY, majorEvery, legend } = layer.grid;
  const band = layer.frame;
  const pen: Vec = [layer.penX * WIDTH, layer.baselineY];
  const anchor: Vec = [CX, layer.anchorY];
  const view = viewAt(layer.camera, (f) => (f === "frame" ? anchor : f === "pen" ? pen : f), layer.drift, t);
  const toScreen = project(view, anchor);
  const now = clock(t);
  const color = tokenColor(layer.color);

  const reach = HALF_DIAGONAL / view.zoom;
  const left = Math.max(view.fx - reach, pen[0] - HISTORY_PX);
  const right = view.fx + reach;
  const top = view.fy - reach;
  const bottom = view.fy + reach;
  const xAt = (x: number) => pen[0] - (now - x) * pxPerX;
  const yAt = (v: number) => pen[1] - v * pxPerY;
  const xFrom = now - (pen[0] - left) / pxPerX;
  const step = Math.min(2, 1.2 / view.zoom) / pxPerX;
  const line = (from: number, to: number) =>
    samples(wave, from, to, step)
      .map((x) => `${xAt(x).toFixed(2)},${yAt(wave.value(x)).toFixed(2)}`)
      .join(" ");
  const trace = xFrom < now ? line(xFrom, now) : "";

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
      return [{ part, from: Math.max(from, xFrom), drawnTo, lx, ly, glow, alpha: ramp(drawnTo - from, [0, (to - from) * 0.15]) }];
    });
  });

  const [penSx, penSy] = toScreen([pen[0], yAt(wave.value(now))]);
  const legendAlpha = legend ? ramp(view.zoom, [1.15, 1.5], [1, 0]) : 0;

  return (
    <>
      {sounds}
      <AbsoluteFill style={{ opacity, background: band ? undefined : `linear-gradient(180deg, ${COLOR.bgTop} 0%, ${COLOR.bgBottom} 100%)` }}>
        <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
          <defs>
            {band ? (
              <>
                <clipPath id={`${gradientId}-band`}>
                  <rect x={0} y={band.top} width={WIDTH} height={band.height} />
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
          {band ? <rect x={0} y={band.top} width={WIDTH} height={band.height} fill={`url(#${gradientId}-bg)`} /> : null}
          <g clipPath={band ? `url(#${gradientId}-band)` : undefined}>
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
              <polyline key={i} points={line(from, drawnTo)} fill="none" stroke={tokenColor(part.color)} strokeOpacity={Math.min(1, 0.85 * alpha + 0.15 * glow)} strokeWidth={strokeAt(5 + 4 * glow, view.zoom)} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          {band ? null : <rect width={WIDTH} height={HEIGHT} fill={`url(#${gradientId}-vignette)`} />}
          {parts.map(({ part, lx, ly, alpha, glow }, i) => (
            <text key={i} x={lx} y={ly} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={34 * (1 + 0.4 * glow)} fill={glow > 0 ? COLOR.text : tokenColor(part.color)} opacity={Math.max(alpha, glow)} stroke={glow > 0 ? tokenColor(part.color) : COLOR.space} strokeWidth={6} paintOrder="stroke">
              {part.text}
            </text>
          ))}
          <GlowDot x={penSx} y={penSy} r={MATCH_DOT_R * view.zoom} color={color} />
          </g>
          {band ? (
            <path d={`M0 ${band.top}H${WIDTH}M0 ${band.top + band.height}H${WIDTH}`} stroke={COLOR.gridMajor} strokeWidth={2} />
          ) : null}
        </svg>
        {legendAlpha > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 80,
              top: band ? band.top + band.height - 34 : toScreen([0, pen[1]])[1] + 230,
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
