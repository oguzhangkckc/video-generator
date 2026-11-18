import { AbsoluteFill } from "remotion";
import type { Spec } from "../../spec/schema";
import { ramp, useTime } from "../time";

export const Darken: React.FC<{ darken: NonNullable<Spec["darken"]> }> = ({ darken }) => {
  const alpha = darken.alpha * ramp(useTime(), darken.range);
  return alpha > 0 ? <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${alpha})` }} /> : null;
};
