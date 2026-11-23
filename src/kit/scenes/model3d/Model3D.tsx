import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useLayoutEffect, useState } from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LayerOf } from "../../../spec/schema";
import { HEIGHT, WIDTH } from "../../format";
import { IDENTITY, pointBox, useFraming, type SceneElement, type SceneReport } from "../../framing";
import { COLOR, tokenColor } from "../../theme";
import { EASING, envelope, ramp, sec, windowAlpha } from "../../time";

type Model3DLayer = LayerOf<"model3d">;
type Part = { object: THREE.Object3D; center: THREE.Vector3; rest: THREE.Vector3; materials: THREE.MeshStandardMaterial[] };
type Model = { root: THREE.Group; parts: Map<string, Part>; materials: THREE.MeshStandardMaterial[]; radius: number };

const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/** Centre the scene, scale it to radius 1, give every mesh its own material so parts can be lit separately. */
const prepare = (scene: THREE.Object3D): Model => {
  const sphere = new THREE.Box3().setFromObject(scene).getBoundingSphere(new THREE.Sphere());
  scene.position.sub(sphere.center);
  const root = new THREE.Group();
  root.add(scene);
  root.scale.setScalar(1 / sphere.radius);
  root.updateMatrixWorld(true);

  const materials: THREE.MeshStandardMaterial[] = [];
  const own = (mesh: THREE.Mesh) => {
    const list = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
      const copy = m.clone() as THREE.MeshStandardMaterial;
      copy.side = THREE.DoubleSide;
      copy.userData.baseColor = copy.color?.clone();
      materials.push(copy);
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? list : list[0];
    return list;
  };

  const parts = new Map<string, Part>();
  scene.traverse((object) => {
    if (!object.name || parts.has(object.name)) return;
    const meshes: THREE.Mesh[] = [];
    object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    if (meshes.length === 0 || object === scene) return;
    const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    root.worldToLocal(center);
    parts.set(object.name, { object, center, rest: object.position.clone(), materials: [] });
  });
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const list = own(o as THREE.Mesh);
    let p: THREE.Object3D | null = o;
    while (p && p !== scene) {
      parts.get(p.name)?.materials.push(...list);
      p = p.parent;
    }
  });
  return { root, parts, materials, radius: sphere.radius };
};

const useModel = (file: string) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading ${file}`));
  const [model, setModel] = useState<Model | null>(null);

  useEffect(() => {
    new GLTFLoader().load(staticFile(file), (gltf) => setModel(prepare(gltf.scene)), undefined, (err) => cancelRender(err));
  }, [file, cancelRender]);

  // Same reason as Globe's texture: continuing inside the load callback raced the re-render.
  useEffect(() => {
    if (model) continueRender(handle);
  }, [model, handle, continueRender]);

  return model;
};

const Environment: React.FC = () => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    gl.localClippingEnabled = true;
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
};

/** Camera position, look-at point and field of view at t, from the keyframes and the slow orbit. */
const cameraAt = (layer: Model3DLayer, model: Model, t: number) => {
  const shots = layer.camera;
  const next = shots.findIndex((s) => s.at > t);
  const a = next <= 0 ? shots[next === 0 ? 0 : shots.length - 1] : shots[next - 1];
  const b = next <= 0 ? a : shots[next];
  const p = a === b ? 0 : ramp(t, [a.at, b.at], [0, 1], EASING[b.easing]);
  const lerp = (x: number, y: number) => x + (y - x) * p;
  const point = (target: (typeof a)["target"]) =>
    target === undefined
      ? new THREE.Vector3()
      : typeof target === "string"
        ? (model.parts.get(target)?.center.clone() ?? new THREE.Vector3())
        : new THREE.Vector3(...target);
  const target = point(a.target).lerp(point(b.target), p);
  const az = THREE.MathUtils.degToRad(lerp(a.azimuth, b.azimuth) + layer.orbitDegPerSec * t);
  const el = THREE.MathUtils.degToRad(lerp(a.elevation, b.elevation));
  const distance = Math.exp(lerp(Math.log(a.distance), Math.log(b.distance)));
  const position = new THREE.Vector3(
    target.x + distance * Math.cos(el) * Math.sin(az),
    target.y + distance * Math.sin(el),
    target.z + distance * Math.cos(el) * Math.cos(az),
  );
  return { position, target, fov: lerp(a.fov, b.fov), shot: p < 0.5 ? a : b };
};

/** qa: the whole model is the subject; highlighted parts and the part the camera aims at are what matter. */
const report = (layer: Model3DLayer, model: Model, t: number, name: string): SceneReport => {
  const { position, target, fov, shot } = cameraAt(layer, model, t);
  const camera = new THREE.PerspectiveCamera(fov, WIDTH / HEIGHT, 0.01, 100);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const toScreen = (v: THREE.Vector3): [number, number] => {
    const ndc = v.clone().applyMatrix4(model.root.matrixWorld).project(camera);
    return [((ndc.x + 1) / 2) * WIDTH, ((1 - ndc.y) / 2) * HEIGHT];
  };
  const center = toScreen(new THREE.Vector3());
  const distance = position.length();
  const radius = ((HEIGHT / 2) * Math.tan(Math.asin(Math.min(1, model.radius / distance)))) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const elements: SceneElement[] = [...model.parts].map(([id, part]) => ({
    id,
    kind: "part",
    ...pointBox(toScreen(part.center), 40),
    important: shot.target === id || layer.highlight.some((h) => h.part === id && t >= h.range[0] && t <= h.range[1]),
    say: [],
  }));
  const kind = distance > 2.5 * model.radius ? "wide" : distance > 1.2 * model.radius ? "medium" : "close";
  return { layer: name, type: "model3d", opacity: windowAlpha(t, layer.fade), shot: { kind }, subject: pointBox(center, radius), elements, adjust: IDENTITY };
};

/** Applies camera, highlights, section and explode for time t; a layout effect so it lands before the frame. */
const Rig: React.FC<{ layer: Model3DLayer; model: Model; t: number }> = ({ layer, model, t }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  useLayoutEffect(() => {
    const { position, target, fov } = cameraAt(layer, model, t);
    camera.position.copy(position);
    camera.fov = fov;
    camera.near = 0.01;
    camera.far = 100;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    camera.updateMatrixWorld();

    const level = new Map<string, number>();
    for (const h of layer.highlight) {
      const v = envelope(t, [h.range[0], h.range[0] + 0.3], [Math.max(h.range[0] + 0.3, h.range[1] - 0.3), h.range[1]]);
      level.set(h.part, Math.max(level.get(h.part) ?? 0, v));
    }
    const anyLit = Math.max(0, ...level.values());
    for (const m of model.materials) {
      m.color?.copy(m.userData.baseColor).multiplyScalar(1 - layer.dimOthers * anyLit);
      m.emissive?.setRGB(0, 0, 0);
    }
    for (const h of layer.highlight) {
      const v = level.get(h.part) ?? 0;
      const glow = new THREE.Color(tokenColor(h.color));
      for (const m of model.parts.get(h.part)?.materials ?? []) {
        m.color?.copy(m.userData.baseColor).multiplyScalar(1 - layer.dimOthers * Math.max(0, anyLit - v));
        m.emissive?.copy(glow).multiplyScalar(0.6 * v);
      }
    }

    const planes = layer.section
      ? [
          new THREE.Plane(
            AXIS[layer.section.axis].clone().negate(),
            // Model radius is 1, so fraction f puts the plane at -1 + 2f along the axis; 1 cuts nothing.
            -1 + 2 * (layer.section.from + (layer.section.to - layer.section.from) * ramp(t, layer.section.range)) + 0.01,
          ),
        ]
      : [];
    for (const m of model.materials) m.clippingPlanes = planes;

    if (layer.explode) {
      const e = ramp(t, layer.explode.range, [0, 1], EASING.inOutCubic);
      for (const [name, part] of model.parts) {
        if (layer.explode.parts && !layer.explode.parts.includes(name)) continue;
        const dir = part.center.lengthSq() > 1e-6 ? part.center.clone().normalize() : new THREE.Vector3(0, 1, 0);
        part.object.position.copy(part.rest).addScaledVector(dir, layer.explode.distance * model.radius * e);
      }
    }
  }, [camera, layer, model, t]);

  return null;
};

const Scene: React.FC<{ layer: Model3DLayer; startFrame: number; name: string }> = ({ layer, startFrame, name }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = (frame + startFrame) / fps;
  const model = useModel(layer.file);
  const { reports } = useFraming();
  const opacity = windowAlpha(t, layer.fade);
  const background = `linear-gradient(180deg, ${COLOR.bgTop} 0%, ${COLOR.bgBottom} 100%)`;
  if (!model) return <AbsoluteFill style={{ background, opacity }} />;
  if (reports) reports.set(name, report(layer, model, t, name));

  return (
    <AbsoluteFill style={{ background, opacity }}>
      <ThreeCanvas width={width} height={height} gl={{ antialias: true, alpha: true }} camera={{ fov: 35, near: 0.01, far: 100 }}>
        <Environment />
        <Rig layer={layer} model={model} t={t} />
        <ambientLight intensity={0.35} color={COLOR.light} />
        <directionalLight position={[3, 4, 5]} intensity={1.8} color={COLOR.light} />
        <directionalLight position={[-4, 2, -3]} intensity={0.9} color={COLOR.light} />
        <primitive object={model.root} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/** GLB model with keyframed camera, part highlights, cut-away and exploded view; mounted only inside its window. */
export const Model3D: React.FC<{ layer: Model3DLayer; name: string }> = ({ layer, name }) => {
  const from = sec(layer.window[0]);
  return (
    <Sequence from={from} durationInFrames={sec(layer.window[1]) - from} premountFor={sec(1)} name={`model3d: ${layer.file}`}>
      <Scene layer={layer} startFrame={from} name={name} />
    </Sequence>
  );
};
