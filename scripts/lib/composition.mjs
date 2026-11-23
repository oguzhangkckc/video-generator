// Composition checks (STYLE.md "Kompozisyon", "Yerleşim", "Veri çizgisi etiketleri") over qa probe samples:
// what each scene reported (QaProbe QA_SCENE), the overlay boxes (QA_BOXES) and how empty each frame looked.
// Pure, so it can be tested with made-up samples.
import { covered as coveredShare, isArea } from "../../src/kit/framing.ts";
import { mentions } from "../../src/spec/sentences.ts";

export const LIMITS = {
  /** The subject fills at least this share of the frame height… */
  subjectMin: 0.35,
  /** …and may stay smaller for at most this long. */
  subjectHold: 2,
  emptyMax: 0.4,
  emptyHold: 1,
  /** Past this share of the frame, a subject is cropped at the edge. */
  edge: 0.02,
  /** A named element is on screen for at least this share of its phrase. */
  named: 0.5,
  /** An important area (region, part) may have this much of itself under overlays, or out of the frame. */
  areaCover: 0.25,
  /** An important element may sit partly out of the frame for at most this long… */
  outsideHold: 0.5,
  /** …or this long while it enters (appears outside) or leaves (stops mattering). */
  passHold: 1,
  /** Around a transition, no frame may be emptier than this. */
  transitionEmpty: 0.6,
  /** Shape match: the two elements' centres within this share of the frame width. */
  match: 0.05,
  /** Through: the element fills at least this share of the frame. */
  through: 0.9,
};
const W = 1080;
const H = 1920;
const FRAME = { x1: 0, y1: 0, x2: W, y2: H };
const PANEL_PAD = 18;
/**
 * Words that place something in space, with the case and possessive endings they take ("köşesinden", "sağda");
 * whole words only, so "sağlayıcı", "için" or "önce" are not places. A phrase with one should name a scene element.
 */
const SPATIAL_STEMS = ["köşe", "üst", "alt", "sağ", "sol", "iç", "yörünge", "merkez", "kenar", "orta", "yukarı", "aşağı", "arka", "ön"];
const ENDING = "(a|e|ı|i|u|ü|ya|ye|da|de|ta|te|dan|den|tan|ten|daki|deki|taki|teki|ına|ine|una|üne|ında|inde|unda|ünde|ından|inden|undan|ünden|ındaki|indeki|undaki|ündeki|sı|si|sına|sine|sında|sinde|sından|sinden|sındaki|sindeki)?";
const SPATIAL = SPATIAL_STEMS.map((stem) => ({ stem, re: new RegExp(`^${stem}${ENDING}$`, "u") }));
const words = (text) => text.toLocaleLowerCase("tr").split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, ""));

const fmt = (t) => `${t.toFixed(2)} s`;
const overlap = (a, b, gap = 0) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > gap && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > gap;
const clip = (b) => ({ x1: Math.max(0, b.x1), y1: Math.max(0, b.y1), x2: Math.min(W, b.x2), y2: Math.min(H, b.y2) });
const onScreen = (b) => b.x2 > 0 && b.x1 < W && b.y2 > 0 && b.y1 < H;

/** Collapse (key, t, message) findings into one line per key with its time span. */
const spans = () => {
  const map = new Map();
  return {
    add: (key, t, message) => {
      const s = map.get(key);
      if (s) s.to = t;
      else map.set(key, { from: t, to: t, message });
    },
    list: () => [...map.values()].map((s) => `${s.from === s.to ? fmt(s.from) : `${fmt(s.from)}–${fmt(s.to)}`}: ${s.message}`),
  };
};

/** Consecutive samples where `bad` holds, as { from, to, worst }; `to` includes the sample's own step. */
const runs = (series, bad, step, worstOf = Math.min) => {
  const out = [];
  let run = null;
  for (const { t, v } of series) {
    if (bad(v)) {
      if (run) {
        run.to = t + step;
        run.worst = worstOf(run.worst, v);
      } else run = { from: t, to: t + step, worst: v };
    } else if (run) {
      out.push(run);
      run = null;
    }
  }
  if (run) out.push(run);
  return out;
};

/** Segment–box intersection (Liang–Barsky). */
const crosses = ([x1, y1], [x2, y2], b) => {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const [p, q] of [
    [-dx, x1 - b.x1],
    [dx, b.x2 - x1],
    [-dy, y1 - b.y1],
    [dy, b.y2 - y1],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
};

/** What covers the scene at one sample: settled overlay boxes, the label panels around them, and data strips. */
const coverOf = (sample, labelAlign) => {
  const cover = sample.boxes.map((b) => ({ ...b }));
  const panels = new Map();
  for (const b of sample.boxes.filter((x) => x.kind === "label")) {
    const align = labelAlign(b.id);
    const g = panels.get(align);
    panels.set(align, g ? { x1: Math.min(g.x1, b.x1), y1: Math.min(g.y1, b.y1), x2: Math.max(g.x2, b.x2), y2: Math.max(g.y2, b.y2) } : { ...b });
  }
  for (const [align, b] of panels) {
    cover.push({ kind: "panel", id: `etiket paneli (${align})`, text: "", x1: b.x1 - PANEL_PAD, y1: b.y1 - PANEL_PAD, x2: b.x2 + PANEL_PAD, y2: b.y2 + PANEL_PAD });
  }
  const strips = sample.scene.layers.filter((l) => l.type === "strip" && l.opacity >= 0.5).map((l) => l.layer);
  for (const z of sample.scene.zones.filter((x) => x.kind === "strip" && strips.includes(x.id))) cover.push({ ...z, text: "" });
  return cover;
};

/** The scene the viewer is looking at: the topmost full-frame layer that is mostly visible. */
const mainScene = (sample) => [...sample.scene.layers].reverse().find((l) => l.type !== "strip" && l.opacity >= 0.5 && l.subject);

/**
 * samples: [{ t, boxes, scene: { zones, layers }, empty }] at `step` s apart; labelAlign(id) → the label's align;
 * phrases: [{ text, start, end }]. Returns { errors, warnings, stats }.
 */
export const composition = ({ samples, step, labelAlign, phrases, transitions = [] }) => {
  const errors = [];
  const warnings = [];
  const covered = spans();
  const cropped = spans();
  const touching = spans();
  const crossing = spans();
  const outside = new Map();
  let present = new Set();
  const leave = (key, exiting) => {
    const r = outside.get(key);
    const hold = r.entering || exiting ? LIMITS.passHold : LIMITS.outsideHold;
    if (r.to - r.from > hold) {
      errors.push(`önemli öğe: ${fmt(r.from)}–${fmt(r.to)}: ${r.what} kareden taşıyor (en çok %${Math.round(r.worst * 100)}'i dışarıda, en fazla ${hold} sn)`);
    }
    outside.delete(key);
  };

  for (const s of samples) {
    const cover = coverOf(s, labelAlign);
    const out = new Set();
    const now = new Set();
    for (const layer of s.scene.layers.filter((l) => l.opacity >= 0.5)) {
      for (const e of layer.elements.filter((x) => x.important && !x.hidden)) {
        const key = `${layer.layer}.${e.id}`;
        now.add(key);
        const share = 1 - coveredShare(e, [FRAME]);
        if (isArea(e) ? share <= LIMITS.areaCover : Math.max(-e.x1, e.x2 - W, -e.y1, e.y2 - H) <= 2) continue;
        const r = outside.get(key);
        if (r) Object.assign(r, { to: s.t + step, worst: Math.max(r.worst, share) });
        else outside.set(key, { from: s.t, to: s.t + step, worst: share, what: `${layer.layer} "${e.id}"`, entering: !present.has(key) });
        out.add(key);
      }
      const others = cover.filter((c) => !(c.kind === "strip" && c.id === layer.layer));
      for (const e of layer.elements.filter((x) => x.important && !x.hidden && onScreen(x))) {
        // A point (node, signal, pen) may not touch an overlay; an area (region, part) may be partly under one.
        if (isArea(e)) {
          const share = coveredShare(clip(e), others);
          if (share > LIMITS.areaCover) covered.add(`${layer.layer}.${e.id}`, s.t, `${layer.layer} "${e.id}" bölgesinin %${Math.round(share * 100)}'i üst yazıların altında (en fazla %${LIMITS.areaCover * 100})`);
          continue;
        }
        for (const c of others) {
          if (overlap(clip(e), c, 2)) covered.add(`${layer.layer}.${e.id}|${c.id}`, s.t, `${layer.layer} "${e.id}" ${c.kind === "caption" ? "altyazının" : `${c.id}`} altında kalıyor`);
        }
      }
      const labels = layer.labels ?? [];
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          if (overlap(labels[i], labels[j], 0)) touching.add(`${layer.layer}:${labels[i].text}|${labels[j].text}`, s.t, `${layer.layer}: "${labels[i].text}" ile "${labels[j].text}" birbirine değiyor`);
        }
        const inner = { x1: labels[i].x1 + 2, y1: labels[i].y1 + 2, x2: labels[i].x2 - 2, y2: labels[i].y2 - 2 };
        const line = layer.line ?? [];
        if (line.some((p, k) => k > 0 && crosses(line[k - 1], p, inner))) {
          crossing.add(`${layer.layer}:${labels[i].text}`, s.t, `${layer.layer}: "${labels[i].text}" veri çizgisinin üstünden geçiyor`);
        }
        const leader = labels[i].leader;
        if (leader) {
          for (let j = 0; j < labels.length; j++) {
            if (j !== i && crosses(leader[0], leader[1], labels[j])) touching.add(`${layer.layer}:leader:${labels[i].text}|${labels[j].text}`, s.t, `${layer.layer}: "${labels[i].text}" kılavuz çizgisi "${labels[j].text}" etiketine değiyor`);
          }
        }
      }
    }
    const main = mainScene(s);
    if (main) {
      const b = main.subject;
      const over = Math.max((0 - b.x1) / W, (b.x2 - W) / W, (0 - b.y1) / H, (b.y2 - H) / H);
      if (over > LIMITS.edge && main.shot.kind !== "close") cropped.add(main.layer, s.t, `${main.layer} öznesi kare kenarında kırpılıyor (yakın plan değil)`);
    }
    for (const key of [...outside.keys()]) if (!out.has(key)) leave(key, !now.has(key));
    present = now;
  }
  for (const key of [...outside.keys()]) leave(key, false);
  errors.push(...covered.list().map((m) => `önemli öğe: ${m}`));
  errors.push(...touching.list().map((m) => `veri etiketi: ${m}`), ...crossing.list().map((m) => `veri etiketi: ${m}`));
  warnings.push(...cropped.list().map((m) => `kenar: ${m}`));

  const subjectSeries = samples.map((s) => {
    const main = mainScene(s);
    const b = main && clip(main.subject);
    return { t: s.t, v: b ? Math.max(0, b.y2 - b.y1) / H : 1, layer: main?.layer };
  });
  for (const r of runs(subjectSeries, (v) => v < LIMITS.subjectMin, step)) {
    if (r.to - r.from > LIMITS.subjectHold) {
      const who = subjectSeries.find((x) => x.t === r.from)?.layer;
      errors.push(`özne: ${fmt(r.from)}–${fmt(r.to)}: ${who} öznesi karenin %${Math.round(r.worst * 100)}'ine iniyor (en az %${LIMITS.subjectMin * 100}, en fazla ${LIMITS.subjectHold} sn)`);
    }
  }

  const emptySeries = samples.filter((s) => s.empty != null).map((s) => ({ t: s.t, v: s.empty }));
  const emptyStep = emptySeries.length > 1 ? emptySeries[1].t - emptySeries[0].t : step;
  for (const r of runs(emptySeries, (v) => v > LIMITS.emptyMax, emptyStep, Math.max)) {
    if (r.to - r.from > LIMITS.emptyHold) errors.push(`boş alan: ${fmt(r.from)}–${fmt(r.to)}: karenin %${Math.round(r.worst * 100)}'i boş (en fazla %${LIMITS.emptyMax * 100}, ${LIMITS.emptyHold} sn)`);
  }

  for (const p of phrases) {
    const inside = samples.filter((s) => s.t >= p.start && s.t <= p.end);
    const named = new Map();
    for (const s of inside) {
      const cover = coverOf(s, labelAlign);
      for (const layer of s.scene.layers) {
        for (const e of layer.elements.filter((x) => x.say.some((a) => mentions(p.text, a)))) {
          const others = cover.filter((c) => !(c.kind === "strip" && c.id === layer.layer));
          const seen = layer.opacity >= 0.5 && !e.hidden && onScreen(e) && coveredShare(clip(e), others) < 0.5;
          const n = named.get(`${layer.layer}.${e.id}`) ?? { seen: 0 };
          n.seen += seen ? 1 : 0;
          named.set(`${layer.layer}.${e.id}`, n);
        }
      }
    }
    for (const [id, n] of named) {
      if (inside.length && n.seen / inside.length < LIMITS.named) {
        errors.push(`bağlam: ${fmt(p.start)} "${p.text}" ${id} adını söylüyor ama öğe cümlenin yalnızca %${Math.round((100 * n.seen) / inside.length)}'inde görünüyor`);
      }
    }
    const spatial = SPATIAL.find(({ re }) => words(p.text).some((w) => re.test(w)));
    if (spatial && named.size === 0) warnings.push(`bağlam: ${fmt(p.start)} "${p.text}" bir yer söylüyor ("${spatial.stem}…") ama sahnede bu cümleye bağlı öğe yok (say)`);
  }

  for (const tr of transitions) {
    const near = samples.reduce((best, s) => (Math.abs(s.t - tr.at) < Math.abs(best.t - tr.at) ? s : best), samples[0]);
    const find = (layer, id) => near?.scene.layers.find((l) => l.layer === layer)?.elements.find((e) => e.id === id);
    const what = `${tr.from} → ${tr.to} (${fmt(tr.at)})`;
    if (tr.kind === "match" && tr.via) {
      const [a, b] = [find(tr.from, tr.via.from), find(tr.to, tr.via.to)];
      const centre = (e) => [(e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2];
      if (!a || !b) errors.push(`geçiş: ${what} şekil eşleştirmesinin öğeleri o anda ekranda değil`);
      else if (Math.hypot(centre(a)[0] - centre(b)[0], centre(a)[1] - centre(b)[1]) > LIMITS.match * W) {
        errors.push(`geçiş: ${what} "${tr.via.from}" ile "${tr.via.to}" aynı yerde değil (${Math.round(Math.hypot(centre(a)[0] - centre(b)[0], centre(a)[1] - centre(b)[1]))} px)`);
      }
    }
    if (tr.kind === "through" && tr.via) {
      for (const [layer, id] of [
        [tr.from, tr.via.from],
        [tr.to, tr.via.to],
      ]) {
        const e = find(layer, id);
        const c = e && clip(e);
        const fill = c ? ((c.x2 - c.x1) * (c.y2 - c.y1)) / (W * H) : 0;
        if (fill < LIMITS.through) errors.push(`geçiş: ${what} içinden geçiş: ${layer} "${id}" kareyi doldurmuyor (%${Math.round(fill * 100)})`);
      }
    }
    const during = samples.filter((s) => Math.abs(s.t - tr.at) <= 0.6 && s.empty != null);
    const worst = during.reduce((m, s) => Math.max(m, s.empty), 0);
    if (worst > LIMITS.transitionEmpty) errors.push(`geçiş: ${what} neredeyse boş bir kareden geçiyor (%${Math.round(worst * 100)} boş)`);
  }

  const stats = {
    subjectMin: Math.min(...subjectSeries.map((x) => x.v)),
    emptyMax: emptySeries.length ? Math.max(...emptySeries.map((x) => x.v)) : null,
  };
  return { errors, warnings, stats };
};
