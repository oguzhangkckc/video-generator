import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  random,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { LayerOf } from "../../../spec/schema";
import { COLOR, GLOW_STOPS } from "../../theme";
import { envelope, ramp, sec, windowAlpha } from "../../time";
import { CAMERA, type GlobeRig } from "./rig";
import { useRig } from "./rig-context";

type Globe = LayerOf<"globe">;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const VERT = `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const RIM_FRAG = `
uniform vec3 color;
uniform float strength;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0) * strength;
  gl_FragColor = vec4(color * f, f);
}`;

const HALO_FRAG = `
uniform vec3 color;
uniform float strength;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = smoothstep(0.0, 0.4, -dot(vN, vV)) * strength;
  gl_FragColor = vec4(color * f, f);
}`;

const additive = {
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
} as const;

/** Screen-space-width circle: stays a crisp line even when the camera brushes past it. */
const makeCircleLine = (widthPx: number, resolution: [number, number]) => {
  const points: number[] = [];
  const segments = 256;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(Math.cos(a), Math.sin(a), 0);
  }
  const geometry = new LineGeometry();
  geometry.setPositions(points);
  const material = new LineMaterial({ color: COLOR.secondary, linewidth: widthPx, ...additive });
  material.resolution.set(resolution[0], resolution[1]);
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  return line;
};

const useTexture = (file: string) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender(`Loading ${file}`));
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    new THREE.TextureLoader().load(
      staticFile(file),
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        setTexture(tex);
      },
      undefined,
      (err) => cancelRender(err),
    );
  }, [file, cancelRender]);

  // Continuing inside the load callback raced the re-render: some stills were captured with a bare planet.
  useEffect(() => {
    if (texture) continueRender(handle);
  }, [texture, handle, continueRender]);

  return texture;
};

const makeGlowTexture = () => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of GLOW_STOPS) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const CameraRig: React.FC<{ t: number; rig: GlobeRig }> = ({ t, rig }) => {
  const camera = useThree((state) => state.camera);
  // Layout effect: runs before ThreeCanvas advances the frame in its passive effect.
  useLayoutEffect(() => {
    const { position, target, up } = rig.cameraAt(t);
    camera.position.copy(position);
    camera.up.copy(up);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }, [camera, t, rig]);
  return null;
};

const Stars: React.FC = () => {
  const geometry = useMemo(() => {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = random(`star-u-${i}`) * 2 - 1;
      const theta = random(`star-t-${i}`) * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions.set([120 * s * Math.cos(theta), 120 * u, 120 * s * Math.sin(theta)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial color={COLOR.star} size={2.2} sizeAttenuation={false} transparent opacity={0.75} depthWrite={false} />
    </points>
  );
};

const Planet: React.FC<{ texture: THREE.Texture | null }> = ({ texture }) => (
  <mesh>
    <sphereGeometry args={[1, 256, 128]} />
    <meshBasicMaterial map={texture} color={texture ? "#ffffff" : COLOR.earthFallback} />
  </mesh>
);

const Atmosphere: React.FC<{ cameraRadius: number }> = ({ cameraRadius }) => {
  const rim = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: RIM_FRAG,
        uniforms: { color: { value: new THREE.Color(COLOR.atmosphereRim) }, strength: { value: 1.1 } },
        ...additive,
      }),
    [],
  );
  const halo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: HALO_FRAG,
        uniforms: { color: { value: new THREE.Color(COLOR.atmosphereHalo) }, strength: { value: 0 } },
        side: THREE.BackSide,
        ...additive,
      }),
    [],
  );
  // Inside the halo shell the back faces would tint the whole frame; fade it out near the surface.
  halo.uniforms.strength.value = 0.9 * ramp(cameraRadius, [1.03, 1.09], [0, 1], Easing.linear);

  return (
    <>
      <mesh material={rim}>
        <sphereGeometry args={[1.004, 128, 64]} />
      </mesh>
      <mesh material={halo}>
        <sphereGeometry args={[1.07, 128, 64]} />
      </mesh>
    </>
  );
};

const Orbits: React.FC<{ t: number; glow: THREE.Texture; orbits: NonNullable<Globe["orbits"]>; hasHero: boolean; rig: GlobeRig }> = ({
  t,
  glow,
  orbits,
  hasHero,
  rig,
}) => {
  const { width, height } = useVideoConfig();
  const alpha = windowAlpha(t, orbits.visible);
  const rings = useMemo(
    () =>
      Array.from({ length: orbits.count }, (_, i) => {
        const line = makeCircleLine(2.5, [width, height]);
        line.scale.setScalar(orbits.radius);
        line.quaternion.setFromUnitVectors(Z_AXIS, rig.orbitNormal(rig.orbitNode(i)));
        return {
          node: rig.orbitNode(i),
          line,
          phase: i === 0 ? 0 : random(`orbit-phase-${i}`) * Math.PI * 2,
        };
      }),
    [width, height, orbits.count, orbits.radius, rig],
  );
  if (alpha <= 0) return null;
  for (const ring of rings) ring.line.material.opacity = 0.6 * alpha;

  return (
    <group>
      {rings.map((ring, i) => (
        <group key={i}>
          <primitive object={ring.line} />
          {Array.from({ length: orbits.satsPerOrbit }, (_, k) =>
            hasHero && i === 0 && k === 0 ? null : (
              <sprite key={k} position={rig.orbitPoint(ring.node, rig.satU(i, k, ring.phase, t))} scale={0.11}>
                <spriteMaterial map={glow} opacity={alpha} {...additive} />
              </sprite>
            ),
          )}
        </group>
      ))}
    </group>
  );
};

const HeroSatellite: React.FC<{ t: number; glow: THREE.Texture; hero: NonNullable<Globe["hero"]>; rig: GlobeRig }> = ({
  t,
  glow,
  hero,
  rig,
}) => {
  if (t > hero.visible.out[1]) return null;
  const position = rig.heroPos(t);
  const up = position.clone().normalize();
  const forward = rig.heroVel(t);
  const side = new THREE.Vector3().crossVectors(up, forward).normalize();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, forward));
  const glowOpacity =
    envelope(t, hero.visible.in, hero.visible.out) * (hero.dim ? 1 - hero.dim.amount * ramp(t, hero.dim.range) : 1);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <boxGeometry args={[0.05, 0.05, 0.07]} />
        <meshStandardMaterial color={COLOR.satelliteBody} metalness={0.6} roughness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.045, 0, 0]}>
            <boxGeometry args={[0.04, 0.004, 0.006]} />
            <meshStandardMaterial color={COLOR.satelliteArm} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[s * 0.13, 0, 0]}>
            <boxGeometry args={[0.13, 0.003, 0.065]} />
            <meshStandardMaterial color={COLOR.satellitePanel} emissive={COLOR.satellitePanelGlow} metalness={0.4} roughness={0.45} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.04, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.022, 0.025, 20, 1, true]} />
        <meshStandardMaterial color={COLOR.satelliteDish} side={THREE.DoubleSide} metalness={0.3} roughness={0.5} />
      </mesh>
      <sprite scale={0.16}>
        <spriteMaterial map={glow} opacity={0.6 * glowOpacity} {...additive} />
      </sprite>
    </group>
  );
};

/** Emission flash above the location at orbit height; any rings are drawn in 2D (signalPass). */
const Flash: React.FC<{ t: number; glow: THREE.Texture; at: number; rig: GlobeRig }> = ({ t, glow, at, rig }) => {
  if (t < at - 0.1 || t > at + 1) return null;
  const flash = envelope(t, [at, at + 0.12], [at + 0.25, at + 0.7]);

  return (
    <group position={rig.anchor("emitter", t)}>
      <sprite scale={0.5 * flash + 0.001}>
        <spriteMaterial map={glow} opacity={flash} {...additive} />
      </sprite>
    </group>
  );
};

const GlobeScene: React.FC<{ layer: Globe; startFrame: number }> = ({ layer, startFrame }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = (frame + startFrame) / fps;
  const rig = useRig(layer.id);
  const texture = useTexture(layer.texture);
  const glow = useMemo(makeGlowTexture, []);
  const cameraRadius = rig.cameraAt(t).position.length();
  // Close to the surface the texture is magnified ~50×; soften it so texels read as haze, not blocks.
  const blur = ramp(cameraRadius - 1, [0.02, 0.15], [14, 0], Easing.linear);
  // Mount the canvas only with the texture in hand, so its own first-frame wait already includes it.
  if (!texture) return <AbsoluteFill style={{ backgroundColor: COLOR.space }} />;

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.space, filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      <ThreeCanvas width={width} height={height} flat gl={{ antialias: true }} camera={CAMERA}>
        <CameraRig t={t} rig={rig} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 2.5, 3]} intensity={2.6} />
        <Stars />
        <Planet texture={texture} />
        <Atmosphere cameraRadius={cameraRadius} />
        {layer.orbits ? <Orbits t={t} glow={glow} orbits={layer.orbits} hasHero={!!layer.hero} rig={rig} /> : null}
        {layer.hero ? <HeroSatellite t={t} glow={glow} hero={layer.hero} rig={rig} /> : null}
        {layer.flash ? <Flash t={t} glow={glow} at={layer.flash.at} rig={rig} /> : null}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/** Planet with optional orbits, hero satellite and emission flash; mounted only inside its window. */
export const Globe: React.FC<{ layer: Globe }> = ({ layer }) => {
  const from = sec(layer.window[0]);
  return (
    <Sequence from={from} durationInFrames={sec(layer.window[1]) - from} premountFor={sec(1)} name={`globe: ${layer.id}`}>
      <GlobeScene layer={layer} startFrame={from} />
    </Sequence>
  );
};
