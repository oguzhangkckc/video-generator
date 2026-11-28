import { useMemo } from "react";
import { AbsoluteFill, Easing, spring, useVideoConfig } from "remotion";
import type { LayerOf } from "../../../spec/schema";
import type { CurveFn } from "../../curves";
import { curveFn } from "../../curves";
import { CX, CY, HEIGHT, WIDTH } from "../../format";
import { IDENTITY, pointBox, useFraming } from "../../framing";
import { groundGradient, useGround } from "../../ground";
import { COLOR } from "../../theme";
import { EASING, ramp, sec, useTime, windowAlpha } from "../../time";
import { mentions } from "../../../spec/sentences.ts";
import { LAYOUTS, buildCity } from "./layouts";

/** Screen radius of the marker's halo; ringShrink lands on it. */
export const MARKER_HALO_R = 46;

const MAP_R = 2300;
const DEG = Math.PI / 180;

type CityMapLayer = LayerOf<"cityMap">;

/** Top-down stylised city with a location marker; the zoom follows a curve (camera height in km). */
export const CityMap: React.FC<{ layer: CityMapLayer; curve: (name: string) => CurveFn; name: string }> = ({ layer, curve, name }) => {
  const t = useTime();
  const ground = useGround();
  const { fps } = useVideoConfig();
  const { report, spokenAt } = useFraming();
  const city = useMemo(() => buildCity(layer.seed), [layer.seed]);
  const rotationAt = useMemo(() => (layer.rotation ? curveFn(layer.rotation) : () => 0), [layer.rotation]);
  const { water, avenues, bridges } = LAYOUTS[layer.layout];

  const opacity = Math.max(...layer.visible.map((w) => windowAlpha(t, w)));
  if (opacity <= 0) return null;

  const { zoom, marker, offset } = layer;
  const scale =
    zoom.pushIn && t >= zoom.pushIn.range[0]
      ? 1 + zoom.pushIn.amount * ramp(t, zoom.pushIn.range, [0, 1], Easing.linear)
      : zoom.eyeKm / (zoom.eyeKm + curve(zoom.curve)(t));
  const rotation = rotationAt(t);
  const focusX = offset?.recenter ? offset.px * offset.recenter.amount * ramp(t, offset.recenter.range) : 0;
  const drift = offset ? offset.px * ramp(t, offset.range, [0, 1], EASING.inOutCubic) : 0;

  const toScreen = (x: number, y: number) => {
    const c = Math.cos(rotation * DEG);
    const s = Math.sin(rotation * DEG);
    const dx = (x - focusX) * scale;
    const dy = y * scale;
    return { x: CX + dx * c - dy * s, y: CY + dx * s + dy * c };
  };
  const dot = toScreen(drift, 0);
  const origin = toScreen(0, 0);

  const entered = marker.enter !== undefined && t >= marker.enter.at;
  const appear =
    marker.enter && entered
      ? spring({ frame: Math.round(t * fps) - sec(marker.enter.at), fps, config: { damping: 14, stiffness: 160 } })
      : 0;
  const leaving = marker.exit ? ramp(t, marker.exit.range) : 0;
  const dotAlpha = entered ? Math.min(1, appear) : 1 - leaving;
  const dotScale = entered ? appear : 1 - (marker.exit?.shrink ?? 0) * leaving;
  const haloAlpha =
    entered && marker.enter ? ramp(t, [marker.enter.haloAt - 0.05, marker.enter.haloAt + 0.05]) : dotAlpha;
  const blink = 0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / 1.2);
  const pulse = (t % 1.4) / 1.4;
  // qa: the map fills the frame and is its own subject; the marker is what matters on it.
  if (report) {
    report({
      layer: name,
      type: "cityMap",
      t,
      opacity,
      shot: { kind: scale < 0.8 ? "wide" : scale < 2 ? "medium" : "close" },
      subject: { x1: 0, y1: 0, x2: WIDTH, y2: HEIGHT },
      elements: [
        { id: "marker", kind: "marker", ...pointBox([dot.x, dot.y], MARKER_HALO_R), important: dotAlpha > 0, say: [] },
        ...(layer.say.length
          ? [{ id: "map", kind: "area", x1: 0, y1: 0, x2: WIDTH, y2: HEIGHT, important: layer.say.some((a) => mentions(spokenAt(t), a)), say: layer.say }]
          : []),
      ],
      adjust: IDENTITY,
    });
  }
  const pulsing = marker.pulse.some(([from, to]) => t >= from && t < to);
  const ghost = offset?.ghost ? ramp(t, [offset.range[0] - 0.05, offset.range[0] + 0.15]) : 0;
  const cityGlow = 0.55 * ramp(scale, [0.04, 0.35], [1, 0], Easing.linear);

  return (
    <AbsoluteFill style={{ opacity, background: groundGradient(ground) }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="map-fade" cx={0} cy={0} r={MAP_R} gradientUnits="userSpaceOnUse">
            <stop offset="0.5" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <radialGradient id="city-glow" cx={0} cy={0} r={1500} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={COLOR.streetLight} stopOpacity={1} />
            <stop offset="1" stopColor={COLOR.streetLight} stopOpacity={0} />
          </radialGradient>
          <mask id="map-fade-mask" maskUnits="userSpaceOnUse" x={-MAP_R} y={-MAP_R} width={MAP_R * 2} height={MAP_R * 2}>
            <rect x={-MAP_R} y={-MAP_R} width={MAP_R * 2} height={MAP_R * 2} fill="url(#map-fade)" />
          </mask>
          <mask id="map-land-mask" maskUnits="userSpaceOnUse" x={-MAP_R} y={-MAP_R} width={MAP_R * 2} height={MAP_R * 2}>
            <rect x={-MAP_R} y={-MAP_R} width={MAP_R * 2} height={MAP_R * 2} fill="#fff" />
            {water.map((w, i) => (
              <path key={i} d={w.d} fill="none" stroke="#000" strokeWidth={w.width + 40} />
            ))}
          </mask>
        </defs>

        <g transform={`translate(${CX} ${CY}) rotate(${rotation}) scale(${scale}) translate(${-focusX} 0)`}>
          <circle r={1500} fill="url(#city-glow)" opacity={cityGlow} />
          <g mask="url(#map-fade-mask)">
            {water.map((w, i) => (
              <g key={i}>
                <path d={w.d} fill="none" stroke={COLOR.secondary} strokeOpacity={0.1} strokeWidth={w.width + 26} />
                <path d={w.d} fill="none" stroke={COLOR.water} strokeWidth={w.width} />
              </g>
            ))}
            <g mask="url(#map-land-mask)">
              <path d={city.streets} fill="none" stroke={COLOR.street} strokeWidth={2.2} strokeOpacity={0.8} />
              {avenues.map((d, i) => (
                <g key={i}>
                  <path d={d} fill="none" stroke={COLOR.you} strokeOpacity={0.09} strokeWidth={22} />
                  <path d={d} fill="none" stroke={COLOR.you} strokeOpacity={0.45} strokeWidth={4} />
                </g>
              ))}
              {/* Non-scaling dots: zoomed out, the lights pile up into a city glow instead of vanishing. */}
              {city.lights.map((b, i) => (
                <g key={i}>
                  <path d={b.d} stroke={COLOR.streetLight} strokeOpacity={0.12} strokeWidth={b.width * 3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <path d={b.d} stroke={COLOR.streetLight} strokeOpacity={b.opacity} strokeWidth={b.width} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </g>
            {bridges.map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLOR.streetLight} strokeOpacity={0.75} strokeWidth={5} />
            ))}
          </g>
        </g>

        {ghost > 0 ? (
          <g opacity={ghost}>
            <line x1={origin.x} y1={origin.y} x2={dot.x} y2={dot.y} stroke={COLOR.danger} strokeWidth={5} strokeDasharray="16 12" />
            <circle cx={origin.x} cy={origin.y} r={MARKER_HALO_R} fill="none" stroke={COLOR.marker} strokeOpacity={0.45} strokeWidth={3} strokeDasharray="8 8" />
          </g>
        ) : null}

        <g transform={`translate(${dot.x} ${dot.y}) scale(${dotScale})`} opacity={dotAlpha}>
          {pulsing ? (
            <circle r={MARKER_HALO_R + 80 * pulse} fill="none" stroke={COLOR.marker} strokeWidth={3} strokeOpacity={0.55 * (1 - pulse)} />
          ) : null}
          <circle r={72} fill={COLOR.marker} fillOpacity={0.12 + 0.2 * blink} />
          <circle r={MARKER_HALO_R} fill="none" stroke={COLOR.marker} strokeWidth={3} strokeOpacity={0.9 * haloAlpha} />
          <circle r={17} fill={COLOR.marker} stroke="#fff" strokeWidth={4} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
