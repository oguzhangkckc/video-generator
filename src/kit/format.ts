// Fixed by STYLE.md: every video is 9:16, 1080×1920, 30 fps.
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const CX = WIDTH / 2;
export const CY = HEIGHT / 2;

export type NumberFormat = { zeroBelow: number; oneDecimalBelow: number };

export const formatValue = (value: number, format: NumberFormat, locale = "tr-TR"): string => {
  if (value < format.zeroBelow) return "0";
  const digits = value < format.oneDecimalBelow ? 1 : 0;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
};
