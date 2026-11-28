// A data line's leader to the scene element it names (`labels[].pointTo`): the renderer (LabelPointers) and qa
// (scripts/lib/composition.mjs) draw it with this same geometry.
import { isArea, nearestDrawn, type Vec } from "../framing.ts";
import type { Box } from "./geometry";

/** Without a drawn shape, a point target's leader stops this far short of its centre (outside its ring); an area's runs in. */
const REACH = 40;
/** Where the leader leaves the panel's top or bottom edge, kept this far from its corners. */
const INSET = 16;
const MIN_LENGTH = 8;

/** "heart.sa" → ["heart", "sa"]: a layer (its id, else type#index) and one of its elements. */
export const splitPointer = (pointTo: string): [string, string] => {
  const i = pointTo.indexOf(".");
  return [pointTo.slice(0, i), pointTo.slice(i + 1)];
};

export type Pointer = { from: Vec; to: Vec; side: "left" | "right" | "top" | "bottom" };

/**
 * From the side of the panel that faces the element (at the label's own row when it leaves sideways) to the
 * element; null when the element lies within the panel's span on both axes or too close to it.
 */
export const pointerLine = (label: Box, panel: Box, target: Box & { drawn?: Vec[][] }): Pointer | null => {
  const c: Vec = [(target.x1 + target.x2) / 2, (target.y1 + target.y2) / 2];
  const row = Math.min(panel.y2, Math.max(panel.y1, (label.y1 + label.y2) / 2));
  const along = Math.min(panel.x2 - INSET, Math.max(panel.x1 + INSET, c[0]));
  const [from, side]: [Vec, Pointer["side"]] | [null, null] =
    c[0] > panel.x2
      ? [[panel.x2, row], "right"]
      : c[0] < panel.x1
        ? [[panel.x1, row], "left"]
        : c[1] > panel.y2
          ? [[along, panel.y2], "bottom"]
          : c[1] < panel.y1
            ? [[along, panel.y1], "top"]
            : [null, null];
  if (!from) return null;
  // The leader ends on what is drawn (the nearest point of it), not at the middle of its box: the middle of a hollow
  // shape (a ring, an outline) can sit on another element.
  const hit = target.drawn?.length ? nearestDrawn(from, target.drawn) : null;
  if (hit) return hit.d < MIN_LENGTH ? null : { from, to: hit.at, side };
  const gap = isArea(target) ? 0 : Math.min(REACH, (target.x2 - target.x1) / 2, (target.y2 - target.y1) / 2);
  const d = Math.hypot(c[0] - from[0], c[1] - from[1]);
  if (d - gap < MIN_LENGTH) return null;
  const k = (d - gap) / d;
  return { from, to: [from[0] + (c[0] - from[0]) * k, from[1] + (c[1] - from[1]) * k], side };
};

/**
 * A leader leaving the bottom (top) of a stack of lines reads as coming from the line at that edge, so it is only
 * drawn for that line: these are the other lines of the panel that would sit between it and the leader.
 */
export const rowsInTheWay = <B extends Box>(pointer: Pointer, label: Box, others: B[]): B[] =>
  pointer.side === "bottom" ? others.filter((o) => o.y1 > label.y1) : pointer.side === "top" ? others.filter((o) => o.y1 < label.y1) : [];
