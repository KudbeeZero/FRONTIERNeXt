/**
 * serverClock.spec.ts — the drift-correction math behind battle countdowns.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { computeOffsetMs, setServerTime, serverNow, getOffsetMs } from "../src/lib/serverClock";

describe("computeOffsetMs (pure)", () => {
  it("is server-minus-client (server ahead → positive)", () => {
    expect(computeOffsetMs(1_000_500, 1_000_000)).toBe(500);
    expect(computeOffsetMs(999_500, 1_000_000)).toBe(-500);
    expect(computeOffsetMs(1_000_000, 1_000_000)).toBe(0);
  });

  it("falls back to 0 for a non-finite server time", () => {
    expect(computeOffsetMs(NaN, 1_000_000)).toBe(0);
    expect(computeOffsetMs(Infinity, 1_000_000)).toBe(0);
  });
});

describe("serverNow / setServerTime", () => {
  beforeEach(() => setServerTime(0, 0)); // reset offset to 0

  it("applies the synced offset to the local clock", () => {
    // Server is 5s ahead of this device at the sync moment.
    setServerTime(1_005_000, 1_000_000);
    expect(getOffsetMs()).toBe(5_000);
    // 30s later on the device, serverNow tracks +5s ahead.
    expect(serverNow(1_030_000)).toBe(1_035_000);
  });

  it("with no skew, serverNow equals the device clock", () => {
    setServerTime(1_000_000, 1_000_000);
    expect(serverNow(1_234_567)).toBe(1_234_567);
  });

  it("re-sync replaces the offset (latest sample wins)", () => {
    setServerTime(1_005_000, 1_000_000); // +5s
    setServerTime(1_000_100, 1_000_000); // corrected to +0.1s
    expect(getOffsetMs()).toBe(100);
  });
});
