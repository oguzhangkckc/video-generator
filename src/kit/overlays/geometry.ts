import { measureText } from "@remotion/layout-utils";
import type { Spec } from "../../spec/schema";
import { CX, WIDTH } from "../format";
import { MONO, SANS } from "../theme";
import { ramp } from "../time";

export type Box = { x1: number; y1: number; x2: number; y2: number };
type Label = Spec["labels"][number];

/** CSS "normal" line height for Inter / JetBrains Mono is close to this. */
export const LINE = 1.2;

export const textWidth = (text: string, fontFamily: string, fontSize: number, fontWeight: number, letterSpacing?: string) =>
  measureText({ text, fontFamily, fontSize, fontWeight, letterSpacing }).width;

/** Where a data line sits on screen, with DataLabel's own numbers (left 80, bar, check mark). */
export const labelBox = (l: Label, rightInset: number): Box => {
  const mono = l.font === "mono";
  const w =
    textWidth(l.text, mono ? MONO : SANS, l.size, mono ? 700 : 800, l.letterSpacing) +
    (l.bar ? 6 + l.size * 0.4 : 0) +
    (l.check ? l.size * 1.25 : 0);
  const x1 = l.align === "left" ? 80 : l.align === "right" ? WIDTH - rightInset - w : CX - w / 2;
  return { x1, y1: l.top, x2: x1 + w, y2: l.top + l.size * LINE };
};

/** DataLabel's fade: in over 0.25 s, out over the last 0.3 s. */
export const labelAlpha = (l: { at: number; until: number }, t: number) =>
  t < l.at || t > l.until ? 0 : ramp(t, [l.at, l.at + 0.25]) * (1 - ramp(t, [l.until - 0.3, l.until]));
