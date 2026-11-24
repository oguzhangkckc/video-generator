// Where a trace's part labels go (STYLE.md "Veri çizgisi etiketleri"): a stretch (PR, a duration) is bracketed under
// the line, a point or wave (P, QRS, T) is labelled above its peak with a short leader. No label touches another or
// crosses the line; labels that would collide slide sideways, then step up (or, for brackets, down) a row.
import type { Box } from "../../overlays/geometry";
import type { Vec } from "../camera2d/camera";

export type PartPlace = {
  text: string;
  marker: "bracket" | "leader";
  /** The part's drawn line in screen px. */
  points: Vec[];
  width: number;
  height: number;
};
export type PlacedLabel = Box & {
  text: string;
  marker: "bracket" | "leader";
  /** From the part's peak to the label. */
  leader?: [Vec, Vec];
  /** The bracket under the part: from x1 to x2 at y, with ticks up. */
  bracket?: { x1: number; x2: number; y: number };
};

const GAP = 8;
const ABOVE = 28;
const BELOW = 24;
const TICK = 12;
const ROWS = 4;

const overlaps = (a: Box, b: Box) => a.x1 < b.x2 + GAP && a.x2 > b.x1 - GAP && a.y1 < b.y2 + GAP && a.y2 > b.y1 - GAP;

/** The line's highest (smallest y) and lowest point between two screen x. */
const extent = (line: Vec[], x1: number, x2: number) => {
  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < line.length; i++) {
    const [x, y] = line[i];
    const [px, py] = line[i - 1] ?? line[i];
    if (Math.max(x, px) < x1 || Math.min(x, px) > x2) continue;
    top = Math.min(top, y, py);
    bottom = Math.max(bottom, y, py);
  }
  return { top, bottom };
};

/** Height a label of `height` needs above a peak (leader) or below the line (bracket), first row. */
export const labelRoom = (height: number) => ({ above: ABOVE + height, below: BELOW + GAP + height });

/**
 * Labels for the drawn parts; `line` is the whole visible line, so a label clears every bit of it. A label stays
 * inside `area` (a strip's panel clips the rest) when any spot there is free; otherwise it takes the first free one
 * and qa reports it.
 */
export const placeLabels = (parts: PartPlace[], line: Vec[], area?: Box): PlacedLabel[] => {
  const placed: PlacedLabel[] = [];
  let within = Boolean(area);
  const inside = (b: Box) => !within || !area || (b.x1 >= area.x1 && b.x2 <= area.x2 && b.y1 >= area.y1 && b.y2 <= area.y2);
  const clear = (b: Box) => inside(b) && !placed.some((p) => overlaps(b, p)) && (() => {
    const { top, bottom } = extent(line, b.x1 - GAP, b.x2 + GAP);
    return !(b.y2 + GAP > top && b.y1 - GAP < bottom);
  })();

  const leaders = parts.filter((p) => p.marker === "leader" && p.points.length);
  const brackets = parts.filter((p) => p.marker === "bracket" && p.points.length);
  const firstFree = (search: () => PlacedLabel | null) => {
    within = Boolean(area);
    const spot = search();
    if (spot || !area) return spot;
    within = false;
    return search();
  };

  for (const p of [...leaders].sort((a, b) => a.points[0][0] - b.points[0][0])) {
    const peak = p.points.reduce((best, q) => (q[1] < best[1] ? q : best), p.points[0]);
    const spot = firstFree(() => {
      for (let row = 0; row < ROWS; row++) {
        for (const shift of [0, 0.6, -0.6, 1.2, -1.2]) {
          const cx = peak[0] + shift * p.width;
          const x1 = cx - p.width / 2;
          const { top } = extent(line, x1 - GAP, x1 + p.width + GAP);
          const y2 = Math.min(top, peak[1]) - ABOVE - row * (p.height + GAP);
          const box = { x1, y1: y2 - p.height, x2: x1 + p.width, y2 };
          if (clear(box)) return { ...box, text: p.text, marker: "leader", leader: [[peak[0], peak[1] - 6], [cx, y2 + 4]] };
        }
      }
      return null;
    });
    if (spot) placed.push(spot);
  }

  for (const p of [...brackets].sort((a, b) => a.points[0][0] - b.points[0][0])) {
    const xs = p.points.map((q) => q[0]);
    const [bx1, bx2] = [Math.min(...xs), Math.max(...xs)];
    const { bottom } = extent(line, bx1, bx2);
    const cx = (bx1 + bx2) / 2;
    const spot = firstFree(() => {
      for (let row = 0; row < ROWS; row++) {
        const y = bottom + BELOW + row * (p.height + TICK + 2 * GAP);
        const x1 = cx - p.width / 2;
        const box = { x1: Math.min(x1, bx1), y1: y - TICK, x2: Math.max(x1 + p.width, bx2), y2: y + GAP + p.height };
        if (clear(box)) return { x1, y1: y + GAP, x2: x1 + p.width, y2: y + GAP + p.height, text: p.text, marker: "bracket", bracket: { x1: bx1, x2: bx2, y } };
      }
      return null;
    });
    if (spot) placed.push(spot);
  }
  return placed;
};
