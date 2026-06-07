/**
 * server/storage/game-rules.spec.ts
 *
 * Pure-helper tests for biome assignment and lat/lng→sphere conversion.
 * game-rules.ts imports drizzle table *definitions* (no DB connection), so these
 * run under vitest-node without a database.
 */

import { describe, it, expect } from "vitest";
import { biomeFromLatitude, latLngToXYZ } from "./game-rules.js";

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
