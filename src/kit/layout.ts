import { createContext, useContext } from "react";
import { HEIGHT, WIDTH } from "./format";

/** STYLE.md safe areas: the platform UI covers the bottom 15 % and the right 120 px. */
export const SAFE = { right: WIDTH - 120, bottom: Math.round(HEIGHT * 0.85) } as const;

/**
 * Where overlays may sit. Centred text is fitted into `contentWidth` around the middle (840 → x 120–960, clear of
 * the right safe area); right-aligned text keeps `rightInset` px from the edge.
 */
export type Layout = { rightInset: number; contentWidth: number; labelBackdrop: boolean; framing: boolean };

export const LayoutContext = createContext<Layout>({ rightInset: 132, contentWidth: 840, labelBackdrop: true, framing: false });
export const useLayout = () => useContext(LayoutContext);
