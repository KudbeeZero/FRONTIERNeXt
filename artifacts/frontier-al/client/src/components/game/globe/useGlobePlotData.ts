/**
 * useGlobePlotData — shared plot geometry and terraform data for globe layers.
 *
 * Both PlotOverlay and TerraformSparkleLayer need the same plot coordinates,
 * plotId-to-index mapping, and per-plot terraform fill positions. This hook
 * computes them once and returns the memoised values so both layers stay in sync.
 *
 * Inputs: parcels array and currentPlayerId (used to derive terraform positions).
 * Outputs: plotCoords, plotIdToIndex, terraformFillPositions3D.
 */
import * as THREE from "three";
import { useMemo } from "react";
import type { LandParcel } from "@shared/schema";
import { GLOBE_RADIUS, PLOT_COUNT, TERRAFORM_ALTITUDE } from "../../../lib/globe/globeConstants";
import { generateFibonacciSphere, latLngToVec3, getTerraformStage } from "../../../lib/globe/globeUtils";

export interface GlobePlotData {
  /** Fibonacci sphere coordinates for all 21k plots (parallel array) */
  plotCoords: Array<{ plotId: number; lat: number; lng: number }>;
  /** plotId → index in plotCoords */
  plotIdToIndex: Map<number, number>;
  /** Per-plot fill positions (already lifted to stage altitude) */
  terraformFillPositions3D: THREE.Vector3[];
}

export function useGlobePlotData(
  parcels: LandParcel[],
  currentPlayerId: string | null,
): GlobePlotData {
  const plotCoords = useMemo(() => generateFibonacciSphere(PLOT_COUNT), []);

  const plotIdToIndex = useMemo(() => {
    const m = new Map<number, number>();
    plotCoords.forEach((c: { plotId: number }, i: number) => m.set(c.plotId, i));
    return m;
  }, [plotCoords]);

  // Build plotId → parcel map once, then use it to compute terraform positions.
  const plotIdToParcel = useMemo(() => {
    const m = new Map<number, LandParcel>();
    parcels.forEach(p => m.set(p.plotId, p));
    return m;
  }, [parcels]);

  const terraformFillPositions3D = useMemo(() => {
    return plotCoords.map((c: { lat: number; lng: number }) => {
      const parcel = plotIdToParcel.get((c as any).plotId);
      const stage = getTerraformStage(parcel);
      const altitude = TERRAFORM_ALTITUDE[stage];
      return latLngToVec3(c.lat, c.lng, GLOBE_RADIUS * altitude);
    });
  }, [plotCoords, plotIdToParcel]);

  return { plotCoords, plotIdToIndex, terraformFillPositions3D };
}
