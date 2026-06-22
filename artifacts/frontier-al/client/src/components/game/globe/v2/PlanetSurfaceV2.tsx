/**
 * PlanetSurfaceV2 — ONE shader, ONE terminator.
 *
 * The old surface was an unlit, full-bright albedo (lights touched nothing) sitting
 * under an additive purple corona — that combination read as the "magenta wash".
 * v2 uses a single shader that blends the day albedo into the night-lights texture
 * across the shared world-space terminator. No additive purple, no second darkening.
 */

import * as THREE from "three";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { TERMINATOR_SOFTNESS } from "./sunModelV2";

const DAY_TEX = "/textures/planets/ascendancy/planet_albedo.png";
const NIGHT_TEX = "/textures/planets/ascendancy/planet_night_lights.png";

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3  uSunDir;
  uniform float uExposure;
  uniform float uNightBoost;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  vec3 boostSat(vec3 c, float amount) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(lum), c, amount);
  }

  void main() {
    vec3 day   = boostSat(texture2D(dayMap, vUv).rgb, 1.4) * uExposure;
    vec3 night = texture2D(nightMap, vUv).rgb * uNightBoost;

    // ONE terminator: smoothstep over dot(worldNormal, sunDir). Mirrors the JS
    // dayFactor() in sunModelV2 and the GPU terminator in PlotTilesV2.
    float f = smoothstep(-${TERMINATOR_SOFTNESS.toFixed(3)}, ${TERMINATOR_SOFTNESS.toFixed(3)}, dot(normalize(vWorldNormal), uSunDir));

    vec3 col = mix(night, day, f);
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface PlanetSurfaceV2Props {
  sunDirRef: MutableRefObject<THREE.Vector3>;
  /** Day-side brightness. Real lighting now does the work — no ×2.6 unlit hack. */
  exposure?: number;
  /** City-light emissive strength on the night side. */
  nightBoost?: number;
}

export function PlanetSurfaceV2({ sunDirRef, exposure = 1.35, nightBoost = 1.6 }: PlanetSurfaceV2Props) {
  const [dayTex, nightTex] = useLoader(THREE.TextureLoader, [DAY_TEX, NIGHT_TEX]);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  useEffect(() => {
    if (dayTex) dayTex.colorSpace = THREE.SRGBColorSpace;
    if (nightTex) nightTex.colorSpace = THREE.SRGBColorSpace;
  }, [dayTex, nightTex]);

  const uniforms = useMemo(
    () => ({
      dayMap: { value: dayTex },
      nightMap: { value: nightTex },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uExposure: { value: exposure },
      uNightBoost: { value: nightBoost },
    }),
    // textures are stable after first load; exposure/nightBoost handled below
    [dayTex, nightTex], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uSunDir.value.copy(sunDirRef.current);
    matRef.current.uniforms.uExposure.value = exposure;
    matRef.current.uniforms.uNightBoost.value = nightBoost;
  });

  return (
    <mesh renderOrder={0}>
      <sphereGeometry args={[GLOBE_RADIUS, 128, 64]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
      />
    </mesh>
  );
}
