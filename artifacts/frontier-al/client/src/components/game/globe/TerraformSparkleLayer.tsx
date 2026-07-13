/**
 * TerraformSparkleLayer — conservative particle + halo effect for stage 3-4 plots.
 *
 * Population rules (see terraformParticles.selectSparklePlots):
 *   - Stage >= 3 only
 *   - Selected > hovered > owned-by-me priority
 *   - Capped at MAX_TERRAFORM_EFFECTS
 *
 * Visual rules:
 *   - Halo: a single soft additive disc per selected plot + per hovered plot
 *   - Sparkles: 4-10 small additive points per plot, scattered in the tangent plane
 *   - Both layers LOD-gated by camera distance (TERRAFORM_FX_LOD_DISTANCE)
 *
 * No custom shaders — uses meshBasicMaterial with additive blending. The
 * procedural sprite is generated once at module load (a 64x64 white radial
 * gradient drawn into a canvas), shared across all halos and sparkles.
 */
import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { LandParcel } from "@shared/schema";
import {
  GLOBE_RADIUS,
  MAX_TERRAFORM_EFFECTS,
  TERRAFORM_HALO_RADIUS,
  TERRAFORM_SPARKLE_RADIUS,
  TERRAFORM_HALO_COLOR,
  TERRAFORM_SPARKLE_COLOR,
  TERRAFORM_FX_LOD_DISTANCE,
} from "@/lib/globe/globeConstants";
import {
  buildSparkleOffsets,
  selectSparklePlots,
  type SparkleOffset,
  type SparklePlot,
} from "@/lib/globe/terraformParticles";
import { latLngToVec3, tangentFrame } from "@/lib/globe/globeUtils";

interface TerraformSparkleLayerProps {
  parcels: LandParcel[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  /** Index into the parallel plotCoords array of the currently hovered plot, or null */
  hoveredIndex: number | null;
  /** Pre-computed plotCoords from PlotOverlay (parallel to plotId→index map) */
  plotCoords: Array<{ plotId: number; lat: number; lng: number }>;
  /** plotId → index in plotCoords */
  plotIdToIndex: Map<number, number>;
  /** Per-plot fill positions (already lifted to stage altitude) — pass through from PlotOverlay */
  terraformFillPositions3D: THREE.Vector3[];
}

// ── Procedural sprite texture (shared, allocated once) ─────────────────────────
// A 64x64 radial gradient: white center, transparent edge. Used by both halo and
// sparkle sprites with different scales and opacities.
function makeRadialSprite(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, "rgba(255,255,255,1.0)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.55)");
  grad.addColorStop(1.0, "rgba(255,255,255,0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SPRITE_TEXTURE = typeof document !== "undefined" ? makeRadialSprite() : null;

// Maximum number of sparkle points allocated — per-plot count is bounded by
// TERRAFORM_SPARKLE_COUNT_BY_STAGE[4] = 10. Multiplied by MAX_TERRAFORM_EFFECTS
// for the worst case so the buffer never overflows.
const MAX_TOTAL_SPARKLES = MAX_TERRAFORM_EFFECTS * 10;
const MAX_TOTAL_HALOS = MAX_TERRAFORM_EFFECTS;

export function TerraformSparkleLayer({
  parcels,
  currentPlayerId,
  selectedPlotId,
  hoveredIndex,
  plotCoords,
  plotIdToIndex,
  terraformFillPositions3D,
}: TerraformSparkleLayerProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const haloMeshRef = useRef<THREE.InstancedMesh>(null!);
  const sparkleMeshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { camera } = useThree();

  // ── Population selection (memo on parcel/selection/hover) ─────────────────
  const sparklePlots: SparklePlot[] = useMemo(() => {
    // Adapt Vector3[] → [number, number, number][] for selectSparklePlots.
    const tuples: Array<[number, number, number]> = terraformFillPositions3D.map(
      v => [v.x, v.y, v.z] as [number, number, number]
    );
    return selectSparklePlots(
      parcels,
      currentPlayerId,
      selectedPlotId,
      hoveredIndex,
      plotIdToIndex,
      tuples,
      MAX_TERRAFORM_EFFECTS,
    );
  }, [parcels, currentPlayerId, selectedPlotId, hoveredIndex, plotIdToIndex, terraformFillPositions3D]);

  // ── Per-plot sparkle offsets (memo on plot list) ──────────────────────────
  // Flat array: offsets concatenated per plot, in the same order as sparklePlots.
  const plotSparkleData = useMemo(() => {
    return sparklePlots.map(plot => ({
      plot,
      offsets: buildSparkleOffsets(plot.plotId, plot.stage),
    }));
  }, [sparklePlots]);

  // ── LOD: hide the whole layer at far zoom ─────────────────────────────────
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = camera.position.length() < TERRAFORM_FX_LOD_DISTANCE;
  });

  // ── Per-frame update: halo + sparkle transforms, twinkle pulse, opacity ────
  // Only updates the active instance count, never iterates the full 21k.
  useFrame((state) => {
    if (!haloMeshRef.current || !sparkleMeshRef.current) return;
    if (!groupRef.current?.visible) return;

    const t = state.clock.getElapsedTime();

    // Halos: one per selected + hovered plot (the most visually prominent
    // buckets). Owned-by-me plots still show sparkles but skip the halo to
    // keep the planet readable when many plots are owned.
    let haloIdx = 0;
    for (const { plot } of plotSparkleData) {
      if (haloIdx >= MAX_TOTAL_HALOS) break;
      const isSelectedOrHovered = !plot.isOwnedByMe;
      if (!isSelectedOrHovered) continue;
      const [px, py, pz] = plot.position;
      dummy.position.set(px, py, pz);
      dummy.lookAt(px * 2, py * 2, pz * 2);
      // Slow breathing pulse: 0.85..1.15 of base radius
      const breathe = 1.0 + Math.sin(t * 1.6 + plot.plotId * 0.13) * 0.15;
      const scale = (TERRAFORM_HALO_RADIUS / GLOBE_RADIUS) * 2 * breathe;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      haloMeshRef.current.setMatrixAt(haloIdx, dummy.matrix);
      // Brighter for stage 4
      const intensity = plot.stage === 4 ? 0.85 : 0.55;
      const c = TERRAFORM_HALO_COLOR.clone().multiplyScalar(intensity);
      haloMeshRef.current.setColorAt(haloIdx, c);
      haloIdx++;
    }
    haloMeshRef.current.count = haloIdx;
    haloMeshRef.current.instanceMatrix.needsUpdate = true;
    if (haloMeshRef.current.instanceColor) haloMeshRef.current.instanceColor.needsUpdate = true;

    // Sparkles: per-plot offsets written into the global sparkle buffer
    let sparkleIdx = 0;
    for (const { plot, offsets } of plotSparkleData) {
      if (sparkleIdx >= MAX_TOTAL_SPARKLES) break;
      // Recompute the surface frame from the plot's lat/lng for local offset alignment.
      const coord = plotCoords[plotIdToIndex.get(plot.plotId) ?? -1];
      if (!coord) continue;
      const normal = latLngToVec3(coord.lat, coord.lng, 1).normalize();
      const { right, up } = tangentFrame(normal);

      for (let i = 0; i < offsets.length && sparkleIdx < MAX_TOTAL_SPARKLES; i++) {
        const o: SparkleOffset = offsets[i];
        const [px, py, pz] = plot.position;
        // Local (dx, dy, dz) → world offset: dy is along the surface normal,
        // (dx, dz) lie in the tangent plane using the right/up basis.
        const worldX = px + right.x * o.dx + up.x * o.dz + normal.x * o.dy;
        const worldY = py + right.y * o.dx + up.y * o.dz + normal.y * o.dy;
        const worldZ = pz + right.z * o.dx + up.z * o.dz + normal.z * o.dy;

        // Twinkle: 0.3..1.0 sine pulse with per-particle phase offset
        const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 3.0 + o.phase * Math.PI * 2));

        dummy.position.set(worldX, worldY, worldZ);
        dummy.lookAt(worldX * 2, worldY * 2, worldZ * 2);
        const scale = (TERRAFORM_SPARKLE_RADIUS / GLOBE_RADIUS) * 2 * o.sizeMul * (0.7 + 0.6 * twinkle);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        sparkleMeshRef.current.setMatrixAt(sparkleIdx, dummy.matrix);
        // Color encodes twinkle intensity; base color stays the same.
        const c = TERRAFORM_SPARKLE_COLOR.clone().multiplyScalar(twinkle);
        sparkleMeshRef.current.setColorAt(sparkleIdx, c);
        sparkleIdx++;
      }
    }
    sparkleMeshRef.current.count = sparkleIdx;
    sparkleMeshRef.current.instanceMatrix.needsUpdate = true;
    if (sparkleMeshRef.current.instanceColor) sparkleMeshRef.current.instanceColor.needsUpdate = true;
  });

  // ── Color initialisation (so instanceColor is allocated) ──────────────────
  // First useFrame above sets the real per-instance colors, but Three.js
  // requires instanceColor to be allocated before setColorAt can be called.
  // We touch both meshes once in an effect with a dummy color to allocate.
  useEffect(() => {
    if (haloMeshRef.current && !haloMeshRef.current.instanceColor) {
      const tmp = new THREE.Color(1, 1, 1);
      for (let i = 0; i < MAX_TOTAL_HALOS; i++) {
        haloMeshRef.current.setColorAt(i, tmp);
      }
      haloMeshRef.current.instanceColor!.needsUpdate = true;
    }
    if (sparkleMeshRef.current && !sparkleMeshRef.current.instanceColor) {
      const tmp = new THREE.Color(1, 1, 1);
      for (let i = 0; i < MAX_TOTAL_SPARKLES; i++) {
        sparkleMeshRef.current.setColorAt(i, tmp);
      }
      sparkleMeshRef.current.instanceColor!.needsUpdate = true;
    }
  }, []);

  if (!SPRITE_TEXTURE) return null;

  return (
    <group ref={groupRef} renderOrder={5}>
      {/* Halo layer: soft additive disc, faces the globe center (always front-side) */}
      <instancedMesh
        ref={haloMeshRef}
        args={[undefined, undefined, MAX_TOTAL_HALOS]}
        renderOrder={5}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={SPRITE_TEXTURE}
          color="#ffffff"
          transparent
          opacity={0.55}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          side={THREE.FrontSide}
        />
      </instancedMesh>

      {/* Sparkle layer: small additive points, depth-disabled so they stay visible on any terrain */}
      <instancedMesh
        ref={sparkleMeshRef}
        args={[undefined, undefined, MAX_TOTAL_SPARKLES]}
        renderOrder={5}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={SPRITE_TEXTURE}
          color="#ffffff"
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          side={THREE.FrontSide}
        />
      </instancedMesh>
    </group>
  );
}
