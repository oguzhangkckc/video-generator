import type { Spec } from "../../spec/schema";
import type { CurveFn } from "../curves";
import { formatCounter, niceFactor } from "../format";
import { useLayout } from "../layout";
import { COLOR, MONO, TEXT_SHADOW } from "../theme";
import { ramp, useTime } from "../time";

type CounterSpec = NonNullable<Spec["counter"]>;
type Props = { counter: CounterSpec; value: CurveFn; locale: string; conceptAt?: number };

/** Averaged over half a second so the label does not flicker at curve joints. */
const RATE_WINDOW = 0.25;

/** "×100 YAVAŞ" / "×2 HIZLI", or null near real time and while the value stands still. */
export const speedLabel = (counter: CounterSpec, value: CurveFn, t: number, locale: string) => {
  if (!counter.timeScale) return null;
  const rate = (value(t + RATE_WINDOW) - value(t - RATE_WINDOW)) / (2 * RATE_WINDOW);
  if (rate <= 1e-9) return null;
  const factor = counter.timeScale.unitPerSec / rate;
  const n = (x: number) => new Intl.NumberFormat(locale).format(niceFactor(x));
  if (factor >= 1.5) return `×${n(factor)} YAVAŞ`;
  if (factor <= 1 / 1.5) return `×${n(1 / factor)} HIZLI`;
  return null;
};

/** What the counter shows at `t`; also used by the freeze check in src/spec/resolve.ts. */
export const counterText = (counter: CounterSpec, value: CurveFn, t: number, locale: string) => {
  const { text, unit } = formatCounter(value(t), counter.unit, counter.format, locale);
  return `${text} ${unit}`;
};

/** Fixed top-right meter; the same curve usually also drives the camera and the scene's animation. */
export const Counter: React.FC<Props> = ({ counter, value, locale, conceptAt }) => {
  const t = useTime();
  const { rightInset } = useLayout();
  const { fadeIn, dim, label } = counter;
  const hidden = conceptAt !== undefined ? ramp(t, [conceptAt - 0.3, conceptAt]) : 0;
  const opacity = Math.min(ramp(t, fadeIn), dim ? 1 - dim.amount * ramp(t, dim.range) : 1) * (1 - hidden);
  if (opacity <= 0) return null;
  const speed = speedLabel(counter, value, t, locale);

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
        {label}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 76,
          lineHeight: 1.05,
          color: COLOR.you,
          textShadow: TEXT_SHADOW,
        }}
      >
        {counterText(counter, value, t, locale)}
      </div>
      {speed ? (
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: 26,
            letterSpacing: "0.12em",
            marginRight: "-0.12em",
            color: COLOR.secondary,
            textShadow: TEXT_SHADOW,
          }}
        >
          {speed}
        </div>
      ) : null}
    </div>
  );
};
