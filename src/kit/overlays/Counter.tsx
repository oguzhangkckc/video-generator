import type { Spec } from "../../spec/schema";
import type { CurveFn } from "../curves";
import { formatValue } from "../format";
import { COLOR, MONO, TEXT_SHADOW } from "../theme";
import { ramp, useTime } from "../time";

type Props = { counter: NonNullable<Spec["counter"]>; value: CurveFn; locale: string };

/** Fixed top-right meter; the same curve usually also drives the camera and the map zoom. */
export const Counter: React.FC<Props> = ({ counter, value, locale }) => {
  const t = useTime();
  const { fadeIn, dim, label, unit, format } = counter;
  const opacity = Math.min(ramp(t, fadeIn), dim ? 1 - dim.amount * ramp(t, dim.range) : 1);

  return (
    <div style={{ position: "absolute", top: 150, right: 72, textAlign: "right", opacity }}>
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
        {formatValue(value(t), format, locale)} {unit}
      </div>
    </div>
  );
};
