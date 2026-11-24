import type { Spec } from "../../spec/schema";
import type { CurveFn } from "../curves";
import { formatCounter, niceFactor } from "../format";
import { useLayout } from "../layout";
import { COLOR, MONO, TEXT_SHADOW } from "../theme";
import { ramp, useTime } from "../time";

type CounterSpec = NonNullable<Spec["counter"]>;
type Curve = Spec["curves"][string];
type Props = { counter: CounterSpec; value: CurveFn; curve: Curve; locale: string; conceptAt?: number };

/** A changed speed label pops for this long, so the viewer notices the new pace. */
const HIGHLIGHT = 0.6;
/** Cap height ≈ 0.72 × font size in JetBrains Mono: 42 px gives the ~30 px letters STYLE asks for. */
const SPEED_FONT = 42;

/**
 * "×100 YAVAŞ" / "×2 HIZLI" from the average speed of the curve segment under `t`, so it stays fixed for a whole
 * segment; null while the value holds still or runs at real speed.
 */
export const speedLabel = (counter: CounterSpec, curve: Curve, t: number, locale: string) => {
  if (!counter.timeScale) return null;
  // Half-open, so the frame on a boundary already belongs to the next segment (and its section).
  const s = curve.segments.find((seg) => t >= seg.from && t < seg.to);
  if (!s || s.to <= s.from) return null;
  const rate = (s.values[1] - s.values[0]) / (s.to - s.from);
  if (rate <= 1e-9) return null;
  const factor = counter.timeScale.unitPerSec / rate;
  const n = (x: number) => new Intl.NumberFormat(locale).format(niceFactor(x));
  if (factor >= 1.5) return `×${n(factor)} YAVAŞ`;
  if (factor <= 1 / 1.5) return `×${n(1 / factor)} HIZLI`;
  return null;
};

/** What the counter shows at `t`; also used by the checks in src/spec/resolve.ts. */
export const counterText = (counter: CounterSpec, value: CurveFn, t: number, locale: string) => {
  const { text, unit } = formatCounter(value(t), counter.unit, counter.format, locale);
  return `${text} ${unit}`;
};

export const counterOpacity = (counter: CounterSpec, t: number, conceptAt?: number) => {
  const end = Math.min(conceptAt ?? Infinity, counter.until ?? Infinity);
  const hidden = Number.isFinite(end) ? ramp(t, [end - 0.3, end]) : 0;
  const dim = counter.dim ? 1 - counter.dim.amount * ramp(t, counter.dim.range) : 1;
  return Math.min(ramp(t, counter.fadeIn), dim) * (1 - hidden);
};

/** Fixed top-right meter; the same curve usually also drives the camera and the scene's animation. */
export const Counter: React.FC<Props> = ({ counter, value, curve, locale, conceptAt }) => {
  const t = useTime();
  const { rightInset } = useLayout();
  const opacity = counterOpacity(counter, t, conceptAt);
  if (opacity <= 0) return null;
  const speed = speedLabel(counter, curve, t, locale);
  let pop = 0;
  if (speed) {
    for (let dt = 1 / 30; dt <= HIGHLIGHT; dt += 1 / 30) {
      if (speedLabel(counter, curve, t - dt, locale) !== speed) {
        pop = 1 - (dt - 1 / 30) / HIGHLIGHT;
        break;
      }
    }
  }

  return (
    <div style={{ position: "absolute", top: 150, right: rightInset, textAlign: "right", opacity }}>
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 500,
          fontSize: 24,
          letterSpacing: "0.22em",
          marginRight: "-0.22em",
          color: COLOR.counterLabel,
        }}
      >
        {counter.label}
      </div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 76, lineHeight: 1.05, color: COLOR.you, textShadow: TEXT_SHADOW }}>
        {counterText(counter, value, t, locale)}
      </div>
      {speed ? (
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: SPEED_FONT,
            lineHeight: 1.1,
            color: pop > 0 ? COLOR.text : COLOR.secondary,
            textShadow: pop > 0 ? `0 0 ${Math.round(24 * pop)}px ${COLOR.secondary}, ${TEXT_SHADOW}` : TEXT_SHADOW,
            transform: `scale(${1 + 0.18 * pop})`,
            transformOrigin: "right center",
          }}
        >
          {speed}
        </div>
      ) : null}
    </div>
  );
};
