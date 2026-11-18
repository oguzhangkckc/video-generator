import type { Spec } from "../spec/schema";
import { EASING, ramp } from "./time";

export type Curve = Spec["curves"][string];
export type CurveFn = (t: number) => number;

/** Before a segment starts the previous segment's end value holds; a boundary belongs to the earlier segment. */
export const curveFn =
  (curve: Curve): CurveFn =>
  (t) => {
    const { segments } = curve;
    const i = segments.findIndex((s) => t <= s.to);
    if (i === -1) return segments[segments.length - 1].values[1];
    const s = segments[i];
    if (t < s.from) return i === 0 ? s.values[0] : segments[i - 1].values[1];

    const p = ramp(t, [s.from, s.to], [0, 1], EASING[s.easing]);
    const [a, b] = s.values;
    if (s.scale === "linear") return a + p * (b - a);
    const e = s.logOffset;
    return Math.exp(Math.log(a + e) + p * (Math.log(b + e) - Math.log(a + e))) - e;
  };
