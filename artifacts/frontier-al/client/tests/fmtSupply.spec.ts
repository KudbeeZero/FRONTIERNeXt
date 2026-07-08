/**
 * client/tests/fmtSupply.spec.ts
 *
 * Regression tests for the shared economics number formatter.
 *
 * The formatter was previously duplicated across EconomicsPanel.tsx and
 * landing-economics.tsx with no billions tier and only 1-decimal precision
 * at the millions scale, causing Treasury (~999.95M) and Total Supply (1B)
 * to both display as "1000.0M". The fix adds a billions tier and increases
 * millions precision to 2 decimals.
 */
import { describe, it, expect } from "vitest";
import { fmtSupply } from "@/lib/fmtSupply";

describe("fmtSupply", () => {
  // ─── Null / undefined / NaN ──────────────────────────────────────────
  it("returns '0' for null", () => {
    expect(fmtSupply(null)).toBe("0");
  });

  it("returns '0' for undefined", () => {
    expect(fmtSupply(undefined)).toBe("0");
  });

  it("returns '0' for NaN", () => {
    expect(fmtSupply(NaN)).toBe("0");
  });

  // ─── Billions tier ───────────────────────────────────────────────────
  it("formats 1 billion as '1.00B'", () => {
    expect(fmtSupply(1_000_000_000)).toBe("1.00B");
  });

  it("formats 1.5 billion as '1.50B'", () => {
    expect(fmtSupply(1_500_000_000)).toBe("1.50B");
  });

  // ─── Millions tier (the key regression: 2 decimal places) ────────────
  it("formats 999.95M distinctly from 1B", () => {
    // Previously both showed "1000.0M" — this was the owner-flagged bug.
    expect(fmtSupply(999_950_000)).toBe("999.95M");
    expect(fmtSupply(1_000_000_000)).not.toBe(fmtSupply(999_950_000));
  });

  it("formats exact millions with 2 decimal places", () => {
    expect(fmtSupply(50_000_000)).toBe("50.00M");
  });

  it("formats sub-million values over 1M with 2 decimal precision", () => {
    expect(fmtSupply(1_234_567)).toBe("1.23M");
  });

  // ─── Thousands tier ──────────────────────────────────────────────────
  it("formats thousands with 1 decimal place", () => {
    expect(fmtSupply(45_000)).toBe("45.0K");
    expect(fmtSupply(1_000)).toBe("1.0K");
    expect(fmtSupply(999_999)).toBe("1000.0K");
  });

  // ─── Small values ────────────────────────────────────────────────────
  it("formats small values with default 2 decimal places", () => {
    expect(fmtSupply(0)).toBe("0.00");
    expect(fmtSupply(123.456)).toBe("123.46");
    expect(fmtSupply(999)).toBe("999.00");
  });

  it("respects custom decimals parameter for small values", () => {
    expect(fmtSupply(42, 0)).toBe("42");
    expect(fmtSupply(3.14, 3)).toBe("3.140");
  });
});
