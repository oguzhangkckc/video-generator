import assert from "node:assert/strict";
import { test } from "node:test";
import { swings } from "../../src/kit/scenes/trace/swing.ts";

/** A carrier drawn as the renderer samples it: `level(x)` scales each cycle (screen px, 15 px per cycle). */
const carrier = (level, from = 0, to = 900) => {
  const out = [];
  for (let x = from; x <= to; x += 1.2) out.push([x, 1000 - 90 * level(x) * Math.sin((2 * Math.PI * x) / 15)]);
  return out;
};
const lowest = (line, x1, x2) => {
  const m = swings(line);
  const inside = m.windows.filter((w) => w.x1 >= x1 && w.x2 <= x2);
  return Math.min(...inside.map((w) => w.swing)) / m.ref;
};

test("a part's drawn amplitude: a gap, a dip, and half-dropped single cycles", () => {
  const gap = carrier((x) => (x >= 300 && x < 360 ? 0 : 1));
  assert.ok(lowest(gap, 290, 370) < 0.05);
  const dip = carrier((x) => (x >= 300 && x < 360 ? 0.35 : 1));
  const d = lowest(dip, 290, 370);
  assert.ok(d > 0.3 && d < 0.4, String(d));
  // Single cycles switched off between full ones (the old "kararmalar") never stay low for two cycles.
  const ragged = carrier((x) => (x >= 300 && x < 360 && Math.floor(x / 15) % 2 === 0 ? 0.05 : 1));
  assert.ok(lowest(ragged, 290, 370) > 0.9);
});
