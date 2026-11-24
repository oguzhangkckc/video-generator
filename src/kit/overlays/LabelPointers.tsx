import type { Spec } from "../../spec/schema";
import { HEIGHT, WIDTH } from "../format";
import { useFraming } from "../framing";
import { useLayout } from "../layout";
import { tokenColor } from "../theme";
import { EASING, ramp, useTime } from "../time";
import { PANEL_PAD } from "./boxes";
import { labelAlpha, labelBox, type Box } from "./geometry";
import { pointerLine, rowsInTheWay, splitPointer } from "./pointer";

const DOT_R = 5;

/**
 * Leaders from data lines to the scene elements they name (`pointTo`). Reads what the scenes drew this frame
 * (framing.board), so it must render after them; draws nothing for an element that is hidden or not drawn now.
 */
export const LabelPointers: React.FC<{ labels: Spec["labels"] }> = ({ labels }) => {
  const t = useTime();
  const { rightInset } = useLayout();
  const { board } = useFraming();
  const shown = labels.map((l) => ({ l, alpha: labelAlpha(l, t), box: labelBox(l, rightInset) })).filter((s) => s.alpha > 0);
  if (!shown.some((s) => s.l.pointTo)) return null;

  const panels = new Map<string, Box>();
  for (const { l, box } of shown) {
    const g = panels.get(l.align);
    panels.set(l.align, g ? { x1: Math.min(g.x1, box.x1), y1: Math.min(g.y1, box.y1), x2: Math.max(g.x2, box.x2), y2: Math.max(g.y2, box.y2) } : box);
  }

  const lines = shown.flatMap(({ l, alpha, box }) => {
    if (!l.pointTo) return [];
    const [layer, id] = splitPointer(l.pointTo);
    const scene = board.get(layer);
    if (!scene || Math.abs(scene.t - t) > 1e-6 || scene.opacity <= 0) return [];
    const target = scene.elements.find((e) => e.id === id);
    if (!target || target.hidden) return [];
    const p = panels.get(l.align)!;
    const pointer = pointerLine(box, { x1: p.x1 - PANEL_PAD, y1: p.y1 - PANEL_PAD, x2: p.x2 + PANEL_PAD, y2: p.y2 + PANEL_PAD }, target);
    if (!pointer) return [];
    const others = shown.filter((s) => s.l !== l && s.l.align === l.align).map((s) => ({ ...s.box, alpha: s.alpha }));
    const blocked = Math.max(0, ...rowsInTheWay(pointer, box, others).map((o) => o.alpha));
    if (blocked >= 1) return [];
    const grow = ramp(t, [l.at + 0.1, l.at + 0.45], [0, 1], EASING.outCubic);
    const { from: [x1, y1], to: [x2, y2] } = pointer;
    return [
      {
        key: `${l.text}-${l.at}`,
        x1,
        y1,
        x2: x1 + (x2 - x1) * grow,
        y2: y1 + (y2 - y1) * grow,
        grow,
        color: tokenColor(l.color),
        alpha: alpha * (1 - blocked) * Math.min(1, scene.opacity),
      },
    ];
  });

  return (
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
      {lines.map((p) => (
        <g key={p.key} opacity={p.alpha}>
          <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeOpacity={0.75} strokeWidth={2.5} strokeLinecap="round" />
          {p.grow >= 1 ? <circle cx={p.x2} cy={p.y2} r={DOT_R} fill={p.color} /> : null}
        </g>
      ))}
    </svg>
  );
};
