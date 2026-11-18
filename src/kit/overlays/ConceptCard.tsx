import { fitText } from "@remotion/layout-utils";
import { spring, useVideoConfig } from "remotion";
import type { Spec } from "../../spec/schema";
import { Sfx } from "../audio/Sfx";
import { useLayout } from "../layout";
import { COLOR, MONO, SANS, TEXT_SHADOW, tokenColor } from "../theme";
import { ramp, sec, useTime } from "../time";

type Concept = NonNullable<Spec["concept"]>;

const MAX_SIZE = 150;

const ConceptView: React.FC<{ concept: Concept }> = ({ concept }) => {
  const t = useTime();
  const { fps } = useVideoConfig();
  const { contentWidth } = useLayout();
  const { at, until, kicker, name, color, top } = concept;
  if (t < at || (until !== undefined && t >= until)) return null;

  const enter = spring({ frame: Math.round(t * fps) - sec(at), fps, config: { damping: 200 }, durationInFrames: 14 });
  const underline = ramp(t, [at + 0.25, at + 0.8]);
  const exit = until !== undefined ? ramp(t, [until - 0.3, until]) : 0;
  const size = Math.min(MAX_SIZE, fitText({ text: name, withinWidth: contentWidth, fontFamily: SANS, fontWeight: 800 }).fontSize);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        textAlign: "center",
        whiteSpace: "nowrap",
        opacity: enter * (1 - exit),
        transform: `translateY(${(1 - enter) * 28}px)`,
        textShadow: TEXT_SHADOW,
      }}
    >
      {kicker ? (
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: 30,
            letterSpacing: "0.22em",
            marginRight: "-0.22em",
            color: COLOR.counterLabel,
            marginBottom: 12,
          }}
        >
          {kicker}
        </div>
      ) : null}
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.02, color: tokenColor(color) }}>
        {name}
      </div>
      <div style={{ margin: "22px auto 0", width: 520 * underline, height: 6, background: COLOR.secondary }} />
    </div>
  );
};

/** The concept's name, revealed last (STYLE.md). */
export const ConceptCard: React.FC<{ concept: Concept }> = ({ concept }) => (
  <>
    {concept.sound ? <Sfx id={concept.sound} at={concept.at} /> : null}
    <ConceptView concept={concept} />
  </>
);
