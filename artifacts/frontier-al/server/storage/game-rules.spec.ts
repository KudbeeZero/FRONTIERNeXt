/**
 * server/storage/game-rules.spec.ts
 *
 * Pure-helper tests for biome assignment and lat/lng→sphere conversion.
 * game-rules.ts imports drizzle table *definitions* (no DB connection), so these
 * run under vitest-node without a database.
 */

import { describe, it, expect } from "vitest";
import { biomeFromLatitude, latLngToXYZ, computeLiveAscendAccrued } from "./game-rules.js";
import { calculateAscendPerDay } from "@shared/schema";
import type { LandParcel } from "@shared/schema";
import { INFLUENCE_YIELD_THRESHOLD } from "../engine/battle/tuning.js";

const DAY_MS = 1000 * 60 * 60 * 24;

/** Minimal fixture — only the fields computeLiveAscendAccrued actually reads. */
function makeParcel(overrides: Partial<LandParcel>): LandParcel {
  return {
    ownerId: "player-1",
    influence: 100,
    lastAscendClaimTs: Date.now(),
    ascendAccumulated: 0,
    improvements: [],
    ...overrides,
  } as LandParcel;
}

const ALL_BIOMES = [
  "forest", "desert", "mountain", "plains",
  "water", "tundra", "volcanic", "swamp",
];

describe("biomeFromLatitude", () => {
  it("always returns a valid biome", () => {
    for (let plotId = 0; plotId < 500; plotId++) {
      for (const lat of [-85, -50, -25, 0, 25, 50, 85]) {
        expect(ALL_BIOMES).toContain(biomeFromLatitude(lat, plotId));
      }
    }
  });

  it("is deterministic for the same (lat, plotId)", () => {
    expect(biomeFromLatitude(42, 1234)).toBe(biomeFromLatitude(42, 1234));
  });

  it("never produces equatorial biomes (water/desert) at the poles", () => {
    for (let plotId = 0; plotId < 500; plotId++) {
      const polar = biomeFromLatitude(85, plotId);
      expect(polar).not.toBe("water");
      expect(polar).not.toBe("desert");
    }
  });

  it("treats latitude symmetrically about the equator", () => {
    for (let plotId = 0; plotId < 200; plotId++) {
      expect(biomeFromLatitude(33, plotId)).toBe(biomeFromLatitude(-33, plotId));
    }
  });
});

describe("latLngToXYZ", () => {
  it("returns points on the unit sphere", () => {
    for (const [lat, lng] of [[0, 0], [45, 90], [-30, 170], [80, -120], [12.5, 33.3]]) {
      const { x, y, z } = latLngToXYZ(lat, lng);
      expect(x * x + y * y + z * z).toBeCloseTo(1, 9);
    }
  });

  it("maps the equator/prime-meridian origin to +X", () => {
    const { x, y, z } = latLngToXYZ(0, 0);
    expect(x).toBeCloseTo(1, 9);
    expect(y).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(0, 9);
  });
});

// Regression coverage for the 2026-07-07 "ASCEND claim button never appears"
// bug: DbStorage read `parcel.ascendAccumulated` directly from the Postgres
// row, which is permanently stale (only ever written as 0, at claim time).
// The live-computed total was silently discarded, so the client always saw
// 0 claimable ASCEND no matter how long a parcel had been accruing.
describe("computeLiveAscendAccrued", () => {
  it("is 0 for an unowned parcel", () => {
    expect(computeLiveAscendAccrued(makeParcel({ ownerId: null }), Date.now())).toBe(0);
  });

  it("accrues real ASCEND once time has elapsed since the last claim — the core regression case", () => {
    const now = Date.now();
    const parcel = makeParcel({ lastAscendClaimTs: now - 2 * DAY_MS, ascendAccumulated: 0 });
    const perDay = calculateAscendPerDay(parcel.improvements);
    // Before the fix, callers read parcel.ascendAccumulated (always 0) and
    // never saw this. A regression here means the claim button goes dark again.
    expect(computeLiveAscendAccrued(parcel, now)).toBeCloseTo(perDay * 2, 6);
  });

  it("is unaffected by elapsed time when the parcel is below the influence-yield threshold (matches claimAscend's gate)", () => {
    const now = Date.now();
    const parcel = makeParcel({
      lastAscendClaimTs: now - 5 * DAY_MS,
      influence: INFLUENCE_YIELD_THRESHOLD - 1,
      ascendAccumulated: 3,
    });
    expect(computeLiveAscendAccrued(parcel, now)).toBe(3);
  });

  it("returns the stored base when lastAscendClaimTs is in the future (no negative accrual)", () => {
    const now = Date.now();
    const parcel = makeParcel({ lastAscendClaimTs: now + DAY_MS, ascendAccumulated: 7 });
    expect(computeLiveAscendAccrued(parcel, now)).toBe(7);
  });

  it("adds to any already-stored base rather than replacing it", () => {
    const now = Date.now();
    const parcel = makeParcel({ lastAscendClaimTs: now - DAY_MS, ascendAccumulated: 10 });
    const perDay = calculateAscendPerDay(parcel.improvements);
    expect(computeLiveAscendAccrued(parcel, now)).toBeCloseTo(10 + perDay, 6);
  });
});
