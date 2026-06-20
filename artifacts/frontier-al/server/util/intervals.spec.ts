/**
 * server/util/intervals.spec.ts
 *
 * Proves `clampIntervalMs` — the env-cadence parser shared by the background
 * `setInterval` loops (battle auto-resolver default 5000/floor 1000, `battle_tick`
 * default 1000/floor 250). Backs the Phase-1 PR5 default-cadence change: an unset
 * env yields the (new) default, a valid value is honored, and a too-small value is
 * floored so a misconfig can't hammer the DB.
 */
import { describe, it, expect } from "vitest";
import { clampIntervalMs } from "./intervals";

describe("clampIntervalMs", () => {
  // Resolver param set: default 5000, floor 1000.
  describe("resolver cadence (def 5000, floor 1000)", () => {
    it("falls back to the default when unset", () => {
      expect(clampIntervalMs(undefined, 5000, 1000)).toBe(5000);
    });
    it("falls back to the default on empty / non-numeric / '0'", () => {
      expect(clampIntervalMs("", 5000, 1000)).toBe(5000);
      expect(clampIntervalMs("abc", 5000, 1000)).toBe(5000);
      expect(clampIntervalMs("0", 5000, 1000)).toBe(5000);
    });
    it("honors a valid value at or above the floor", () => {
      expect(clampIntervalMs("2000", 5000, 1000)).toBe(2000);
      expect(clampIntervalMs("15000", 5000, 1000)).toBe(15000);
    });
    it("floors a too-aggressive value", () => {
      expect(clampIntervalMs("100", 5000, 1000)).toBe(1000);
      expect(clampIntervalMs("1", 5000, 1000)).toBe(1000);
    });
  });

  // battle_tick param set: default 1000, floor 250.
  describe("battle_tick cadence (def 1000, floor 250)", () => {
    it("falls back to the default when unset", () => {
      expect(clampIntervalMs(undefined, 1000, 250)).toBe(1000);
    });
    it("honors a valid value and floors a too-small one", () => {
      expect(clampIntervalMs("500", 1000, 250)).toBe(500);
      expect(clampIntervalMs("50", 1000, 250)).toBe(250);
    });
  });

  // Upper-bound hardening (security-pass): a too-large or non-finite value must
  // not reach setInterval, where Node coerces it to a 1ms hot loop that hammers
  // the DB — the opposite of the floor's intent.
  describe("upper bound", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    it("falls back to the default on a non-finite value (Infinity / '1e999')", () => {
      // Number("1e999") === Infinity, which is truthy and would pass `|| def`.
      expect(clampIntervalMs("1e999", 5000, 1000)).toBe(5000);
    });
    it("clamps a finite value above the 24h ceiling", () => {
      // Above Node's TIMEOUT_MAX (~2.1e9); pre-fix this overflowed to a 1ms loop.
      expect(clampIntervalMs("9999999999", 5000, 1000)).toBe(DAY_MS);
      expect(clampIntervalMs(String(DAY_MS + 1), 5000, 1000)).toBe(DAY_MS);
    });
    it("honors a large-but-sane value at the ceiling", () => {
      expect(clampIntervalMs(String(DAY_MS), 5000, 1000)).toBe(DAY_MS);
    });
  });
});
