// Fixed by STYLE.md: every video is 9:16, 1080×1920, 30 fps.
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const CX = WIDTH / 2;
export const CY = HEIGHT / 2;

export type NumberFormat = { zeroBelow: number; oneDecimalBelow: number };

/** Time units step up by themselves so a counter never shows "5.340 ms": 1000 ms and over reads "5,34 sn". */
export const formatCounter = (value: number, unit: string, format: NumberFormat, locale = "tr-TR") =>
  unit === "ms" && value >= 1000
    ? { text: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 1000), unit: "sn" }
    : { text: formatValue(value, format, locale), unit };

/** 1, 2, 2.5 or 5 × 10^n: speed factors a viewer can read at a glance. */
export const niceFactor = (x: number) => {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.75 ? 2.5 : m < 7.5 ? 5 : 10) * p;
};

export const formatValue = (value: number, format: NumberFormat, locale = "tr-TR"): string => {
  if (value < format.zeroBelow) return "0";
  const digits = value < format.oneDecimalBelow ? 1 : 0;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
};
