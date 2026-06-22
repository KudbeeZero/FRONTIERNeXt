import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";

/** Planet surface — albedo texture with boosted saturation shader. */
export function GlobeTerrain() {
  const albedoTex = useLoader(THREE.TextureLoader, "/textures/planets/ascendancy/planet_albedo.png");

  useEffect(() => {
    if (albedoTex) albedoTex.colorSpace = THREE.SRGBColorSpace;
  }, [albedoTex]);

  const terrainUniforms = useMemo(() => ({
    albedoMap: { value: albedoTex },
  }), [albedoTex]);

  const terrainVert = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const terrainFrag = `
    uniform sampler2D albedoMap;
    varying vec2 vUv;

    // Boost colour saturation (renamed to avoid clash with GLSL built-in 'saturate')
    vec3 boostSat(vec3 c, float amount) {
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(lum), c, amount);
    }

    void main() {
      vec4 dayCol = texture2D(albedoMap, vUv);
      // Brightness tuning: saturation boost x1.5, exposure x2.0 (was 1.4), plus a
      // small ambient floor so dark texels never read as pure black. Bump EXPOSURE
      // or FLOOR if the globe is still too dark; lower them if it blows out.
      float EXPOSURE = 2.0;
      float FLOOR = 0.50;
      vec3 boosted = boostSat(dayCol.rgb, 1.5) * EXPOSURE + FLOOR;
      gl_FragColor = vec4(min(boosted, vec3(1.0)), 1.0);
    }
  `;

  return (
    <mesh renderOrder={0}>
      <sphereGeometry args={[GLOBE_RADIUS, 128, 64]} />
      <shaderMaterial
        uniforms={terrainUniforms}
        vertexShader={terrainVert}
        fragmentShader={terrainFrag}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
}
