import { AbsoluteFill, interpolate } from "remotion";
import type { Spec } from "../../spec/schema";
import type { CaptionPage } from "../../spec/timing";
import { HEIGHT } from "../format";
import { COLOR, SANS, TEXT_SHADOW } from "../theme";
import { useTime } from "../time";

type Props = { pages: CaptionPage[]; captions: Spec["captions"] };

/** One line at a time: the spoken word is white, the words still to come are grey. */
export const Karaoke: React.FC<Props> = ({ pages, captions }) => {
  const ms = useTime() * 1000;
  const index = pages.findIndex((page, i) => {
    const nextStart = pages[i + 1]?.startMs ?? Infinity;
    return ms >= page.startMs && ms < Math.min(nextStart, page.endMs + captions.lingerMs);
  });
  if (index === -1) return null;

  const page = pages[index];
  const opacity = interpolate(ms - page.startMs, [0, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: Math.round(HEIGHT * captions.y),
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          textAlign: "center",
          whiteSpace: "nowrap",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: captions.size,
          textShadow: TEXT_SHADOW,
          opacity,
        }}
      >
        {page.tokens.map((token, i) => (
          <span key={token.startMs} style={{ color: ms >= token.startMs ? COLOR.text : COLOR.upcoming }}>
            {i > 0 ? " " : ""}
            {token.text}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
