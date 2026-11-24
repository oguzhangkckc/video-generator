import { fitText } from "@remotion/layout-utils";
import type { Video } from "../../spec/resolve";
import { layerName } from "../../spec/scenes";
import { CX, HEIGHT, WIDTH } from "../format";
import type { Layout } from "../layout";
import { windowAlpha } from "../time";
import { MONO, SANS } from "../theme";
import { counterOpacity, counterText, speedLabel } from "./Counter";
import { LINE, labelBox, textWidth as width, type Box } from "./geometry";

export type QaBox = Box & { kind: string; id: string; text: string };

/** Only fully faded-in text counts in qa; an overlap during a 0.3 s crossfade is not a layout error. */
export const SETTLE = 0.3;
/** LabelBackdrop's padding around a column of data lines. */
export const PANEL_PAD = 18;
/** A data strip's inner margin from the frame edges. */
export const STRIP_MARGIN = 40;

/**
 * When an overlay counts. qa asks for what is fully visible now (settle); the camera asks for what is about to be
 * or was just on screen (lead, lag), so it makes room before a line appears and does not rush back after it goes.
 */
type When = { settle?: number; lead?: number; lag?: number };
const within = (t: number, from: number, to: number, { settle = SETTLE, lead = 0, lag = 0 }: When) =>
  t >= from + settle - lead && t <= to - settle + lag;

/** Boxes of every overlay shown at `t`, with the same numbers the overlay components use. */
export const overlayBoxes = (video: Video, t: number, layout: Layout, when: When = {}): QaBox[] => {
  const { rightInset, contentWidth } = layout;
  const s = video.spec;
  const out: QaBox[] = [];
  const add = (kind: string, id: string, text: string, x1: number, y1: number, w: number, h: number) =>
    out.push({ kind, id, text, x1, y1, x2: x1 + w, y2: y1 + h });
  const xFor = (align: string, w: number) => (align === "left" ? 80 : align === "right" ? WIDTH - rightInset - w : CX - w / 2);
  const lead = when.lead ?? 0;
  const lag = when.lag ?? 0;
  const around = (f: (u: number) => boolean) => f(t) || (lead > 0 && f(t + lead)) || (lag > 0 && f(t - lag));

  s.labels.forEach((l, i) => {
    if (!within(t, l.at, l.until, when)) return;
    const b = labelBox(l, rightInset);
    add("label", `labels[${i}]`, l.text, b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
  });
  s.notes.forEach((n, i) => {
    if (!within(t, n.at, n.until, when)) return;
    const w = width(n.text, MONO, n.size, 700, "0.18em");
    add("note", `notes[${i}]`, n.text, xFor(n.align, w), n.top, w, n.size * LINE);
  });
  s.titles.forEach((title, i) => {
    if (!within(t, title.from, title.to, when)) return;
    const bottom = Math.min(118, fitText({ text: title.bottom, withinWidth: contentWidth, fontFamily: SANS, fontWeight: 800 }).fontSize);
    const w = Math.max(width(title.top, SANS, 46, 600, "0.04em"), width(title.bottom, SANS, bottom, 800));
    add("title", `titles[${i}]`, `${title.top} / ${title.bottom}`, CX - w / 2, 560, w, 46 * LINE + bottom * 1.02);
  });
  if (s.counter) {
    const c = s.counter;
    const value = video.curve(c.curve);
    if (around((u) => counterOpacity(c, u, s.concept?.at) > 0.5)) {
      const text = counterText(c, value, t, s.lang);
      const speed = speedLabel(c, s.curves[c.curve], t, s.lang);
      const w = Math.max(width(c.label, MONO, 24, 500, "0.22em"), width(text, MONO, 76, 700), speed ? width(speed, MONO, 42, 700) * 1.18 : 0);
      add("counter", "counter", text, WIDTH - rightInset - w, 150, w, 24 * LINE + 76 * 1.05 + (speed ? 42 * 1.1 : 0));
    }
  }
  if (s.countdown) {
    const c = s.countdown;
    if (within(t, c.from + 0.15, c.to - 0.2, { ...when, settle: 0 })) {
      const slot = (c.to - c.from) / c.values.length;
      const value = c.values[Math.max(0, Math.min(c.values.length - 1, Math.floor((t - c.from) / slot)))];
      const size = Math.min(260, fitText({ text: value, withinWidth: contentWidth / 1.25, fontFamily: MONO, fontWeight: 700 }).fontSize);
      const w = Math.max(width(value, MONO, size, 700) * 1.25, c.label ? width(c.label, MONO, 28, 500, "0.22em") : 0, 420);
      add("countdown", "countdown", value, CX - w / 2, c.top, w, (c.label ? 28 * LINE : 0) + size * 1.05 + 24);
    }
  }
  if (s.concept) {
    const c = s.concept;
    if (within(t, c.at, c.until ?? Infinity, when)) {
      const size = Math.min(150, fitText({ text: c.name, withinWidth: contentWidth, fontFamily: SANS, fontWeight: 800 }).fontSize);
      const w = Math.max(width(c.name, SANS, size, 800), c.kicker ? width(c.kicker, MONO, 30, 500, "0.22em") : 0, 520);
      add("concept", "concept", c.name, CX - w / 2, c.top, w, (c.kicker ? 30 * LINE + 12 : 0) + size * 1.02 + 28);
    }
  }

  const ms = t * 1000;
  const page = video.pages.find((p, i) => ms >= p.startMs + 120 && ms < Math.min(video.pages[i + 1]?.startMs ?? Infinity, p.endMs + s.captions.lingerMs));
  if (page) {
    const text = page.tokens.map((token) => token.text).join(" ");
    const maxWidth = s.captions.maxWidth ?? contentWidth;
    const size = Math.min(s.captions.maxFont, fitText({ text, withinWidth: maxWidth, fontFamily: SANS, fontWeight: 800 }).fontSize);
    const w = width(text, SANS, size, 800);
    const h = size * LINE;
    add("caption", "captions", text, CX - w / 2, HEIGHT * s.captions.y - h / 2, w, h);
  }
  return out;
};

/** The caption line's band: where a page can be, whatever its words. Null when the video has no captions. */
export const captionBand = (video: Video, layout: Layout): Box | null => {
  if (!video.pages.length) return null;
  const c = video.spec.captions;
  const w = c.maxWidth ?? layout.contentWidth;
  const h = c.maxFont * LINE;
  return { x1: CX - w / 2, y1: HEIGHT * c.y - h / 2, x2: CX + w / 2, y2: HEIGHT * c.y + h / 2 };
};

/** A trace drawn as a data strip: a dark panel across the frame at panel.top. */
export const stripBox = (panel: { top: number; height: number }): Box => ({
  x1: STRIP_MARGIN,
  y1: panel.top,
  x2: WIDTH - STRIP_MARGIN,
  y2: panel.top + panel.height,
});

/**
 * Where a scene's important elements must not go at `t`: the label panels (as LabelBackdrop draws them, padded),
 * notes, titles, counter, countdown, concept card, data strips and the whole caption band.
 */
export const reservedZones = (video: Video, t: number, layout: Layout): QaBox[] => {
  const when = { settle: 0, lead: 0.6, lag: 0.3 };
  const boxes = overlayBoxes(video, t, layout, when).filter((b) => b.kind !== "caption" && b.kind !== "label");
  const panels = new Map<string, Box>();
  video.spec.labels.forEach((l) => {
    if (!within(t, l.at, l.until, when)) return;
    const b = labelBox(l, layout.rightInset);
    const g = panels.get(l.align);
    panels.set(l.align, g ? { x1: Math.min(g.x1, b.x1), y1: Math.min(g.y1, b.y1), x2: Math.max(g.x2, b.x2), y2: Math.max(g.y2, b.y2) } : b);
  });
  for (const [align, b] of panels) {
    boxes.push({ kind: "panel", id: `labels:${align}`, text: "", x1: b.x1 - PANEL_PAD, y1: b.y1 - PANEL_PAD, x2: b.x2 + PANEL_PAD, y2: b.y2 + PANEL_PAD });
  }
  video.spec.layers.forEach((layer, i) => {
    if (layer.type !== "trace" || !layer.panel) return;
    if (!layer.visible.some((w) => windowAlpha(t, w) > 0 || windowAlpha(t + when.lead, w) > 0)) return;
    boxes.push({ kind: "strip", id: layerName(layer, i), text: "", ...stripBox(layer.panel) });
  });
  const band = captionBand(video, layout);
  if (band) boxes.push({ kind: "caption", id: "captions", text: "", ...band, y1: band.y1 - 12, y2: band.y2 + 12 });
  return boxes;
};
