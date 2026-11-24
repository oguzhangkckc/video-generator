import type { Vec } from "./camera";

/** Uniform Catmull-Rom through the points, sampled into a polyline. */
export const spline = (points: Vec[], closed = false, samples = 14): Vec[] => {
  const n = points.length;
  if (n < 3) return closed ? [...points, points[0]] : points;
  const at = (i: number): Vec => (closed ? points[((i % n) + n) % n] : points[Math.min(n - 1, Math.max(0, i))]);
  const out: Vec[] = [];
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < samples; s++) {
      const u = s / samples;
      const u2 = u * u;
      const u3 = u2 * u;
      const coord = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * u +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
      out.push([coord(0), coord(1)]);
    }
  }
  if (!closed) out.push(points[n - 1]);
  return out;
};

const dist = (a: Vec, b: Vec) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export const polylineLength = (points: Vec[]) =>
  points.reduce((sum, p, i) => (i === 0 ? 0 : sum + dist(points[i - 1], p)), 0);

/** The first `fraction` of a polyline (by length) and the point where it ends. */
export const slice = (points: Vec[], fraction: number, total = polylineLength(points)) => {
  const target = Math.max(0, Math.min(1, fraction)) * total;
  const out: Vec[] = [points[0]];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const d = dist(points[i - 1], points[i]);
    if (walked + d >= target) {
      const u = d === 0 ? 0 : (target - walked) / d;
      const tip: Vec = [
        points[i - 1][0] + (points[i][0] - points[i - 1][0]) * u,
        points[i - 1][1] + (points[i][1] - points[i - 1][1]) * u,
      ];
      out.push(tip);
      return { points: out, tip };
    }
    walked += d;
    out.push(points[i]);
  }
  return { points: out, tip: points[points.length - 1] };
};

export const toPath = (points: Vec[], closed = false) =>
  points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + (closed ? "Z" : "");
