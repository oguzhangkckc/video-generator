import type { Spec } from "../../spec/schema";
import { useLayout } from "../layout";
import { COLOR } from "../theme";
import { useTime } from "../time";
import { conceptAlpha, conceptBox } from "./boxes";
import { labelAlpha, labelBox, type Box } from "./geometry";

const PAD = 18;

/**
 * One dark panel behind each column of visible data lines, so they stay readable over any scene; while the concept card
 * shows, the centred column's panel takes the card in too (STYLE: every text of the final card sits on dark ground).
 */
export const LabelBackdrop: React.FC<{ labels: Spec["labels"]; concept?: Spec["concept"] }> = ({ labels, concept }) => {
  const t = useTime();
  const { rightInset, contentWidth } = useLayout();
  const groups = new Map<string, { box: Box; alpha: number }>();
  const shown = labels.map((l) => ({ align: l.align, alpha: labelAlpha(l, t), box: () => labelBox(l, rightInset) }));
  if (concept) shown.push({ align: "center", alpha: conceptAlpha(concept, t), box: () => conceptBox(concept, contentWidth) });
  for (const l of shown) {
    const alpha = l.alpha;
    if (alpha <= 0) continue;
    const b = l.box();
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
