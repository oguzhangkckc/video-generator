import { useMemo } from "react";
import { random } from "remotion";
import type { LayerOf } from "../../spec/schema";
import { CX, CY, HEIGHT, WIDTH } from "../format";
import { COLOR } from "../theme";
import { envelope, useTime } from "../time";

const COUNT = 56;

/** Radial light streaks while the camera rides something at "light speed". */
export const SpeedLines: React.FC<{ layer: LayerOf<"speedLines"> }> = ({ layer }) => {
  const t = useTime();
  const strength = envelope(t, layer.envelope.in, layer.envelope.out);
  const lines = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        angle: random(`sl-a-${i}`) * Math.PI * 2,
        speed: 0.55 + random(`sl-s-${i}`) * 0.7,
        phase: random(`sl-p-${i}`),
        width: 1.5 + random(`sl-w-${i}`) * 2,
        color: i % 3 === 0 ? COLOR.text : COLOR.secondary,
      })),
    [],
  );
  if (strength <= 0) return null;

  return (
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
      {lines.map((line, i) => {
        const cycle = (t * line.speed + line.phase) % 1;
        const r = 140 + 1250 * cycle * cycle;
        const length = 30 + r * 0.28;
        const dx = Math.cos(line.angle);
        const dy = Math.sin(line.angle);
        return (
          <line
            key={i}
            x1={CX + dx * r}
            y1={CY + dy * r}
            x2={CX + dx * (r + length)}
            y2={CY + dy * (r + length)}
            stroke={line.color}
            strokeWidth={line.width}
            strokeLinecap="round"
            strokeOpacity={0.55 * strength * Math.sqrt(cycle)}
          />
        );
      })}
    </svg>
  );
};
