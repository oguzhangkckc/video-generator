import { fitText, measureText } from "@remotion/layout-utils";
import { useEffect } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Video } from "../../spec/resolve";
import { CX, HEIGHT, WIDTH } from "../format";
import { useLayout } from "../layout";
import { counterOpacity, counterText, speedLabel } from "../overlays/Counter";
import { labelBox } from "../overlays/geometry";
import { MONO, SANS } from "../theme";

export type QaBox = { kind: string; id: string; text: string; x1: number; y1: number; x2: number; y2: number };

/** CSS "normal" line height for Inter / JetBrains Mono is close to this. */
const LINE = 1.2;
/** Only fully faded-in text counts; an overlap during a 0.3 s crossfade is not a layout error. */
const SETTLE = 0.3;

const width = (text: string, fontFamily: string, fontSize: number, fontWeight: number, letterSpacing?: string) =>
  measureText({ text, fontFamily, fontSize, fontWeight, letterSpacing }).width;

/** Boxes of every overlay fully visible at `t`, computed with the same numbers the overlay components use. */
const boxesAt = (video: Video, t: number, rightInset: number, contentWidth: number): QaBox[] => {
  const s = video.spec;
  const out: QaBox[] = [];
  const add = (kind: string, id: string, text: string, x1: number, y1: number, w: number, h: number) =>
    out.push({ kind, id, text, x1, y1, x2: x1 + w, y2: y1 + h });
  const xFor = (align: string, w: number) => (align === "left" ? 80 : align === "right" ? WIDTH - rightInset - w : CX - w / 2);

  s.labels.forEach((l, i) => {
    if (t < l.at + SETTLE || t > l.until - SETTLE) return;
    const b = labelBox(l, rightInset);
    add("label", `labels[${i}]`, l.text, b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
  });
  s.notes.forEach((n, i) => {
    if (t < n.at + SETTLE || t > n.until - SETTLE) return;
    const w = width(n.text, MONO, n.size, 700, "0.18em");
    add("note", `notes[${i}]`, n.text, xFor(n.align, w), n.top, w, n.size * LINE);
  });
  s.titles.forEach((title, i) => {
    if (t < title.from + SETTLE || t >= title.to - SETTLE) return;
    const bottom = Math.min(118, fitText({ text: title.bottom, withinWidth: contentWidth, fontFamily: SANS, fontWeight: 800 }).fontSize);
    const w = Math.max(width(title.top, SANS, 46, 600, "0.04em"), width(title.bottom, SANS, bottom, 800));
    add("title", `titles[${i}]`, `${title.top} / ${title.bottom}`, CX - w / 2, 560, w, 46 * LINE + bottom * 1.02);
  });
  if (s.counter) {
    const c = s.counter;
    const value = video.curve(c.curve);
    if (counterOpacity(c, t, s.concept?.at) > 0.5) {
      const text = counterText(c, value, t, s.lang);
      const speed = speedLabel(c, s.curves[c.curve], t, s.lang);
      const w = Math.max(width(c.label, MONO, 24, 500, "0.22em"), width(text, MONO, 76, 700), speed ? width(speed, MONO, 42, 700) * 1.18 : 0);
      add("counter", "counter", text, WIDTH - rightInset - w, 150, w, 24 * LINE + 76 * 1.05 + (speed ? 42 * 1.1 : 0));
    }
  }
  if (s.countdown) {
    const c = s.countdown;
    if (t >= c.from + 0.15 && t < c.to - 0.2) {
      const slot = (c.to - c.from) / c.values.length;
      const value = c.values[Math.min(c.values.length - 1, Math.floor((t - c.from) / slot))];
      const size = Math.min(260, fitText({ text: value, withinWidth: contentWidth / 1.25, fontFamily: MONO, fontWeight: 700 }).fontSize);
      const w = Math.max(width(value, MONO, size, 700) * 1.25, c.label ? width(c.label, MONO, 28, 500, "0.22em") : 0, 420);
      add("countdown", "countdown", value, CX - w / 2, c.top, w, (c.label ? 28 * LINE : 0) + size * 1.05 + 24);
    }
  }
  if (s.concept) {
    const c = s.concept;
    if (t >= c.at + SETTLE && (c.until === undefined || t < c.until - SETTLE)) {
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

/** QA mode only: logs the overlay boxes of this frame (and the resolved soundtrack) for scripts/qa.mjs. */
export const QaProbe: React.FC<{ video: Video }> = ({ video }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { rightInset, contentWidth } = useLayout();
  useEffect(() => {
    const t = frame / fps;
    console.log(`QA_BOXES ${JSON.stringify({ t, boxes: boxesAt(video, t, rightInset, contentWidth) })}`);
    const { sound, durationSec } = video.spec;
    console.log(`QA_SPEC ${JSON.stringify({ sound, durationSec, phrases: video.phrases })}`);
  }, [frame, fps, video, rightInset, contentWidth]);
  return null;
};
