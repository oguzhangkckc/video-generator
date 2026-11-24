import { getRemotionEnvironment } from "remotion";
import { z } from "zod";
import catalog from "../kit/audio/sfx-catalog.json";
import lengths from "../kit/audio/sfx-durations.json";
import { curveFn, type CurveFn } from "../kit/curves";
import { FPS, formatCounter } from "../kit/format";
import { speedLabel } from "../kit/overlays/Counter";
import { textWidth } from "../kit/overlays/geometry";
import { SANS } from "../kit/theme";
import { needsReading, splitToken, unreadable } from "./lexicon.ts";
import { KEY_REF, MARK_REF } from "./primitives";
import { ResolvedSpec, Timing, VideoSpec, type LayerOf, type Spec } from "./schema";
import { sceneFindings } from "./scenes";
import { endsOnQuestionWord, sentencesOf } from "./sentences.ts";
import {
  captionPages,
  estimatePhrases,
  phraseTexts,
  splitPage,
  timingMatches,
  type CaptionPage,
  type Phrase,
} from "./timing";

export type Video = {
  spec: Spec;
  phrases: Phrase[];
  pages: CaptionPage[];
  curve: (name: string) => CurveFn;
  /** False while the captions are a draft estimate (no voice-over aligned yet). */
  timed: boolean;
  /** spec.voiceover.audio, else the file the timing was made from. */
  voiceoverAudio?: string;
};

type RawSpec = z.output<typeof VideoSpec>;
type MarkValue = number | [number, number];

const fail = (where: string, message: string): never => {
  throw new Error(`${where}: ${message}`);
};

const isCue = (v: object): v is { cue: string; offset?: number } =>
  "cue" in v && Object.keys(v).every((key) => key === "cue" || key === "offset");

const createResolver = (raw: RawSpec, phrases: Phrase[]) => {
  const marks = new Map<string, MarkValue>([["end", raw.durationSec]]);
  const pending = new Set<string>();

  const cue = (prefix: string, offset: number, where: string) => {
    const phrase = phrases.find((p) => p.text.startsWith(prefix));
    return phrase ? phrase.start + offset : fail(where, `no voice-over phrase starts with "${prefix}"`);
  };

  const mark = (name: string, where: string): MarkValue => {
    const known = marks.get(name);
    if (known !== undefined) return known;
    const def = raw.marks[name];
    if (def === undefined) return fail(where, `unknown mark "@${name}" — define it under "marks"`);
    if (pending.has(name)) return fail(`marks.${name}`, "refers to itself");
    pending.add(name);
    const value: MarkValue = Array.isArray(def)
      ? [time(def[0], `marks.${name}[0]`), time(def[1], `marks.${name}[1]`)]
      : time(def, `marks.${name}`);
    pending.delete(name);
    marks.set(name, value);
    return value;
  };

  const ref = (text: string, where: string): MarkValue => {
    const m = MARK_REF.exec(text);
    if (!m) return fail(where, `"${text}" is not a mark reference ("@name", "@name.start", "@name+0.3")`);
    const [, name, side, offsetText] = m;
    const value = mark(name, where);
    const offset = offsetText ? Number(offsetText) : 0;
    if (Array.isArray(value)) {
      if (side) return value[side === "start" ? 0 : 1] + offset;
      return offsetText ? fail(where, `"${text}": put .start or .end before an offset on a range`) : value;
    }
    return side ? fail(where, `"@${name}" is a single time, not a range`) : value + offset;
  };

  function time(v: unknown, where: string): number {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const value = ref(v, where);
      return Array.isArray(value) ? fail(where, `"${v}" is a range; use "${v}.start" or "${v}.end"`) : value;
    }
    if (v && typeof v === "object" && isCue(v)) return cue(v.cue, v.offset ?? 0, where);
    return fail(where, "expected a time");
  }

  const key = (name: string, where: string) =>
    raw.timeline?.keys[name]?.value ?? fail(where, `unknown timeline key "#${name}" — define it under "timeline.keys"`);

  const walk = (v: unknown, where: string): unknown => {
    if (typeof v === "string") {
      if (v.startsWith("@")) return ref(v, where);
      const k = KEY_REF.exec(v);
      return k ? key(k[1], where) : v;
    }
    if (Array.isArray(v)) return v.map((item, i) => walk(item, `${where}[${i}]`));
    if (v && typeof v === "object") {
      if (isCue(v)) return cue(v.cue, v.offset ?? 0, where);
      return Object.fromEntries(Object.entries(v).map(([key, item]) => [key, walk(item, `${where}.${key}`)]));
    }
    return v;
  };

  return { mark, walk };
};

// Free text never holds times, so it is left alone even if it starts with "@".
const TEXT_FIELDS = new Set([
  "$schema",
  "template",
  "timeline",
  "title",
  "lang",
  "voiceover",
  "sources",
  "credits",
  "styleExceptions",
  "marks",
]);

/** Every id a flow layer refers to must exist, so a typo fails `npm run check` instead of drawing nothing. */
const checkFlow = (layer: LayerOf<"flow">, where: string, needCurve: (name: string, where: string) => void) => {
  const seen = new Set<string>();
  for (const [kind, items] of [["regions", layer.regions], ["paths", layer.paths], ["nodes", layer.nodes]] as const) {
    items.forEach((item, i) => {
      if (seen.has(item.id)) fail(`${where}.${kind}[${i}]`, `duplicate id "${item.id}"`);
      seen.add(item.id);
    });
  }
  const nodes = new Set(layer.nodes.map((n) => n.id));
  const paths = new Set(layer.paths.map((p) => p.id));
  const regions = new Set(layer.regions.map((r) => r.id));
  const place = (p: string | [number, number], at: string) => {
    if (typeof p === "string" && !nodes.has(p)) fail(at, `no node "${p}"`);
  };
  const progress = (p: { curve: string } | { times: [number, number] }, at: string) => {
    if ("curve" in p) needCurve(p.curve, at);
  };
  layer.camera.forEach((shot, k) => place(shot.focus, `${where}.camera[${k}].focus`));
  layer.regions.forEach((r, i) => {
    if (r.clipTo && !regions.has(r.clipTo)) fail(`${where}.regions[${i}].clipTo`, `no region "${r.clipTo}"`);
    if (r.sweep) {
      place(r.sweep.origin, `${where}.regions[${i}].sweep.origin`);
      progress(r.sweep.progress, `${where}.regions[${i}].sweep.progress`);
    }
  });
  layer.signals.forEach((s, i) => {
    s.along.forEach((p, j) => {
      if (!paths.has(p)) fail(`${where}.signals[${i}].along[${j}]`, `no path "${p}"`);
    });
    progress(s.progress, `${where}.signals[${i}].progress`);
  });
  layer.fields.forEach((f, i) => {
    place(f.origin, `${where}.fields[${i}].origin`);
    f.lights.forEach((n, j) => {
      if (!nodes.has(n)) fail(`${where}.fields[${i}].lights[${j}]`, `no node "${n}"`);
    });
  });
  layer.highlight.forEach((h, i) => {
    if (!seen.has(h.target)) fail(`${where}.highlight[${i}].target`, `no node, path or region "${h.target}"`);
  });
};

const PLACEHOLDER = /\[[^\]\n]+\]/;

/** Template text like "[Kavramın adı]" must not survive into a real video. */
const checkPlaceholders = (raw: RawSpec) => {
  if (raw.template) return;
  const visit = (v: unknown, where: string): void => {
    if (typeof v === "string") {
      const m = PLACEHOLDER.exec(v);
      if (m) fail(where, `still holds the template placeholder ${m[0]} — write the real text (use parentheses for literal brackets)`);
    } else if (Array.isArray(v)) v.forEach((item, i) => visit(item, `${where}[${i}]`));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, item]) => visit(item, `${where}.${k}`));
  };
  Object.entries(raw).forEach(([k, v]) => visit(v, k));
};

const words = (text: string) =>
  text
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * STYLE rules about the script itself: no two "Peki…?" questions in a row, hook titles reuse the words being
 * spoken, and with a `peak` mark the strongest moment sits in the last third with no long section after it.
 */
const checkScript = (raw: RawSpec, spec: Spec, phrases: Phrase[]) => {
  phrases.forEach((p, i) => {
    if (i > 0 && /^peki\b/i.test(phrases[i - 1].text) && /^peki\b/i.test(p.text)) {
      fail("voiceover", `"${phrases[i - 1].text}" / "${p.text}": two "Peki…?" questions in a row`);
    }
    const missing = raw.template ? [] : unreadable(p.text);
    if (missing.length) {
      fail("voiceover", `"${p.text}": no reading for ${missing.map((m) => `"${m}"`).join(", ")} — add it to src/spec/lexicon.ts or write it out`);
    }
  });
  for (const s of raw.template ? [] : sentencesOf(raw.voiceover.sections)) {
    if (s.kind === "fragment") continue;
    const tokens = s.text.trim().split(/\s+/);
    const last = splitToken(tokens[tokens.length - 1]).base;
    if (needsReading(last)) {
      fail("voiceover", `"${s.text}" ends on "${last}"; end a sentence on a word ("…dalgası: T." → "Sonra T dalgası geliyor: toparlanma.")`);
    }
    if (endsOnQuestionWord(s.text)) {
      fail("voiceover", `"${s.text}" ends on its question word, which then takes the stress ("Peki o sivri tepe ne?" → "Peki ya o sivri tepe?")`);
    }
  }
  if (!raw.template) {
    spec.titles.forEach((title, i) => {
      const spoken = new Set(phrases.filter((p) => p.end > title.from && p.start < title.to).flatMap((p) => words(p.text)));
      const missing = words(`${title.top} ${title.bottom}`).filter((w) => !spoken.has(w));
      if (missing.length) fail(`titles[${i}]`, `uses words the voice-over does not say meanwhile: ${missing.join(", ")}`);
    });
  }
  const peak = spec.marks.peak;
  if (typeof peak === "number") {
    const third = (spec.durationSec * 2) / 3;
    if (peak < third) fail("marks.peak", `the strongest moment (${peak.toFixed(1)} s) must be in the last third (after ${third.toFixed(1)} s)`);
    raw.voiceover.sections.forEach((s, i) => {
      const length = s.window[1] - s.window[0];
      if (s.window[0] >= peak - 0.01 && length > 8) {
        fail(`voiceover.sections[${i}]`, `"${s.id}" starts after the peak and runs ${length.toFixed(1)} s (at most 8)`);
      }
    });
  }
};

const FREEZE_LIMIT = 3;

/**
 * A spec with a timeline shows only sourced values on its counter: every value the counter can display comes
 * from "#key" or from a segment that runs at real speed. And no counter stands still for more than 3 s unless
 * a `holds` range says so.
 */
const checkTimeline = (raw: RawSpec, spec: Spec, curve: (name: string) => CurveFn, fps: number, phrases: Phrase[]) => {
  const ids = new Set(spec.sources.map((s) => s.id).filter(Boolean));
  for (const [name, k] of Object.entries(spec.timeline?.keys ?? {})) {
    if (!ids.has(k.source)) fail(`timeline.keys.${name}.source`, `no source has id "${k.source}"`);
  }

  const c = spec.counter;
  if (!c) return;
  const end = Math.min(spec.concept ? spec.concept.at - 0.3 : spec.durationSec, c.until !== undefined ? c.until - 0.3 : Infinity);

  if (c.timeScale) {
    let p = 0;
    const starts = raw.voiceover.sections.map((s) => {
      const start = phrases[p].start;
      p += s.phrases.length;
      return start;
    });
    raw.voiceover.sections.forEach((section, i) => {
      const from = Math.max(starts[i], c.fadeIn[1]);
      const to = Math.min(starts[i + 1] ?? spec.durationSec, end);
      const seen = new Set<string>();
      for (let f = Math.ceil(from * fps); f < Math.floor(to * fps); f++) {
        const label = speedLabel(c, spec.curves[c.curve], f / fps, spec.lang);
        if (label) seen.add(label);
      }
      if (seen.size > 1) {
        fail("counter", `the speed label changes inside section "${section.id}" (${[...seen].join(" → ")}) — give each section one curve segment`);
      }
    });
  }

  if (spec.timeline) {
    const where = `curves.${c.curve}`;
    spec.curves[c.curve].segments.forEach((s, i) => {
      if (s.to <= c.fadeIn[0] || s.from >= end) return;
      const rawValues = raw.curves[c.curve].segments[i].values;
      if (s.realtime) {
        if (!c.timeScale) fail(`${where}.segments[${i}]`, 'a "realtime" segment needs counter.timeScale');
        const expected = c.timeScale!.unitPerSec * (s.to - s.from);
        if (Math.abs(s.values[1] - s.values[0] - expected) > Math.max(1, expected * 0.01)) {
          fail(`${where}.segments[${i}]`, `"realtime" but it advances ${s.values[1] - s.values[0]} in ${(s.to - s.from).toFixed(2)} s (expected ≈${Math.round(expected)})`);
        }
        if (typeof rawValues[0] !== "string") fail(`${where}.segments[${i}].values[0]`, 'a "realtime" segment starts from a "#key"');
        return;
      }
      rawValues.forEach((v, j) => {
        if (typeof v !== "string") {
          fail(`${where}.segments[${i}].values[${j}]`, 'the counter shows this value; take it from the timeline ("#name") so it has a source');
        }
      });
    });
  }

  const value = curve(c.curve);
  const held = (from: number, to: number) => c.holds.some(([a, b]) => a <= from + 0.05 && b >= to - 0.05);
  let runStart = c.fadeIn[1];
  let runText = "";
  for (let f = Math.ceil(c.fadeIn[1] * fps); f <= Math.floor(end * fps); f++) {
    const t = f / fps;
    const shown = formatCounter(value(t), c.unit, c.format, spec.lang).text;
    if (shown !== runText) {
      runText = shown;
      runStart = t;
    } else if (t - runStart > FREEZE_LIMIT && !held(runStart, t)) {
      fail("counter", `shows "${shown} ${c.unit}" unchanged from ${runStart.toFixed(1)} s for more than ${FREEZE_LIMIT} s — keep the curve moving or add a "holds" range`);
    }
  }
};

const check = (spec: Spec) => {
  const scenes = sceneFindings(spec);
  if (scenes.length) fail("scenes", scenes.join("\n  "));
  const sfx = new Set(Object.keys(catalog));
  const needSfx = (id: string | undefined, where: string) => {
    if (id !== undefined && !sfx.has(id)) fail(where, `unknown sound "${id}" — add it to src/kit/audio/sfx-catalog.json`);
  };
  const needCurve = (name: string, where: string) => {
    if (!(name in spec.curves)) fail(where, `unknown curve "${name}" — define it under "curves"`);
  };

  for (const [name, curve] of Object.entries(spec.curves)) {
    curve.segments.forEach((s, i) => {
      if (s.from > s.to) fail(`curves.${name}.segments[${i}]`, "from is after to");
      if (i > 0 && s.from < curve.segments[i - 1].to) fail(`curves.${name}.segments[${i}]`, "overlaps the previous segment");
      if (s.scale === "log" && Math.min(...s.values) + s.logOffset <= 0) {
        fail(`curves.${name}.segments[${i}]`, "log scale needs values + logOffset > 0");
      }
    });
  }

  const ids = new Set<string>();
  spec.layers.forEach((layer, i) => {
    const where = `layers[${i}] (${layer.type})`;
    if (layer.id !== undefined) {
      if (ids.has(layer.id)) fail(where, `duplicate id "${layer.id}"`);
      ids.add(layer.id);
    }
    if (layer.type === "globe") {
      layer.camera.forEach((shot, k) => {
        if (k > 0 && shot.from < layer.camera[k - 1].from) fail(`${where}.camera[${k}]`, "shots must be in time order");
        if (shot.type === "pullback") needCurve(shot.progress.curve, `${where}.camera[${k}]`);
        if (shot.type === "descend") needCurve(shot.curve, `${where}.camera[${k}]`);
        if (shot.type === "follow" && !layer.hero) fail(`${where}.camera[${k}]`, 'a "follow" shot needs "hero"');
        if (shot.type === "descend" && k === 0) fail(`${where}.camera[0]`, 'a "descend" shot needs a shot before it');
      });
      if (layer.hero && !layer.orbits) fail(where, '"hero" needs "orbits"');
      if (layer.orbits && Math.abs(layer.location.lat) > layer.orbits.inclinationDeg) {
        fail(where, "orbits.inclinationDeg must be at least |location.lat| so orbit 0 can pass overhead");
      }
    }
    if (layer.type === "cityMap") needCurve(layer.zoom.curve, where);
    if (layer.type === "trace" || layer.type === "flow" || layer.type === "model3d") {
      layer.camera.forEach((shot, k) => {
        if (k > 0 && shot.at < layer.camera[k - 1].at) fail(`${where}.camera[${k}]`, "shots must be in time order");
      });
    }
    if (layer.type === "trace") {
      needCurve(layer.clock, where);
      needSfx(layer.beep?.id, `${where}.beep`);
    }
    if (layer.type === "flow") checkFlow(layer, where, needCurve);
  });

  spec.layers.forEach((layer, i) => {
    if (layer.type !== "signalPass") return;
    const target = spec.layers.find((l) => l.id === layer.anchor.layer);
    if (target?.type !== "globe") fail(`layers[${i}].anchor`, `"${layer.anchor.layer}" is not a globe layer id`);
    if (layer.anchor.point !== "location" && target?.type === "globe" && !target.orbits) {
      fail(`layers[${i}].anchor`, `point "${layer.anchor.point}" needs orbits on "${layer.anchor.layer}"`);
    }
  });

  if (spec.counter) needCurve(spec.counter.curve, "counter");
  spec.labels.forEach((l, i) => needSfx(l.sound, `labels[${i}].sound`));
  spec.sound.beds.forEach((b, i) => {
    needSfx(b.id, `sound.beds[${i}]`);
    if (!b.loop) return;
    const length = (lengths as Record<string, number>)[b.id];
    if (!length) fail(`sound.beds[${i}]`, `no length for "${b.id}" — run npm run sfx -- --index`);
    if (b.crossfade * 2 >= length) fail(`sound.beds[${i}].crossfade`, `must be under half of the file (${length} s)`);
  });
  spec.sound.hits.forEach((h, i) => needSfx(h.id, `sound.hits[${i}]`));
  needSfx(spec.countdown?.sound, "countdown.sound");
  needSfx(spec.concept?.sound, "concept.sound");
};

/** spec.json (+ timing.json) → a fully checked spec in plain seconds. Throws with the offending path. */
export const resolveVideo = (rawSpec: unknown, rawTiming: unknown): Video => {
  const parsed = VideoSpec.safeParse(rawSpec);
  if (!parsed.success) throw new Error(`spec.json is invalid:\n${z.prettifyError(parsed.error)}`);
  const raw = parsed.data;

  let timing: Timing | null = null;
  if (rawTiming) {
    const t = Timing.safeParse(rawTiming);
    if (!t.success) throw new Error(`timing.json is invalid:\n${z.prettifyError(t.error)}`);
    timing = t.data;
  }
  const texts = phraseTexts(raw.voiceover.sections);
  if (timing && !timingMatches(timing, texts)) {
    const message = "timing.json was made from different phrases — run scripts/voiceover.mjs or scripts/align.mjs again";
    if (getRemotionEnvironment().isRendering) throw new Error(message);
    console.warn(`${raw.title}: ${message}; using a draft estimate`);
    timing = null;
  }
  const phrases = timing ? timing.phrases : estimatePhrases(raw.voiceover.sections);

  const { mark, walk } = createResolver(raw, phrases);
  const marks = Object.fromEntries(Object.keys(raw.marks).map((name) => [name, mark(name, `marks.${name}`)]));
  const walked = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, TEXT_FIELDS.has(key) ? value : walk(value, key)]),
  );
  const resolved = ResolvedSpec.safeParse({ ...walked, marks });
  if (!resolved.success) {
    throw new Error(
      `spec.json has a time of the wrong kind (a range where one time is expected, or the reverse):\n${z.prettifyError(resolved.error)}`,
    );
  }
  const spec = resolved.data;
  checkPlaceholders(raw);
  check(spec);

  const curves = new Map(Object.entries(spec.curves).map(([name, c]) => [name, curveFn(c)]));
  checkTimeline(raw, spec, (name) => curves.get(name) ?? fail("curves", `unknown curve "${name}"`), FPS, phrases);
  checkScript(raw, spec, phrases);
  const lineWidth = spec.captions.maxWidth ?? spec.layout.contentWidth;
  const fits = (text: string) => textWidth(text, SANS, spec.captions.size, 800) <= lineWidth;
  for (const p of raw.template ? [] : phrases) {
    if (!splitPage(p.text.split(" ").map((text) => ({ text })), fits)) {
      fail("captions", `"${p.text}" does not fit the caption line at ${spec.captions.size} px, not even as two pages of 2–6 words — shorten the sentence`);
    }
  }
  return {
    spec,
    phrases,
    pages: captionPages(phrases, timing ? timing.words : null, fits),
    curve: (name) => curves.get(name) ?? fail("curves", `unknown curve "${name}"`),
    timed: timing !== null,
    voiceoverAudio: spec.voiceover.audio ?? timing?.audio,
  };
};
