import type { LayerOf } from "../../../spec/schema";

type WaveformSpec = LayerOf<"trace">["waveform"];

/** One beat in ms after the pacemaker fires (Klabunde, CV Physiology): P 0–90, QRS 160–230, T 330–490. */
export const ECG_DEFAULTS = { p: [0, 90], qrs: [160, 230], t: [330, 490] } as const satisfies Record<string, [number, number]>;

export type Waveform = {
  period: number;
  /** Positions inside a period where a beep plays (the R peak, a sine crest…). */
  peaks: number[];
  /** Sharp corners inside a period; sampling must hit them exactly or spikes get clipped. */
  corners: number[];
  value: (x: number) => number;
};

const hump = (x: number, [a, b]: [number, number], amp: number) =>
  x <= a || x >= b ? 0 : amp * Math.sin((Math.PI * (x - a)) / (b - a)) ** 2;

/** Polyline through [x, value] corners, 0 outside them. */
const polyline = (points: [number, number][]) => (x: number) => {
  if (x <= points[0][0] || x >= points[points.length - 1][0]) return 0;
  const i = points.findIndex(([px]) => px >= x);
  const [xa, ya] = points[i - 1];
  const [xb, yb] = points[i];
  return ya + ((x - xa) / (xb - xa)) * (yb - ya);
};

/** Deterministic baseline wander, so the line looks recorded rather than drawn. */
const wander = (x: number) => Math.sin(x * 0.031) * 0.6 + Math.sin(x * 0.0117 + 1.3) * 0.4 + Math.sin(x * 0.173 + 0.4) * 0.25;

const shape = (w: WaveformSpec): Omit<Waveform, "value"> & { local: (x: number) => number } => {
  switch (w.preset) {
    case "ecg": {
      const [q0, q1] = w.qrs.range ?? ECG_DEFAULTS.qrs;
      const d = q1 - q0;
      const qrs: [number, number][] = [
        [q0, 0],
        [q0 + 0.15 * d, w.qrs.q],
        [q0 + 0.4 * d, w.qrs.r],
        [q0 + 0.68 * d, w.qrs.s],
        [q1, 0],
      ];
      const spike = polyline(qrs);
      return {
        period: 60000 / w.bpm,
        peaks: [qrs[2][0]],
        corners: qrs.map(([x]) => x),
        local: (x) => hump(x, w.p.range ?? ECG_DEFAULTS.p, w.p.mv) + spike(x) + hump(x, w.t.range ?? ECG_DEFAULTS.t, w.t.mv),
      };
    }
    case "sine":
      return {
        period: w.period,
        peaks: [w.period / 4],
        corners: [],
        local: (x) => w.amplitude * Math.sin((2 * Math.PI * x) / w.period),
      };
    case "square":
      return {
        period: w.period,
        peaks: [0],
        corners: [0, w.period / 2],
        local: (x) => (x < w.period / 2 ? w.amplitude : -w.amplitude),
      };
    case "saw":
      return {
        period: w.period,
        peaks: [0],
        corners: [0],
        local: (x) => w.amplitude * ((2 * x) / w.period - 1),
      };
    case "samples": {
      const points = [...w.points].sort((a, b) => a[0] - b[0]);
      const line = polyline(points);
      const top = points.reduce((best, p) => (p[1] > best[1] ? p : best));
      return { period: w.period, peaks: [top[0]], corners: points.map(([x]) => x), local: line };
    }
  }
};

export const waveform = (w: WaveformSpec): Waveform => {
  const { period, peaks, corners, local } = shape(w);
  return {
    period,
    peaks,
    corners,
    value: (x) => local(((x % period) + period) % period) + w.noise * wander(x),
  };
};
