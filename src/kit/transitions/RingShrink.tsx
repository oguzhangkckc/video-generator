import { interpolate } from "remotion";
import type { LayerOf } from "../../spec/schema";
import { CX, CY, HEIGHT, WIDTH } from "../format";
import { MARKER_HALO_R } from "../scenes/city-map/CityMap";
import { COLOR } from "../theme";
import { EASING, ramp, useTime } from "../time";

/** A screen-filling ring shrinks onto the marker's halo (shape-matched hand-off). */
export const RingShrink: React.FC<{ layer: LayerOf<"ringShrink"> }> = ({ layer }) => {
  const t = useTime();
  const [start, end] = layer.range;
  if (t < start || t > end + 0.25) return null;

  const p = ramp(t, [start, end], [0, 1], EASING.outCubic);
  const radius = interpolate(p, [0, 1], [layer.fromRadius, layer.toRadius ?? MARKER_HALO_R]);
  const width = interpolate(p, [0, 1], [10, 3]);
  const opacity = ramp(t, [start, start + 0.2]) * (1 - ramp(t, [end, end + 0.25]));

  return (
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
      <circle cx={CX} cy={CY} r={radius} fill="none" stroke={COLOR.secondary} strokeOpacity={0.25 * opacity} strokeWidth={width * 5} />
      <circle cx={CX} cy={CY} r={radius} fill="none" stroke={p > 0.85 ? COLOR.marker : COLOR.secondary} strokeOpacity={opacity} strokeWidth={width} />
    </svg>
  );
};
