/**
 * planetDataV2 — the DATA layer, fully separate from rendering.
 *
 * Turns parcels (or deterministic mock data when none are supplied) into flat typed
 * arrays the v2 render layers consume. It reuses the existing Fibonacci-sphere
 * generator + biome palette so v2 stays in lock-step with the live globe and the
 * server's plot placement (server/sphereUtils.ts ↔ globeUtils.generateFibonacciSphere).
 */

import * as THREE from "three";
import type { LandParcel } from "@shared/schema";
import { GLOBE_RADIUS, PLOT_COUNT, BIOME_COLORS, COLOR_PLAYER, COLOR_ENEMY } from "@/lib/globe/globeConstants";
import { generateFibonacciSphere, latLngToVec3, getPlotColor } from "@/lib/globe/globeUtils";

const BIOME_KEYS = Object.keys(BIOME_COLORS);

export interface PlanetDataV2 {
  /** Number of plots actually generated. */
  count: number;
  /** count*3 surface positions on the globe sphere (radius = GLOBE_RADIUS). */
  positions: Float32Array;
  /** count*3 outward unit normals. */
  normals: Float32Array;
  /** count*3 per-plot RGB fill colour (biome / ownership). */
  colors: Float32Array;
  /** count plotIds, parallel to the arrays above (for click → parcel resolution). */
  plotIds: Int32Array;
  /** true when colours came from deterministic mock biomes (no parcels supplied). */
  isMock: boolean;
}

/** Deterministic biome pick for mock mode — stable per plotId. */
function mockBiome(plotId: number): string {
  let h = Math.imul(plotId ^ 0x9e3779b9, 2654435761) >>> 0;
  h ^= h >>> 15;
  return BIOME_KEYS[h % BIOME_KEYS.length];
}

/**
 * Build the v2 planet data.
 *
 * @param parcels         live parcels; when empty, deterministic mock biomes are used
 * @param currentPlayerId session player id (own plots render as the territory colour)
 * @param count           plot count (defaults to the canonical 21,000)
 */
export function buildPlanetDataV2(
  parcels: LandParcel[],
  currentPlayerId: string | null,
  count: number = PLOT_COUNT,
): PlanetDataV2 {
  const coords = generateFibonacciSphere(count);
  const n = coords.length;

  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const plotIds = new Int32Array(n);

  const byPlotId = new Map<number, LandParcel>();
  for (const p of parcels) byPlotId.set(p.plotId, p);
  const isMock = parcels.length === 0;

  const v = new THREE.Vector3();
  const col = new THREE.Color();

  for (let i = 0; i < n; i++) {
    const c = coords[i];
    plotIds[i] = c.plotId;

    latLngToVec3(c.lat, c.lng, GLOBE_RADIUS).toArray(positions, i * 3);
    v.fromArray(positions, i * 3).normalize().toArray(normals, i * 3);

    const parcel = byPlotId.get(c.plotId);
    if (parcel) {
      col.copy(getPlotColor(parcel, currentPlayerId, { player: COLOR_PLAYER, enemy: COLOR_ENEMY }));
    } else if (isMock) {
      col.copy(BIOME_COLORS[mockBiome(c.plotId)]);
    } else {
      col.setHex(0x1a2a3a); // unowned / unknown — dark blue-grey
    }
    col.toArray(colors, i * 3);
  }

  return { count: n, positions, normals, colors, plotIds, isMock };
}
