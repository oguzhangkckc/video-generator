// When the globe's hero satellite is on screen. The renderer (Globe.tsx) and the scene report qa reads both ask this,
// so qa measures the satellite whenever it is drawn. Pure, so the Node tests import it.

/**
 * The model is drawn from the globe's start until its fade-out ends; only its glow follows `visible.in` (a satellite
 * already in the sky before it is "shown").
 */
export const heroDrawn = (visible: { out: readonly [number, number] }, t: number) => t <= visible.out[1];
