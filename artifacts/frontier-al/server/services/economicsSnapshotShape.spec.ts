/**
 * server/services/economicsSnapshotSampler.spec.ts
 *
 * Proves the pure pieces of the Unit D3 sampler: the hourly sample gate
 * (`shouldSampleNow`) and the row-shaping (`buildSnapshotRow`). The chain/DB
 * integration (`computeEconomicsSnapshotValues`, `sampleEconomicsSnapshotOnce`)
 * is not unit tested here — consistent with the rest of this codebase's
 * chain/DB code (docs/COVERAGE_GATE.md's "blocked" rows).
 */
import { describe, it, expect } from "vitest";
import { shouldSampleNow, buildSnapshotRow, SAMPLE_INTERVAL_MS } from "./economicsSnapshotShape";

describe("shouldSampleNow", () => {
  it("always samples on first boot (lastSampledAt === null)", () => {
    expect(shouldSampleNow(null, Date.now())).toBe(true);
  });

  it("does not re-sample before the interval has elapsed", () => {
    const last = 1_000_000;
    expect(shouldSampleNow(last, last + SAMPLE_INTERVAL_MS - 1)).toBe(false);
  });

  it("samples once the interval has fully elapsed", () => {
    const last = 1_000_000;
    expect(shouldSampleNow(last, last + SAMPLE_INTERVAL_MS)).toBe(true);
    expect(shouldSampleNow(last, last + SAMPLE_INTERVAL_MS + 5_000)).toBe(true);
  });

  it("respects a custom interval", () => {
    expect(shouldSampleNow(0, 500, 1000)).toBe(false);
    expect(shouldSampleNow(0, 1000, 1000)).toBe(true);
  });

  it("tolerates non-finite input without throwing", () => {
    expect(shouldSampleNow(NaN, Date.now())).toBe(false);
    expect(shouldSampleNow(0, NaN)).toBe(false);
  });
});

describe("buildSnapshotRow", () => {
  const values = {
    totalSupply: 1_000_000_000,
    inGameCirculating: 42_000,
    totalBurned: 1_200,
    treasury: 999_958_000,
    protocolTreasuryTotal: 850,
  };

  it("shapes a row with all computed values and the given capturedAt/id", () => {
    const row = buildSnapshotRow(values, 1_700_000_000_000, "fixed-id");
    expect(row).toEqual({
      id: "fixed-id",
      capturedAt: 1_700_000_000_000,
      totalSupply: values.totalSupply,
      inGameCirculating: values.inGameCirculating,
      totalBurned: values.totalBurned,
      treasury: values.treasury,
      protocolTreasuryTotal: values.protocolTreasuryTotal,
    });
  });

  it("carries whatever id the caller supplies (the sampler passes a fresh randomUUID())", () => {
    const row = buildSnapshotRow(values, 1_700_000_000_000, "caller-supplied-id");
    expect(row.id).toBe("caller-supplied-id");
  });
});
