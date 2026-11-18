import { interpolate } from "remotion";
import type { LayerOf } from "../../spec/schema";
import { CX, CY, HEIGHT, WIDTH } from "../format";
import { useRig } from "../scenes/globe/rig-context";
import { COLOR } from "../theme";
import { ramp, useTime } from "../time";

/** Rings leave a 3D point and rush past the camera: the "fly through the signal ring" beat. */
export const SignalPass: React.FC<{ layer: LayerOf<"signalPass"> }> = ({ layer }) => {
  const t = useTime();
  const rig = useRig(layer.anchor.layer);
  const { emits, duration } = layer;
  if (t < emits[0] || t > emits[emits.length - 1] + duration) return null;
  const origin = rig.project(rig.anchor(layer.anchor.point, t), t);

  return (
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
      {emits.map((at, i) => {
        const age = t - at;
        if (age < 0 || age > duration) return null;
        const p = age / duration;
        const approach = p * p * p;
        const r = 18 + 1500 * approach;
        const width = 3 + 14 * approach;
        const opacity = Math.min(1, age / 0.12) * (1 - ramp(p, [0.75, 1]));
        const cx = interpolate(approach, [0, 1], [origin.x, CX]);
        const cy = interpolate(approach, [0, 1], [origin.y, CY]);
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLOR.secondary} strokeOpacity={0.18 * opacity} strokeWidth={width * 4} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLOR.secondary} strokeOpacity={opacity} strokeWidth={width} />
          </g>
        );
      })}
    </svg>
  );
};
