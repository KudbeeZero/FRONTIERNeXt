/**
 * AtmosphereV2 — ONE blue/cyan fresnel rim, sun-modulated. Never purple.
 *
 * The REBUILD_NOTES magenta culprit was an additive purple-indigo corona
 * (Color(0.16, 0.08, 0.6)) amplified by ACES tone mapping. v2 replaces it with a
 * single back-side fresnel shell tinted blue→cyan, brightest on the lit limb. The
 * colour ramp contains no red channel to speak of, so a magenta tint is impossible.
 */

import * as THREE from "three";
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";

const ATMO_RADIUS = GLOBE_RADIUS * 1.025;

const VERT = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3  uSunDir;
  uniform float uStrength;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    // Back-side shell: the rim is where the (flipped) normal grazes the view.
    float fres = pow(1.0 - max(dot(vWorldNormal, vViewDir), 0.0), 3.0);
    float lit  = smoothstep(-0.35, 0.45, dot(vWorldNormal, uSunDir));
    vec3  cool = vec3(0.02, 0.18, 0.45); // deep blue (shadowed limb)
    vec3  warm = vec3(0.25, 0.75, 1.0);  // bright cyan (sunlit limb)
    vec3  rim  = mix(cool, warm, lit) * fres * uStrength;
    gl_FragColor = vec4(rim, fres);
  }
`;

interface AtmosphereV2Props {
  sunDirRef: MutableRefObject<THREE.Vector3>;
  strength?: number;
}

export function AtmosphereV2({ sunDirRef, strength = 1.0 }: AtmosphereV2Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const uniforms = useMemo(
    () => ({
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uStrength: { value: strength },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uSunDir.value.copy(sunDirRef.current);
    matRef.current.uniforms.uStrength.value = strength;
  });

  return (
    <mesh renderOrder={2}>
      <sphereGeometry args={[ATMO_RADIUS, 64, 32]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
