// A flow scene's squeeze: a named group of elements (and, optionally, only the part of them on one side of a line)
// contracts toward a centre and relaxes again, e.g. the heart's lower chambers beating. Pure, so the Node tests and qa
// import it.
type Vec = [number, number];

export type Side = { below?: number; above?: number; soft: number };
export type SqueezeSpec = { group?: string; side?: Side; range: [number, number]; center: Vec; scale: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** How far into its squeeze the group is at t: 0 relaxed, 1 fully contracted; it contracts fast and relaxes slower. */
export const squeezeLevel = ([a, b]: [number, number], t: number) => {
  if (t <= a || t >= b) return 0;
  const d = b - a;
  const inEnd = a + 0.35 * d;
  const outStart = a + 0.45 * d;
  if (t < inEnd) return smooth((t - a) / (inEnd - a));
  if (t <= outStart) return 1;
  return smooth(1 - (t - outStart) / (b - outStart));
};

/** How much a point takes part, by the side of a horizontal line it is on (soft over `soft` world px). */
export const sideWeight = (side: Side | undefined, [, y]: Vec) => {
  if (!side) return 1;
  const below = side.below === undefined ? 1 : smooth(clamp01((y - side.below) / side.soft));
  const above = side.above === undefined ? 1 : smooth(clamp01((side.above - y) / side.soft));
  return Math.min(below, above);
};

/** `p` (a point of the element `id`) at t, after every squeeze that takes the element in. */
export const warpPoint = (squeezes: SqueezeSpec[], groups: Record<string, readonly string[]>, id: string, p: Vec, t: number): Vec =>
  squeezes.reduce<Vec>((q, s) => {
    if (s.group && !groups[s.group]?.includes(id)) return q;
    const level = squeezeLevel(s.range, t);
    if (!level) return q;
    const k = 1 - (1 - s.scale) * level * sideWeight(s.side, p);
    return [s.center[0] + (q[0] - s.center[0]) * k, s.center[1] + (q[1] - s.center[1]) * k];
  }, p);
