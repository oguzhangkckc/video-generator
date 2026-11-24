import type * as THREE from "three";
import { HEIGHT, WIDTH } from "./format";
import type { Adjust } from "./framing";

/**
 * A 3D scene's framing move (src/kit/framing.ts) as a lens shift around the frame centre: the frame stays full while
 * the picture moves (p' = c + s·(p − c) + d).
 */
export const applyLensShift = (camera: THREE.PerspectiveCamera, { dx, dy, s }: Adjust) => {
  if (dx === 0 && dy === 0 && s === 1) camera.clearViewOffset();
  else camera.setViewOffset(WIDTH, HEIGHT, ((WIDTH / 2) * (s - 1) - dx) / s, ((HEIGHT / 2) * (s - 1) - dy) / s, WIDTH / s, HEIGHT / s);
};
