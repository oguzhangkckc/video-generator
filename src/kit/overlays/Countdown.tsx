import { fitText } from "@remotion/layout-utils";
import { spring, useVideoConfig } from "remotion";
import type { Spec } from "../../spec/schema";
import { Sfx } from "../audio/Sfx";
import { COLOR, MONO, TEXT_SHADOW, tokenColor } from "../theme";
import { ramp, useTime } from "../time";

type Countdown = NonNullable<Spec["countdown"]>;

const MAX_SIZE = 260;

const CountdownView: React.FC<{ countdown: Countdown }> = ({ countdown }) => {
  const t = useTime();
  const { fps } = useVideoConfig();
  const { from, to, values, label, top, color } = countdown;
  if (t < from || t >= to) return null;

  const slot = (to - from) / values.length;
  const index = Math.min(values.length - 1, Math.floor((t - from) / slot));
  const local = t - from - index * slot;
  const pop = spring({ frame: Math.round(local * fps), fps, config: { damping: 12, stiffness: 180 } });
  const opacity = ramp(t, [from, from + 0.15]) * (1 - ramp(t, [to - 0.2, to]));
  const value = values[index];
  const size = Math.min(MAX_SIZE, fitText({ text: value, withinWidth: 940, fontFamily: MONO, fontWeight: 700 }).fontSize);
  const remaining = 1 - Math.min(1, local / slot);

  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, textAlign: "center", opacity }}>
      {label ? (
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: 28,
            letterSpacing: "0.22em",
            marginRight: "-0.22em",
            color: COLOR.counterLabel,
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.05,
          color: tokenColor(color),
          textShadow: TEXT_SHADOW,
          transform: `scale(${1.25 - 0.25 * pop})`,
        }}
      >
        {value}
      </div>
      <div style={{ margin: "18px auto 0", width: 420, height: 6, background: "rgba(255,255,255,0.15)" }}>
        <div style={{ width: `${remaining * 100}%`, height: "100%", background: COLOR.secondary }} />
      </div>
    </div>
  );
};

/** Climax countdown; with a sound, it ticks at every value. */
export const Countdown: React.FC<{ countdown: Countdown }> = ({ countdown }) => {
  const slot = (countdown.to - countdown.from) / countdown.values.length;
  const { sound } = countdown;
  return (
    <>
      {sound ? countdown.values.map((v, i) => <Sfx key={i} id={sound} at={countdown.from + i * slot} />) : null}
      <CountdownView countdown={countdown} />
    </>
  );
};
