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
import { SUN_GLSL } from "./sunModelV2";

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
  uniform float uToneExposure;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  // Shared terminator (single source of truth) — defines dayFactorV2(n, sunDir).
  ${SUN_GLSL}

  vec3 boostSat(vec3 c, float amount) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(lum), c, amount);
  }

  // A raw ShaderMaterial is NOT auto-tone-mapped or sRGB-encoded by three (only
  // built-in materials run <tonemapping_fragment>/<colorspace_fragment>). Inline
  // three's EXACT ACES fit + linear->sRGB so this surface matches the PlotTilesV2
  // tiles (MeshBasicMaterial) sitting on it, instead of reading dark/raw-linear.
  vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 acesToneMap(vec3 color) {
    const mat3 ACESInputMat = mat3(
      0.59719, 0.07600, 0.02840,
      0.35458, 0.90834, 0.13383,
      0.04823, 0.01566, 0.83777);
    const mat3 ACESOutputMat = mat3(
       1.60475, -0.10208, -0.00327,
      -0.53108,  1.10813, -0.07276,
      -0.07367, -0.00605,  1.07602);
    color *= uToneExposure / 0.6;
    color = ACESInputMat * color;
    color = RRTAndODTFit(color);
    color = ACESOutputMat * color;
    return clamp(color, 0.0, 1.0);
  }
  vec3 linearToSRGB(vec3 v) {
    return mix(pow(v, vec3(0.41666)) * 1.055 - vec3(0.055), v * 12.92,
               vec3(lessThanEqual(v, vec3(0.0031308))));
  }

  void main() {
    // dayMap/nightMap are tagged SRGBColorSpace, so the GPU returns LINEAR samples.
    vec3 day   = boostSat(texture2D(dayMap, vUv).rgb, 1.4) * uExposure;
    vec3 night = texture2D(nightMap, vUv).rgb * uNightBoost;

    // ONE terminator, shared with PlotTilesV2 + the JS dayFactor() via SUN_GLSL.
    float f = dayFactorV2(vWorldNormal, uSunDir);

    vec3 col = mix(night, day, f);            // blend in linear space
    col = linearToSRGB(acesToneMap(col));     // then match the Canvas pipeline
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
      uToneExposure: { value: 1.15 }, // must match Canvas gl.toneMappingExposure
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
