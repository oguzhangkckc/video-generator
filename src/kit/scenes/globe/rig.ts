import * as THREE from "three";
import type { LayerOf } from "../../../spec/schema";
import type { CurveFn } from "../../curves";
import { HEIGHT, WIDTH } from "../../format";
import { IDENTITY, applyAdjust, type Adjust } from "../../framing";
import { EASING, ramp } from "../../time";

const DEG = Math.PI / 180;
export const NORTH = new THREE.Vector3(0, 1, 0);
export const CAMERA = { fov: 50, near: 0.002, far: 400 } as const;

type Globe = LayerOf<"globe">;
type Shot = Globe["camera"][number];
export type CameraState = { position: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3 };
export type AnchorPoint = "emitter" | "location" | "hero";

/** Matches three.js SphereGeometry UVs for an equirectangular texture. */
export const latLonToVec = (lat: number, lon: number) =>
  new THREE.Vector3(
    Math.cos(lat * DEG) * Math.cos(lon * DEG),
    Math.sin(lat * DEG),
    -Math.cos(lat * DEG) * Math.sin(lon * DEG),
  );

/** Pure camera and orbit maths for one globe layer (Earth radius = 1); shared by the 3D scene and 2D overlays. */
export const createGlobeRig = (layer: Globe, curve: (name: string) => CurveFn) => {
  const { lat, lon } = layer.location;
  const location = latLonToVec(lat, lon);
  const orbits = layer.orbits;
  const orbitR = orbits?.radius ?? 2.3;
  const count = orbits?.count ?? 1;
  const satsPerOrbit = orbits?.satsPerOrbit ?? 1;
  const inclination = (orbits?.inclinationDeg ?? 90) * DEG;
  const satSpeed = (orbits?.speedDegPerSec ?? 0) * DEG;
  const epoch = orbits?.epoch ?? 0;

  // Orbit 0's node is chosen so its first satellite passes exactly over the location at the epoch.
  const uOverhead = Math.asin(Math.sin(lat * DEG) / Math.sin(inclination));
  const nodeOffset = Math.atan2(Math.cos(inclination) * Math.sin(uOverhead), Math.cos(uOverhead));
  const orbitNode = (i: number) => lon * DEG - nodeOffset + (i * 2 * Math.PI) / count;

  /** Position on an inclined circular orbit; ECI (z = north) mapped to scene axes (y = north). */
  const orbitPoint = (node: number, u: number, r = orbitR) => {
    const cO = Math.cos(node);
    const sO = Math.sin(node);
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const ci = Math.cos(inclination);
    const si = Math.sin(inclination);
    const xe = cO * cu - sO * su * ci;
    const ye = sO * cu + cO * su * ci;
    const ze = su * si;
    return new THREE.Vector3(xe, ze, -ye).multiplyScalar(r);
  };

  const orbitNormal = (node: number) => {
    const si = Math.sin(inclination);
    return new THREE.Vector3(Math.sin(node) * si, Math.cos(inclination), Math.cos(node) * si);
  };

  const satU = (orbit: number, slot: number, phase: number, t: number) =>
    phase + (slot * 2 * Math.PI) / satsPerOrbit + satSpeed * (t - epoch) + (orbit === 0 ? uOverhead : 0);

  const heroPos = (t: number) => orbitPoint(orbitNode(0), satU(0, 0, 0, t));
  const heroVel = (t: number) => orbitPoint(orbitNode(0), satU(0, 0, 0, t) + 0.001).sub(heroPos(t)).normalize();

  const pullback = (shot: Extract<Shot, { type: "pullback" }>, t: number): CameraState => {
    const [lo, hi] = shot.progress.logRange;
    const q = (Math.log(Math.max(curve(shot.progress.curve)(t), 1e-4)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
    const { nearRadius: near, wideRadius: wide, knee, overshoot } = shot;
    const r = q <= knee ? 1 + near * Math.pow((wide - 1) / near, q / knee) : wide + (overshoot * (q - knee)) / (1 - knee);
    const sweep = shot.sweep ? ramp(t, shot.sweep.range, [0, 1], EASING.inOutSine) : 0;
    const dir = location.clone().applyAxisAngle(NORTH, (shot.sweep?.angleRad ?? 0) * sweep);
    const position = dir.multiplyScalar(r);
    const target = NORTH.clone().multiplyScalar((shot.sweep?.lift ?? 0) * r * sweep);
    return { position, target, up: NORTH.clone() };
  };

  const follow = (shot: Extract<Shot, { type: "follow" }>, t: number): CameraState => {
    const s = heroPos(t);
    const sHat = s.clone().normalize();
    const v = heroVel(t);
    const n = new THREE.Vector3().crossVectors(sHat, v).normalize();
    const a = shot.circleSpeed * (t - shot.from);
    const back = v.clone().multiplyScalar(-Math.cos(a)).addScaledVector(n, Math.sin(a));
    // Radial "up" keeps the target on the vertical centre line.
    return {
      position: s.clone().addScaledVector(sHat, shot.lift).addScaledVector(back, shot.back),
      target: s.clone().addScaledVector(sHat, -shot.aimBelow),
      up: sHat,
    };
  };

  const descend = (shot: Extract<Shot, { type: "descend" }>, t: number, start: CameraState): CameraState => {
    const e = ramp(t, [shot.from, shot.alignUntil], [0, 1], EASING.inOutCubic);
    const radial = location.dot(start.position);
    const lateral = start.position.clone().addScaledVector(location, -radial).multiplyScalar(1 - e);
    const r = 1 + (orbitR - 1) * Math.sqrt(curve(shot.curve)(t) / shot.curveTop) + (radial - orbitR) * (1 - e);
    const aim = ramp(t, [shot.from, shot.aimUntil], [0, 1], EASING.inOutCubic);
    return {
      position: location.clone().multiplyScalar(r).add(lateral),
      target: start.target.clone().lerp(location, aim),
      // Looking straight down, a radial "up" would be degenerate; settle on north.
      up: start.up.clone().lerp(NORTH, aim).normalize(),
    };
  };

  const shots = layer.camera;

  /** A shot on its own, without blending; "descend" starts from wherever the previous shot is at its start. */
  const shotState = (i: number, t: number): CameraState => {
    const shot = shots[i];
    if (shot.type === "pullback") return pullback(shot, t);
    if (shot.type === "follow") return follow(shot, t);
    if (i === 0) throw new Error(`globe "${layer.id}": a "descend" shot cannot be the first shot`);
    return descend(shot, t, shotState(i - 1, shot.from));
  };

  const cameraAt = (t: number): CameraState => {
    let i = 0;
    while (i + 1 < shots.length && shots[i + 1].from <= t) i++;
    const shot = shots[i];
    const blend = shot.type === "follow" ? shot.blendIn : undefined;
    if (i === 0 || !blend || t >= blend[1]) return shotState(i, t);
    const a = shotState(i - 1, t);
    if (t <= blend[0]) return a;
    const b = shotState(i, t);
    const w = ramp(t, blend, [0, 1], EASING.inOutCubic);
    return {
      position: a.position.lerp(b.position, w),
      target: a.target.lerp(b.target, w),
      up: a.up.lerp(b.up, w).normalize(),
    };
  };

  const anchor = (point: AnchorPoint, t: number) =>
    point === "hero" ? heroPos(t) : point === "emitter" ? location.clone().multiplyScalar(orbitR) : location.clone();

  const projector = new THREE.PerspectiveCamera(CAMERA.fov, WIDTH / HEIGHT, CAMERA.near, CAMERA.far);

  /** Screen position (px) of a 3D point as the written camera sees it at time t, before any framing move. */
  const rawProject = (point: THREE.Vector3, t: number) => {
    const { position, target, up } = cameraAt(t);
    projector.position.copy(position);
    projector.up.copy(up);
    projector.lookAt(target);
    projector.updateMatrixWorld();
    const ndc = point.clone().project(projector);
    // A point behind the camera still projects, mirrored, onto the screen.
    const behind = point.clone().applyMatrix4(projector.matrixWorldInverse).z > 0;
    return { x: ((ndc.x + 1) / 2) * WIDTH, y: ((1 - ndc.y) / 2) * HEIGHT, behind };
  };

  // The framing move (src/kit/framing.ts), a lens shift around the frame centre; set once the overlays are known.
  let adjustAt: (t: number) => Adjust = () => IDENTITY;
  const setFraming = (f: (t: number) => Adjust) => {
    adjustAt = f;
  };

  /** Screen position (px) of a 3D point at time t, framing move included — lets 2D overlays track 3D objects. */
  const project = (point: THREE.Vector3, t: number) => {
    const p = rawProject(point, t);
    const [x, y] = applyAdjust([p.x, p.y], [WIDTH / 2, HEIGHT / 2], adjustAt(t));
    return { x, y, behind: p.behind };
  };

  return {
    location,
    orbitR,
    orbitNode,
    orbitPoint,
    orbitNormal,
    satU,
    heroPos,
    heroVel,
    cameraAt,
    anchor,
    project,
    rawProject,
    adjustAt: (t: number) => adjustAt(t),
    setFraming,
  };
};

export type GlobeRig = ReturnType<typeof createGlobeRig>;
