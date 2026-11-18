import type { LayerOf } from "../../../spec/schema";

type Beat = LayerOf<"ecgTrace">["beat"];

const hump = (x: number, [a, b]: [number, number], mv: number) =>
  x <= a || x >= b ? 0 : mv * Math.sin((Math.PI * (x - a)) / (b - a)) ** 2;

export type Waveform = {
  period: number;
  /** ms after the pacemaker fires at which R peaks. */
  rPeak: number;
  /** Corners of the QRS polyline inside one period; sampling must hit them or the spike gets clipped. */
  corners: number[];
  mv: (ms: number) => number;
};

export const waveform = (beat: Beat): Waveform => {
  const period = 60000 / beat.bpm;
  const [q0, q1] = beat.qrs.range;
  const d = q1 - q0;
  const qrs: [number, number][] = [
    [q0, 0],
    [q0 + 0.15 * d, beat.qrs.q],
    [q0 + 0.4 * d, beat.qrs.r],
    [q0 + 0.68 * d, beat.qrs.s],
    [q1, 0],
  ];

  const mv = (ms: number) => {
    const x = ((ms % period) + period) % period;
    let v = hump(x, beat.p.range, beat.p.mv) + hump(x, beat.t.range, beat.t.mv);
    if (x > q0 && x < q1) {
      const i = qrs.findIndex(([px]) => px >= x);
      const [xa, ya] = qrs[i - 1];
      const [xb, yb] = qrs[i];
      v += ya + ((x - xa) / (xb - xa)) * (yb - ya);
    }
    const n = beat.noiseMv;
    return v + n * (Math.sin(ms * 0.031) * 0.6 + Math.sin(ms * 0.0117 + 1.3) * 0.4 + Math.sin(ms * 0.173 + 0.4) * 0.25);
  };

  return { period, rPeak: qrs[2][0], corners: qrs.map(([x]) => x), mv };
};
