/**
 * PlotTilesV2 — all plots as ONE InstancedMesh, terminator applied on the GPU.
 *
 * The old tiles were unlit meshBasicMaterial with depthTest:false stacked across
 * several nested radii, so they composited regardless of depth and compounded the
 * wash. v2 draws a single solid tangent quad per plot with normal depth testing and
 * darkens the night side in the vertex shader (via onBeforeCompile) using the shared
 * world-space sun — no purple, no stacking, no double-darkening.
 */

import * as THREE from "three";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { LandParcel } from "@shared/schema";
import { GLOBE_RADIUS, FILL_SIZE } from "@/lib/globe/globeConstants";
import { tangentFrame } from "@/lib/globe/globeUtils";
import { TERMINATOR_SOFTNESS } from "./sunModelV2";
import type { PlanetDataV2 } from "./planetDataV2";

const TILE_LIFT = 1.004; // sit just proud of the surface so tiles never z-fight
const NIGHT_DIM = 0.18; // how dark the night side of a tile gets

interface PlotTilesV2Props {
  data: PlanetDataV2;
  sunDirRef: MutableRefObject<THREE.Vector3>;
  parcels: LandParcel[];
  onParcelSelect?: (parcelId: string) => void;
}

export function PlotTilesV2({ data, sunDirRef, parcels, onParcelSelect }: PlotTilesV2Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const sunUniform = useRef({ value: new THREE.Vector3(1, 0, 0) });

  const geometry = useMemo(() => new THREE.PlaneGeometry(FILL_SIZE, FILL_SIZE), []);

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ toneMapped: true });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDir = sunUniform.current;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>\nuniform vec3 uSunDir;\nvarying float vDay;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vec3 wCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
           vDay = smoothstep(-${TERMINATOR_SOFTNESS.toFixed(3)}, ${TERMINATOR_SOFTNESS.toFixed(3)}, dot(normalize(wCenter), uSunDir));`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nvarying float vDay;`)
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>\n gl_FragColor.rgb *= mix(${NIGHT_DIM.toFixed(2)}, 1.0, vDay);`,
        );
    };
    return mat;
  }, []);

  // Resolve plotId → parcel.id for click selection.
  const plotIdToParcelId = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of parcels) m.set(p.plotId, p.id);
    return m;
  }, [parcels]);

  // Lay out instance matrices + colours once per data change.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < data.count; i++) {
      pos.fromArray(data.positions, i * 3);
      normal.fromArray(data.normals, i * 3);
      const { right, up } = tangentFrame(normal);
      m.makeBasis(right, up, normal).setPosition(pos.multiplyScalar(TILE_LIFT));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.fromArray(data.colors, i * 3));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame(() => {
    sunUniform.current.value.copy(sunDirRef.current);
  });

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, data.count]}
      frustumCulled={false}
      onClick={(e) => {
        if (!onParcelSelect || e.instanceId == null) return;
        e.stopPropagation();
        const parcelId = plotIdToParcelId.get(data.plotIds[e.instanceId]);
        if (parcelId) onParcelSelect(parcelId);
      }}
    />
  );
}
