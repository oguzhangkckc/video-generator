import assert from "node:assert/strict";
import { test } from "node:test";
import { IDENTITY, moveBox, overlaps, smoothAdjust, solve } from "../../src/kit/framing.ts";
import { pointerLine, rowsInTheWay } from "../../src/kit/overlays/pointer.ts";
import { splitPage } from "../../src/spec/timing.ts";
import { composition, coverFindings, textFindings } from "../lib/composition.mjs";

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

test("a pointer leaves the panel side that faces its element and stops short of a point", () => {
  const label = { x1: 80, y1: 400, x2: 300, y2: 460 };
  const panel = { x1: 62, y1: 382, x2: 318, y2: 478 };
  const { from, to } = pointerLine(label, panel, box(700, 700, 30));
  assert.deepEqual(from, [318, 430]);
  assert.ok(Math.abs(Math.hypot(700 - to[0], 700 - to[1]) - 30) < 1e-6, JSON.stringify(to));
  const down = pointerLine(label, panel, box(200, 900, 30));
  assert.deepEqual([down.from, down.side], [[200, 478], "bottom"]);
  assert.deepEqual(pointerLine(label, panel, box(700, 700, 200)).to, [700, 700], "an area: into its centre");
  assert.equal(pointerLine(label, panel, box(200, 430, 10)), null, "inside the panel: nothing to draw");
});

test("a leader out of the bottom of a stack belongs to the bottom line only", () => {
  const top = { x1: 80, y1: 150, x2: 300, y2: 208 };
  const below = { x1: 80, y1: 220, x2: 500, y2: 278 };
  const panel = { x1: 62, y1: 132, x2: 518, y2: 296 };
  const down = pointerLine(top, panel, box(200, 500, 30));
  assert.deepEqual(rowsInTheWay(down, top, [below]), [below]);
  assert.deepEqual(rowsInTheWay(down, below, [top]), []);
  assert.deepEqual(rowsInTheWay(pointerLine(top, panel, box(800, 500, 30)), top, [below]), [], "sideways: any line");
});

test("composition: a pointer's element must be on screen and its leader may not cross other text", () => {
  const label = { kind: "label", id: "labels[0]", text: "SA DÜĞÜMÜ", x1: 80, y1: 400, x2: 300, y2: 460 };
  const caption = { kind: "caption", id: "captions", text: "kalp atıyor", x1: 120, y1: 1430, x2: 960, y2: 1526 };
  const node = (x, y, over = {}) => ({ id: "sa", kind: "node", important: true, say: [], ...box(x, y, 30), ...over });
  const run = (sa) =>
    composition({
      samples: [0, 0.25, 0.5].map((t) => sample(t, [scene({ layer: "heart", elements: [sa] })], { boxes: [label, caption] })),
      step: 0.25,
      labelAlign: () => "left",
      labelPointTo: () => "heart.sa",
      phrases: [],
    }).errors.filter((e) => e.startsWith("kılavuz"));
  assert.deepEqual(run(node(700, 700)), []);
  assert.ok(run(node(700, 700, { hidden: true }))[0]?.includes("ekranda değil"));
  assert.ok(run(node(540, 1700))[0]?.includes("altyazının üstünden"));
});

test("text: a scene's text in the caption band, a strip label out of its panel, the line in a title", () => {
  const band = { x1: 120, y1: 1442, x2: 960, y2: 1514 };
  const title = { kind: "title", id: "titles[0]", text: "BU ÇİZGİ / NE ANLATIYOR?", x1: 200, y1: 560, x2: 880, y2: 736 };
  const monitor = scene({ layer: "monitor", type: "trace", texts: [{ text: "25 mm/sn", x1: 80, y1: 1480, x2: 300, y2: 1509 }], line: [[300, 900], [320, 700], [340, 900]] });
  const strip = scene({ layer: "strip", type: "strip", texts: [{ text: "QRS", x1: 600, y1: 1030, x2: 650, y2: 1066 }] });
  const s = sample(0, [monitor, strip], { boxes: [title], band });
  s.scene.zones = [{ kind: "strip", id: "strip", x1: 40, y1: 1036, x2: 1040, y2: 1370 }];
  const found = textFindings(s, s.boxes).map(([, m]) => m);
  assert.ok(found.some((m) => m.includes("25 mm/sn") && m.includes("altyazı bandına")), found.join("\n"));
  assert.ok(found.some((m) => m.includes("QRS") && m.includes("panelin dışına")), found.join("\n"));
  assert.ok(found.some((m) => m.includes("monitor veri çizgisi başlığa")), found.join("\n"));
  const clean = sample(0, [scene({ layer: "monitor", type: "trace", texts: [{ text: "25 mm/sn", x1: 80, y1: 1400, x2: 300, y2: 1429 }], line: [[300, 900], [320, 760]] })], { boxes: [title], band });
  assert.deepEqual(textFindings(clean, clean.boxes), []);
});

test("cover: one bad frame is enough, a fading text counts, frame 0 needs the hook title", () => {
  const title = { kind: "title", id: "titles[0]", text: "BAŞLIK", x1: 200, y1: 560, x2: 880, y2: 736 };
  const note = { kind: "note", id: "notes[0]", text: "NOT", x1: 700, y1: 700, x2: 900, y2: 726 };
  const ok = (t, extra = {}) => sample(t, [scene()], { boxes: [title], strict: [title], ...extra });
  assert.deepEqual(coverFindings({ samples: [ok(0), ok(1 / 15)] }), []);
  const fading = coverFindings({ samples: [ok(0), ok(1 / 15, { strict: [title, note] })] });
  assert.ok(fading.some((e) => e.includes("çakışıyor")), fading.join("\n"));
  const empty = coverFindings({ samples: [ok(0), ok(1 / 15, { empty: 0.5 })] });
  assert.ok(empty.some((e) => e.includes("boş")), empty.join("\n"));
  const untitled = coverFindings({ samples: [ok(0, { boxes: [], strict: [] })] });
  assert.ok(untitled.some((e) => e.includes("kanca başlığı yok")), untitled.join("\n"));
});

test("captions: a long phrase becomes two balanced pages of 2–6 words, split after a comma when it can", () => {
  const words = (text) => text.split(" ").map((text) => ({ text }));
  const pages = (text, fits = () => true) => splitPage(words(text), fits)?.map((p) => p.map((w) => w.text).join(" "));
  assert.deepEqual(pages("Bu çizgiyi mutlaka görmüşsündür."), ["Bu çizgiyi mutlaka görmüşsündür."]);
  assert.deepEqual(pages("Dalga kulakçıklara yayılıyor, kan aşağı itiliyor ve karıncıklar doluyor."), [
    "Dalga kulakçıklara yayılıyor,",
    "kan aşağı itiliyor ve karıncıklar doluyor.",
  ]);
  const narrow = (t) => t.length <= 24;
  assert.deepEqual(pages("Kalbinin elektriği cildine ulaşıyor:", narrow), ["Kalbinin elektriği", "cildine ulaşıyor:"]);
  assert.equal(splitPage(words("bir iki üç dört beş altı yedi sekiz dokuz on on bir on iki on üç"), () => true), null, "more than two pages' worth");
});

test("captions: qa reports a page wider than the line and a size that changes", () => {
  const band = { x1: 120, y1: 1442, x2: 960, y2: 1514 };
  const page = (t, size, x1, x2) => sample(t, [scene()], { band, boxes: [{ kind: "caption", id: "captions", text: `t${t}`, size, x1, y1: 1442, x2, y2: 1514 }] });
  const { errors } = composition({ samples: [page(0, 60, 200, 880), page(0.25, 48, 100, 980)], step: 0.25, labelAlign: () => "left", phrases: [] });
  assert.ok(errors.some((e) => e.startsWith("altyazı") && e.includes("sığmıyor")), errors.join("\n"));
  assert.ok(errors.some((e) => e.startsWith("altyazı") && e.includes("boyutu değişiyor")), errors.join("\n"));
});

test("context: a section whose subject is never wholly in frame for a second is a warning", () => {
  const whole = { x1: 100, y1: 300, x2: 980, y2: 1500 };
  const cropped = { x1: -200, y1: 300, x2: 980, y2: 2100 };
  const run = (subjects) =>
    composition({
      samples: subjects.map((subject, i) => sample(i * 0.25, [scene({ subject })])),
      step: 0.25,
      labelAlign: () => "left",
      phrases: [],
      sections: [{ id: "kaynak", window: [0, 3] }],
    }).warnings.filter((w) => w.startsWith("siluet"));
  assert.equal(run(Array(12).fill(cropped)).length, 1);
  assert.ok(run(Array(12).fill(cropped))[0].includes("hiç"));
  assert.equal(run([...Array(4).fill(whole), ...Array(8).fill(cropped)]).length, 0, "1 s whole is enough");
  assert.equal(run([whole, cropped, whole, cropped, ...Array(8).fill(cropped)]).length, 1, "it must be one stretch");
});

test("card: the concept card and the lines shown with it sit on one dark panel; a title beside it does not", () => {
  const concept = { kind: "concept", id: "concept", text: "ELEKTROKARDİYOGRAM", x1: 200, y1: 180, x2: 880, y2: 360 };
  const line = { kind: "label", id: "labels[13]", text: "ELEKTRO · KARDİYO · GRAM", x1: 300, y1: 380, x2: 780, y2: 420 };
  const title = { kind: "title", id: "titles[3]", text: "SON", x1: 300, y1: 700, x2: 780, y2: 800 };
  const run = (boxes) => composition({ samples: [sample(0, [scene()], { boxes })], step: 0.25, labelAlign: () => "center", phrases: [] }).errors.filter((e) => e.startsWith("kart"));
  assert.deepEqual(run([concept, line]), []);
  assert.equal(run([concept, line, title]).length, 1);
});
