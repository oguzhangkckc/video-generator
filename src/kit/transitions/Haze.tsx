import { AbsoluteFill } from "remotion";
import type { LayerOf } from "../../spec/schema";
import { GROUND_KEY, useGround } from "../ground";
import { HAZE_STOPS } from "../theme";
import { envelope, useTime } from "../time";

/** Blue atmosphere haze: passing through the air layer instead of cutting. */
export const Haze: React.FC<{ layer: LayerOf<"haze"> }> = ({ layer }) => {
  const t = useTime();
  const { keyed } = useGround();
  const a = layer.envelopes.reduce((sum, e) => sum + envelope(t, e.in, e.out), 0);
  if (a <= 0) return null;
  const [s0, s1, s2] = HAZE_STOPS.map(([r, g, b, peak]) => (keyed ? [...GROUND_KEY, peak] : [r, g, b, peak]));

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, rgba(${s0[0]},${s0[1]},${s0[2]},${s0[3] * a}) 0%, rgba(${s1[0]},${s1[1]},${s1[2]},${s1[3] * a}) 45%, rgba(${s2[0]},${s2[1]},${s2[2]},${s2[3] * a}) 100%)`,
      }}
    />
  );
};
