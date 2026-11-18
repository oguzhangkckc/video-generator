import { useId } from "react";
import { COLOR } from "../../theme";

/**
 * World radius of every hand-off dot (pen tip, pacemaker, lit electrode). Two layers showing their dot at the same
 * zoom draw it identically, which is what makes a shape-matched transition between them seamless.
 */
export const MATCH_DOT_R = 9;

/** Screen-space glowing dot; `r` is the core radius in pixels. */
export const GlowDot: React.FC<{ x: number; y: number; r: number; color: string; intensity?: number }> = ({
  x,
  y,
  r,
  color,
  intensity = 1,
}) => {
  const id = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (intensity <= 0 || r <= 0) return null;
  return (
    <g opacity={Math.min(1, intensity)}>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={COLOR.text} stopOpacity={1} />
          <stop offset="0.13" stopColor={color} stopOpacity={1} />
          <stop offset="0.31" stopColor={color} stopOpacity={0.85} />
          <stop offset="0.42" stopColor={color} stopOpacity={0.3} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r * 3.2} fill={`url(#${id})`} />
    </g>
  );
};
