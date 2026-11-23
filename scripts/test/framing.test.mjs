import assert from "node:assert/strict";
import { test } from "node:test";
import { IDENTITY, moveBox, overlaps, smoothAdjust, solve } from "../../src/kit/framing.ts";
import { composition } from "../lib/composition.mjs";

const anchor = [540, 960];
const box = (x, y, r = 20) => ({ x1: x - r, y1: y - r, x2: x + r, y2: y + r });
const caption = { x1: 120, y1: 1430, x2: 960, y2: 1526 };
const panel = { x1: 62, y1: 380, x2: 600, y2: 640 };

test("a clear shot is left as written", () => {
  assert.deepEqual(solve([box(540, 960)], [caption, panel], anchor), IDENTITY);
});

test("an element under the captions moves out by the smallest shift", () => {
  const a = solve([box(540, 1480)], [caption, panel], anchor);
  assert.equal(a.s, 1);
  const moved = moveBox(box(540, 1480), anchor, a);
  assert.ok(!overlaps(moved, caption, 12) && !overlaps(moved, panel, 12), JSON.stringify(a));
  assert.ok(Math.hypot(a.dx, a.dy) <= 120, `shift ${Math.hypot(a.dx, a.dy)}`);
});

test("elements too far apart to shift clear are fitted by zooming out", () => {
  const a = solve([box(300, 10), box(800, 1910)], [], anchor);
  assert.ok(a.s < 1, JSON.stringify(a));
});

test("the averaged move starts before a panel appears and has no jumps", () => {
  const raw = (t) => (t >= 2 ? { dx: 0, dy: -300, s: 1 } : IDENTITY);
  const at = (t) => smoothAdjust(raw, t).dy;
  assert.ok(at(1.6) < -5, `moving early: ${at(1.6)}`);
  for (let t = 1; t < 3; t += 1 / 30) assert.ok(Math.abs(at(t + 1 / 30) - at(t)) <= 30, `jump at ${t.toFixed(2)}`);
});

const sample = (t, layers, extra = {}) => ({ t, boxes: [], scene: { zones: [], layers }, empty: 0.1, ...extra });
const scene = (over) => ({ layer: "body", type: "flow", opacity: 1, shot: { kind: "medium" }, subject: { x1: 100, y1: 300, x2: 980, y2: 1500 }, elements: [], ...over });

test("composition: a small subject, an empty frame and a covered element are errors", () => {
  const small = scene({ subject: { x1: 400, y1: 800, x2: 700, y2: 1100 } });
  const node = { id: "sa", kind: "node", important: true, say: [], ...box(540, 1478) };
  const samples = Array.from({ length: 13 }, (_, i) =>
    sample(i * 0.25, [{ ...small, elements: [node] }], { boxes: [{ kind: "caption", id: "captions", text: "", ...caption }], empty: 0.7 }),
  );
  const { errors } = composition({ samples, step: 0.25, labelAlign: () => "left", phrases: [] });
  assert.ok(errors.some((e) => e.startsWith("özne")), errors.join("\n"));
  assert.ok(errors.some((e) => e.startsWith("boş alan")), errors.join("\n"));
  assert.ok(errors.some((e) => e.startsWith("önemli öğe")), errors.join("\n"));
});

test("composition: an important element out of the frame is an error unless it is entering or leaving", () => {
  const at = (y) => (y == null ? [] : [{ id: "hero", kind: "satellite", important: true, say: [], ...box(540, y) }]);
  const run = (ys) => composition({ samples: ys.map((y, i) => sample(i * 0.25, [scene({ elements: at(y) })])), step: 0.25, labelAlign: () => "left", phrases: [] });
  const out = (ys) => run(ys).errors.filter((e) => e.includes("kareden taşıyor"));
  assert.equal(out([960, 10, 960, 960]).length, 0);
  assert.equal(out([960, 10, 10, 10, 960]).length, 1, "sitting cut off at the edge");
  assert.equal(out([960, -400, -400, -400]).length, 1, "out of the frame while it still matters");
  assert.equal(out([null, -400, 10, 10, 960]).length, 0, "entering");
  assert.equal(out([960, 10, 10, 10, null]).length, 0, "leaving");
});

test("composition: touching labels, a label on the line, a named element off screen", () => {
  const labels = [
    { text: "P", marker: "leader", x1: 500, y1: 900, x2: 530, y2: 940 },
    { text: "PR", marker: "leader", x1: 520, y1: 900, x2: 570, y2: 940 },
  ];
  const line = [
    [400, 920],
    [700, 920],
  ];
  const heart = { id: "heart", kind: "region", important: false, say: ["kalp"], ...box(540, 2400, 100) };
  const samples = [0, 0.25, 0.5].map((t) => sample(t, [scene({ type: "trace", layer: "strip", labels, line, elements: [heart] })]));
  const { errors } = composition({ samples, step: 0.25, labelAlign: () => "left", phrases: [{ text: "Kalbin sağ üst köşesi", start: 0, end: 0.5 }] });
  assert.ok(errors.some((e) => e.includes("birbirine değiyor")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("veri çizgisinin üstünden")), errors.join("\n"));
  assert.ok(errors.some((e) => e.startsWith("bağlam")), errors.join("\n"));
});

test("composition: a spatial word only counts as a whole word", () => {
  const samples = [sample(0, [scene()])];
  const say = (text) => composition({ samples, step: 0.25, labelAlign: () => "left", phrases: [{ text, start: 0, end: 0 }] }).warnings;
  assert.equal(say("sağlayıcıdan geçip sunucuya varıyor.").length, 0);
  assert.equal(say("bunun için").length, 0);
  assert.equal(say("Kalbinin sağ üst köşesinden.").length, 1);
});
