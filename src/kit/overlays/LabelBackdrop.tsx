import type { Spec } from "../../spec/schema";
import { useLayout } from "../layout";
import { COLOR } from "../theme";
import { useTime } from "../time";
import { labelAlpha, labelBox, type Box } from "./geometry";

const PAD = 18;

/** One dark panel behind each column of visible data lines, so they stay readable over any scene. */
export const LabelBackdrop: React.FC<{ labels: Spec["labels"] }> = ({ labels }) => {
  const t = useTime();
  const { rightInset } = useLayout();
  const groups = new Map<string, { box: Box; alpha: number }>();
  for (const l of labels) {
    const alpha = labelAlpha(l, t);
    if (alpha <= 0) continue;
    const b = labelBox(l, rightInset);
    const g = groups.get(l.align);
    groups.set(
      l.align,
      g
        ? {
            box: { x1: Math.min(g.box.x1, b.x1), y1: Math.min(g.box.y1, b.y1), x2: Math.max(g.box.x2, b.x2), y2: Math.max(g.box.y2, b.y2) },
            alpha: Math.max(g.alpha, alpha),
          }
        : { box: b, alpha },
    );
  }
  return (
    <>
      {[...groups.values()].map(({ box, alpha }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: box.x1 - PAD,
            top: box.y1 - PAD,
            width: box.x2 - box.x1 + 2 * PAD,
            height: box.y2 - box.y1 + 2 * PAD,
            borderRadius: 16,
            background: COLOR.labelBackdrop,
            opacity: alpha,
          }}
        />
      ))}
    </>
  );
};
