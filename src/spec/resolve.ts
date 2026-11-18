import { getRemotionEnvironment } from "remotion";
import { z } from "zod";
import catalog from "../kit/audio/sfx-catalog.json";
import { curveFn, type CurveFn } from "../kit/curves";
import { MARK_REF } from "./primitives";
import { ResolvedSpec, Timing, VideoSpec, type Spec } from "./schema";
import {
  captionPages,
  estimatePhrases,
  phraseTexts,
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

  const walk = (v: unknown, where: string): unknown => {
    if (typeof v === "string") return v.startsWith("@") ? ref(v, where) : v;
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
const TEXT_FIELDS = new Set(["$schema", "title", "lang", "voiceover", "sources", "credits", "styleExceptions", "marks"]);

const check = (spec: Spec) => {
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
  spec.sound.beds.forEach((b, i) => needSfx(b.id, `sound.beds[${i}]`));
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
  check(spec);

  const curves = new Map(Object.entries(spec.curves).map(([name, c]) => [name, curveFn(c)]));
  return {
    spec,
    phrases,
    pages: captionPages(phrases, timing ? timing.words : null),
    curve: (name) => curves.get(name) ?? fail("curves", `unknown curve "${name}"`),
    timed: timing !== null,
    voiceoverAudio: spec.voiceover.audio ?? timing?.audio,
  };
};
