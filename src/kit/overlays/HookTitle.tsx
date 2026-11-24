import { fitText } from "@remotion/layout-utils";
import { spring, useVideoConfig } from "remotion";
import type { Spec } from "../../spec/schema";
import { useLayout } from "../layout";
import { COLOR, SANS, TEXT_SHADOW } from "../theme";
import { ramp, sec, useTime } from "../time";

type Props = Spec["titles"][number];

export const HookTitle: React.FC<Props> = ({ top, bottom, from, to, y }) => {
  const t = useTime();
  const { fps } = useVideoConfig();
  const { contentWidth } = useLayout();
  if (t < from || t >= to) return null;

  // The opening title must already be readable on frame 0 (thumbnail, first impression).
  const enter = spring({
    frame: Math.round(t * fps) - sec(from) + (from === 0 ? 12 : 0),
    fps,
    config: { damping: 200 },
    durationInFrames: 12,
  });
  const exit = ramp(t, [to - 0.2, to]);
  const bottomSize = Math.min(
    118,
    fitText({ text: bottom, withinWidth: contentWidth, fontFamily: SANS, fontWeight: 800 }).fontSize,
  );

  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        textAlign: "center",
        whiteSpace: "nowrap",
        opacity: enter * (1 - exit),
        transform: `translateY(${(1 - enter) * 28}px) scale(${0.96 + 0.04 * enter})`,
        textShadow: TEXT_SHADOW,
      }}
    >
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 46, letterSpacing: "0.04em", color: COLOR.text }}>
        {top}
      </div>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: bottomSize, lineHeight: 1.02, color: COLOR.you }}>
        {bottom}
      </div>
    </div>
  );
};
