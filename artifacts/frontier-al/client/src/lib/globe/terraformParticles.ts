/**
 * Terraform stage 3-4 sparkle/halo helpers.
 *
 * Pure functions consumed by TerraformSparkleLayer:
 *   - selectSparklePlots: pick which plots get the effect (selected > hovered > owned-by-me)
 *   - buildSparkleOffsets: per-tile local offsets for sparkle dots (deterministic from plotId)
 *
 * No Three.js objects allocated here — keep this file cheap to import from any layer.
 */
import type { LandParcel } from "@shared/schema";
import { TERRAFORM_SPARKLE_COUNT_BY_STAGE } from "./globeConstants";
import { getTerraformStage } from "./globeUtils";

/** A plot selected to receive the stage 3-4 sparkle/halo effect. */
export interface SparklePlot {
  /** plotId (1..PLOT_COUNT) — also used as deterministic RNG seed for offsets */
  plotId: number;
  /** 3 or 4 — drives sparkle count and per-stage color/intensity */
  stage: 3 | 4;
  /** World-space base position of the plot (already lifted to stage altitude) */
  position: [number, number, number];
  /** true = player owns this plot, false = selected/hovered but unowned */
  isOwnedByMe: boolean;
}

/**
 * Pick which plots get the sparkle/halo effect.
 *
 * Eligibility: stage >= 3 AND (selected OR hovered OR owned by current player).
 * Sort priority: selected > hovered > owned-by-me. Capped at MAX_TERRAFORM_EFFECTS.
 *
 * `terraformFillPositions3D` is a parallel array to plotCoords (same indices, same order).
 * Pass the index→position lookup directly so we don't recompute Fibonacci geometry here.
 */
export function selectSparklePlots(
  parcels: LandParcel[],
  currentPlayerId: string | null,
  selectedPlotId: string | null,
  hoveredIndex: number | null,
  plotIdToIndex: Map<number, number>,
  terraformFillPositions3D: Array<[number, number, number]>,
  cap: number,
): SparklePlot[] {
  if (cap <= 0) return [];

  const selected: SparklePlot[] = [];
  const hovered: SparklePlot[] = [];
  const owned: SparklePlot[] = [];

  for (const parcel of parcels) {
    const stage = getTerraformStage(parcel);
    if (stage < 3) continue;

    const isSelected = !!selectedPlotId && parcel.id === selectedPlotId;
    const idx = plotIdToIndex.get(parcel.plotId);
    if (idx === undefined) continue;
    // Selected/hovered always count regardless of ownership.
    const isHovered = hoveredIndex === idx;
    const isOwnedByMe = !!currentPlayerId && parcel.ownerId === currentPlayerId;
    if (!isSelected && !isHovered && !isOwnedByMe) continue;

    const pos = terraformFillPositions3D[idx];
    if (!pos) continue;

    const stageNarrow = stage as 3 | 4;
    const item: SparklePlot = { plotId: parcel.plotId, stage: stageNarrow, position: pos, isOwnedByMe };

    if (isSelected) selected.push(item);
    else if (isHovered) hovered.push(item);
    else owned.push(item);
  }

  // Truncate each bucket to its fair share, then concatenate in priority order.
  // Selected always wins the cap; hovered and owned share whatever's left.
  const selectedCap = Math.min(selected.length, cap);
  const remainingAfterSelected = Math.max(0, cap - selectedCap);
  const halfRem = Math.floor(remainingAfterSelected / 2);
  const hoveredCap = Math.min(hovered.length, halfRem);
  const ownedCap = Math.min(owned.length, cap - selectedCap - hoveredCap);

  return [
    ...selected.slice(0, selectedCap),
    ...hovered.slice(0, hoveredCap),
    ...owned.slice(0, ownedCap),
  ];
}

/**
 * Build per-tile sparkle offsets — small local vectors scattered around the
 * plot's base position. Deterministic from plotId (no Math.random in render).
 *
 * Returns an array of {dx, dy, dz, phase, sizeMul} where dy is along the plot's
 * surface normal (slightly above the tile), and (dx, dz) lie in the surface
 * tangent plane. Caller is responsible for converting (dx, dy, dz) to a
 * world-space offset using the plot's normal.
 */
export interface SparkleOffset {
  dx: number;
  dy: number;
  dz: number;
  phase: number;     // 0..1, drives twinkle phase in shader/material
  sizeMul: number;   // 0.7..1.3, per-particle size variation
}

export function buildSparkleOffsets(plotId: number, stage: 3 | 4): SparkleOffset[] {
  const count = TERRAFORM_SPARKLE_COUNT_BY_STAGE[stage] ?? 0;
  if (count <= 0) return [];

  // Deterministic hash → seeded RNG, identical for the same (plotId, stage) every render.
  let h = (plotId * 2654435761) ^ (stage * 40503);
  const rand = () => {
    h = (h * 1664525 + 1013904223) | 0;
    return ((h >>> 0) % 100000) / 100000;
  };

  // Stage 4 sparkles spread slightly further from center for a richer effect.
  const spread = stage === 4 ? 0.020 : 0.014;
  // Slight lift above the tile surface so sparkles sit just above the fill plane.
  const baseLift = stage === 4 ? 0.008 : 0.005;

  const offsets: SparkleOffset[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * spread; // sqrt → uniform area distribution
    offsets.push({
      dx: Math.cos(angle) * radius,
      dy: baseLift + rand() * 0.004,
      dz: Math.sin(angle) * radius,
      phase: rand(),
      sizeMul: 0.7 + rand() * 0.6,
    });
  }
  return offsets;
}
