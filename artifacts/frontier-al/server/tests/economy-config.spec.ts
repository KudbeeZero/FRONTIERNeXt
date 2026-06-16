/**
 * server/tests/economy-config.spec.ts
 *
 * Sanity tests for the shared economy config emission math. Pure — economy-config
 * only reads process.env, no DB. Guards the projected-emissions safety helper the
 * admin log and /api/economics endpoint rely on.
 */

import { describe, it, expect } from "vitest";
import {
  projectedDailyEmissions,
  EMISSION_CHECK_PARCEL_COUNTS,
  LAND_DAILY_ASCEND_RATE,
} from "@shared/economy-config";

describe("projectedDailyEmissions", () => {
  it("is zero for zero parcels", () => {
    expect(projectedDailyEmissions(0)).toBe(0);
  });

  it("scales linearly with parcel count at the active daily rate", () => {
    expect(projectedDailyEmissions(1)).toBeCloseTo(LAND_DAILY_ASCEND_RATE, 9);
    expect(projectedDailyEmissions(100)).toBeCloseTo(100 * LAND_DAILY_ASCEND_RATE, 6);
  });

  it("is monotonically non-decreasing across the safety-check parcel counts", () => {
    const series = EMISSION_CHECK_PARCEL_COUNTS.map((n) => projectedDailyEmissions(n));
    for (let i = 1; i < series.length; i++) {
      expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
    }
  });

  it("uses a positive active daily emission rate", () => {
    expect(LAND_DAILY_ASCEND_RATE).toBeGreaterThan(0);
  });
});
