import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// latin-ext carries the Turkish letters (İ, ı, Ş, ş, Ğ, ğ).
export const SANS = loadInter("normal", {
  weights: ["600", "800"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

export const MONO = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

/** Meaning first (see STYLE.md): you = the viewer's own data, danger = errors, secondary = orbits/side info. */
export const COLOR = {
  text: "#FFFFFF",
  you: "#FFB547",
  danger: "#FF4D4D",
  secondary: "#3FD8E6",
  marker: "#4DA3FF",
  muted: "rgba(255,255,255,0.6)",
  note: "rgba(63,216,230,0.75)",
  upcoming: "rgba(255,255,255,0.38)",
  counterLabel: "rgba(255,255,255,0.85)",

  bgTop: "#050B1A",
  bgBottom: "#0A1630",
  space: "#02050D",

  streetLight: "#FFD08A",
  street: "#1E3A6B",
  water: "#02060F",

  atmosphereRim: "#6cc0ff",
  atmosphereHalo: "#3d8bff",
  star: "#cfe3ff",
  earthFallback: "#070d1c",
  satelliteBody: "#d8b45a",
  satelliteArm: "#9aa4b5",
  satellitePanel: "#1f3f9a",
  satellitePanelGlow: "#0b1d4d",
  satelliteDish: "#e8e8e8",

  /** flow regions and paths: a solid body (organ, device) and a faint enclosing outline (body, building). */
  surface: "#111A38",
  surfaceEdge: "rgba(255,255,255,0.55)",
  faint: "rgba(255,255,255,0.035)",
  faintEdge: "rgba(255,255,255,0.3)",
  /** flow "pad" nodes (sensors, electrodes, ports). */
  pad: "#C9D3E6",
  gridMinor: "rgba(63,216,230,0.08)",
  gridMajor: "rgba(63,216,230,0.2)",
  light: "#FFFFFF",
} as const;

/** Fills and strokes a flow diagram may name, besides the semantic colour tokens. */
export const SURFACE = { surface: COLOR.surface, faint: COLOR.faint } as const;
export const EDGE = { surface: COLOR.surfaceEdge, faint: COLOR.faintEdge } as const;

export type ColorToken = "text" | "you" | "danger" | "secondary" | "marker" | "muted";
export const tokenColor = (token: ColorToken): string => COLOR[token];

/** Radial glow sprite used for satellites and the emission flash. */
export const GLOW_STOPS: [number, string][] = [
  [0, "rgba(255,255,255,1)"],
  [0.18, "rgba(210,248,255,0.9)"],
  [0.45, "rgba(63,216,230,0.35)"],
  [1, "rgba(63,216,230,0)"],
];

/** Atmosphere haze gradient: [r, g, b, peak alpha] at 0 %, 45 %, 100 %. */
export const HAZE_STOPS: [number, number, number, number][] = [
  [120, 190, 255, 0.5],
  [60, 120, 220, 0.42],
  [20, 50, 120, 0.55],
];

export const TEXT_SHADOW = "0 2px 14px rgba(0,0,0,0.65)";
