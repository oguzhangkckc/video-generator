import type { Spec } from "../../spec/schema";
import { Sfx } from "../audio/Sfx";
import { useLayout } from "../layout";
import { COLOR, MONO, SANS, TEXT_SHADOW, tokenColor } from "../theme";
import { ramp, useTime } from "../time";

type Label = Spec["labels"][number];
type Note = Spec["notes"][number];
type TextProps = Omit<Label, "color" | "sound"> & { color: string };

const Check: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ marginLeft: size * 0.35, verticalAlign: "-0.1em" }}>
    <polyline points="4,13 10,19 20,5" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DataText: React.FC<TextProps> = ({ text, at, until, top, color, size, font, align, typeSpeed, bar, check, letterSpacing }) => {
  const t = useTime();
  const { rightInset } = useLayout();
  if (t < at || t > until) return null;

  const enter = ramp(t, [at, at + 0.25]);
  const exit = ramp(t, [until - 0.3, until]);
  const shown = typeSpeed ? text.slice(0, Math.floor((t - at) * typeSpeed)) : text;
  const typed = !typeSpeed || shown.length === text.length;
  const horizontal = align === "left" ? { left: 80 } : align === "right" ? { right: rightInset } : { left: 0, right: 0 };

  return (
    <div
      style={{
        position: "absolute",
        top,
        ...horizontal,
        textAlign: align,
        whiteSpace: "nowrap",
        opacity: enter * (1 - exit),
        transform: `translateX(${(1 - enter) * (align === "left" ? -24 : 0)}px)`,
        fontFamily: font === "mono" ? MONO : SANS,
        fontWeight: font === "mono" ? 700 : 800,
        fontSize: size,
        letterSpacing,
        color,
        textShadow: TEXT_SHADOW,
      }}
    >
      {bar ? (
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: size * 0.9,
            marginRight: size * 0.4,
            verticalAlign: "-0.12em",
            background: COLOR.secondary,
          }}
        />
      ) : null}
      {shown}
      {check && typed ? <Check size={size * 0.9} color={color} /> : null}
    </div>
  );
};

/** Monospace data line; its sound plays at `at`, so it moves with the line. */
export const DataLabel: React.FC<{ label: Label }> = ({ label: { sound, color, ...rest } }) => (
  <>
    {sound ? <Sfx id={sound} at={rest.at} /> : null}
    <DataText {...rest} color={tokenColor(color)} />
  </>
);

/** Honesty note ("ÖLÇEKLİ DEĞİL", "sadeleştirildi") in the quiet secondary tone. */
export const NoteLabel: React.FC<{ note: Note }> = ({ note }) => (
  <DataText
    {...note}
    color={COLOR.note}
    font="mono"
    bar={false}
    check={false}
    letterSpacing="0.18em"
  />
);
