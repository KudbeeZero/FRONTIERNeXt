/**
 * GlobeSpaceProps — ambient space scenery around the FRONTIER globe.
 *
 * Additive, decorative background only — does NOT touch parcels, combat, data,
 * or camera. Three billboarded image sprites (transparent PNG cutouts in
 * /public/textures/space/):
 *   • Moon     — large background body with a soft additive "fog" halo.
 *   • Asteroid — drifting background rock.
 *   • Station  — slowly orbits the Earth at low altitude.
 *
 * Sized/placed for the existing camera (fov 45, far 200, zoom 3.6–12) so they
 * read as background and are never collided with by OrbitControls. Mounted under
 * a <Suspense> in PlanetGlobe so a missing texture can't break the scene.
 */
import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";

const TEX = {
  moon: "/textures/space/moon.png",
  station: "/textures/space/station.png",
  asteroid: "/textures/space/asteroid.png",
} as const;

function useSpaceTexture(url: string): THREE.Texture {
  const tex = useLoader(THREE.TextureLoader, url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft radial glow / "fog" plane (additive, billboarded with its parent). */
function GlowHalo({ size, color, strength = 0.55 }: { size: number; color: THREE.Color; strength?: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: color }, uStrength: { value: strength } },
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform vec3 uColor;
          uniform float uStrength;
          void main() {
            float d = distance(vUv, vec2(0.5));
            float a = smoothstep(0.5, 0.0, d);   // 1 at center, 0 at rim
            a = pow(a, 2.2) * uStrength;
            gl_FragColor = vec4(uColor, a);
          }
        `,
      }),
    [color, strength],
  );
  return (
    <mesh material={material} renderOrder={-12}>
      <planeGeometry args={[size, size]} />
    </mesh>
  );
}

function Moon() {
  const tex = useSpaceTexture(TEX.moon);
  return (
    <Billboard position={[13, 8, -22]}>
      {/* fog/glow behind the moon */}
      <GlowHalo size={20} color={new THREE.Color(0.55, 0.7, 1.0)} strength={0.5} />
      <mesh renderOrder={-10}>
        <planeGeometry args={[12, 12]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function Asteroid() {
  const tex = useSpaceTexture(TEX.asteroid);
  // station.png cutout is square-ish; keep 1:1.
  return (
    <Billboard position={[-13, -5.5, -15]}>
      <mesh renderOrder={-10}>
        <planeGeometry args={[3, 3]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function Station() {
  const tex = useSpaceTexture(TEX.station);
  const ref = useRef<THREE.Group>(null!);
  const R = GLOBE_RADIUS + 1.35; // low orbit, clearly above the surface
  const tilt = 0.55; // radians — tilt the orbit plane so it reads as orbiting
  const aspect = 1382 / 708; // station cutout aspect ratio
  const wide = 1.5;
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.1; // slow orbit
    if (ref.current) {
      ref.current.position.set(
        Math.cos(t) * R,
        Math.sin(t) * R * Math.sin(tilt),
        Math.sin(t) * R * Math.cos(tilt),
      );
    }
  });
  return (
    <group ref={ref}>
      <Billboard>
        <mesh>
          <planeGeometry args={[wide, wide / aspect]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

/** Mount-all: ambient space scenery (moon + fog, asteroid, orbiting station). */
export function GlobeSpaceProps() {
  return (
    <>
      <Moon />
      <Asteroid />
      <Station />
    </>
  );
}
