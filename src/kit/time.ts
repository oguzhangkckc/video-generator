import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS } from "./format";

export const sec = (s: number) => Math.round(s * FPS);

/** Composition time in seconds; only valid outside offset <Sequence>s. */
export const useTime = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

export const EASING = {
  linear: Easing.linear,
  inQuad: Easing.in(Easing.quad),
  outQuad: Easing.out(Easing.quad),
  inOutQuad: Easing.inOut(Easing.quad),
  inCubic: Easing.in(Easing.cubic),
  outCubic: Easing.out(Easing.cubic),
  inOutCubic: Easing.inOut(Easing.cubic),
  inOutSine: Easing.inOut(Easing.sin),
} as const;
export type EasingName = keyof typeof EASING;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ramp = (
  t: number,
  range: readonly [number, number],
  out: [number, number] = [0, 1],
  easing: (x: number) => number = EASING.inOutQuad,
) => {
  // A spec may legitimately use an instant (zero-length) range; interpolate() would throw on it.
  if (range[1] <= range[0]) return t >= range[1] ? out[1] : out[0];
  return interpolate(t, [range[0], range[1]], out, { ...clamp, easing });
};

/** Fade in over `inRange`, fade out over `outRange`. */
export const envelope = (t: number, inRange: readonly [number, number], outRange: readonly [number, number]) =>
  Math.min(ramp(t, inRange), 1 - ramp(t, outRange));

/** Like envelope(), but either side may be missing (already visible / stays visible). */
export const windowAlpha = (t: number, w: { in?: [number, number]; out?: [number, number] }) =>
  Math.min(w.in ? ramp(t, w.in) : 1, w.out ? 1 - ramp(t, w.out) : 1);
