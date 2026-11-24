// A data line's leader to the scene element it names (`labels[].pointTo`): the renderer (LabelPointers) and qa
// (scripts/lib/composition.mjs) draw it with this same geometry.
import { isArea, type Vec } from "../framing.ts";
import type { Box } from "./geometry";

/** A point target's leader stops this far short of its centre at most (outside its ring); an area's runs in. */
const REACH = 40;
/** Where the leader leaves the panel's top or bottom edge, kept this far from its corners. */
const INSET = 16;
const MIN_LENGTH = 8;

/** "heart.sa" → ["heart", "sa"]: a layer (its id, else type#index) and one of its elements. */
export const splitPointer = (pointTo: string): [string, string] => {
  const i = pointTo.indexOf(".");
  return [pointTo.slice(0, i), pointTo.slice(i + 1)];
};

/**
 * From the side of the panel that faces the element (at the label's own row when it leaves sideways) to the
 * element; null when the element lies within the panel's span on both axes or too close to it.
 */
export const pointerLine = (label: Box, panel: Box, target: Box): [Vec, Vec] | null => {
  const c: Vec = [(target.x1 + target.x2) / 2, (target.y1 + target.y2) / 2];
  const row = Math.min(panel.y2, Math.max(panel.y1, (label.y1 + label.y2) / 2));
  const along = Math.min(panel.x2 - INSET, Math.max(panel.x1 + INSET, c[0]));
  const from: Vec | null =
    c[0] > panel.x2 ? [panel.x2, row] : c[0] < panel.x1 ? [panel.x1, row] : c[1] > panel.y2 ? [along, panel.y2] : c[1] < panel.y1 ? [along, panel.y1] : null;
  if (!from) return null;
  const gap = isArea(target) ? 0 : Math.min(REACH, (target.x2 - target.x1) / 2, (target.y2 - target.y1) / 2);
  const d = Math.hypot(c[0] - from[0], c[1] - from[1]);
  if (d - gap < MIN_LENGTH) return null;
  const k = (d - gap) / d;
  return [from, [from[0] + (c[0] - from[0]) * k, from[1] + (c[1] - from[1]) * k]];
};
