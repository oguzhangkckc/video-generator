import { createContext, useContext } from "react";
import { COLOR } from "./theme.ts";

/** qa paints every ground (gradient, bare space, haze) in this key colour, to tell ground from a flat filled shape. */
export const GROUND_KEY = [255, 0, 255] as const;

export type Ground = { top: string; bottom: string; space: string; keyed: boolean };

const KEY = `rgb(${GROUND_KEY.join(",")})`;

export const groundOf = (keyed: boolean): Ground =>
  keyed ? { top: KEY, bottom: KEY, space: KEY, keyed } : { top: COLOR.bgTop, bottom: COLOR.bgBottom, space: COLOR.space, keyed };

export const GroundContext = createContext(false);
export const useGround = (): Ground => groundOf(useContext(GroundContext));
export const groundGradient = (g: Ground) => `linear-gradient(180deg, ${g.top} 0%, ${g.bottom} 100%)`;
