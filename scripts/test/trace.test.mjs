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

import { sideWeight, squeezeLevel, warpPoint } from "../../src/kit/scenes/flow/squeeze.ts";

test("a squeeze contracts its group toward the centre and relaxes, only below its line", () => {
  assert.equal(squeezeLevel([1, 2], 0.9), 0);
  assert.equal(squeezeLevel([1, 2], 1.4), 1);
  assert.ok(squeezeLevel([1, 2], 1.8) > 0 && squeezeLevel([1, 2], 1.8) < 1);
  const squeezes = [{ group: "alt-odalar", side: { below: 0, soft: 50 }, range: [1, 2], center: [0, 100], scale: 0.8 }];
  const groups = { "alt-odalar": ["ventricles"] };
  // Below the line, at the peak: 20 % closer to the centre.
  assert.deepEqual(warpPoint(squeezes, groups, "ventricles", [0, 300], 1.4).map(Math.round), [0, 260]);
  // Above the line, or not in the group, or outside the range: unmoved.
  assert.deepEqual(warpPoint(squeezes, groups, "ventricles", [0, -100], 1.4), [0, -100]);
  assert.deepEqual(warpPoint(squeezes, groups, "atria", [0, 300], 1.4), [0, 300]);
  assert.deepEqual(warpPoint(squeezes, groups, "ventricles", [0, 300], 2.5), [0, 300]);
  assert.ok(sideWeight({ below: 0, soft: 50 }, [0, 25]) > 0 && sideWeight({ below: 0, soft: 50 }, [0, 25]) < 1);
});
