/**
 * server/util/backgroundIntervals.spec.ts
 *
 * Pins the tunable defaults and floors for the two new env-driven cadences
 * introduced by the cost-control pass. These values are load-bearing: they
 * determine how often the AI scheduler and the debuff cleanup run, which
 * directly drives Neon compute + data-transfer usage.
 */
import { describe, it, expect } from "vitest";
import {
  resolveAiTurnIntervalMs,
  resolveDebuffCleanupIntervalMs,
} from "./backgroundIntervals.js";

describe("resolveAiTurnIntervalMs", () => {
  it("defaults to 120000 ms (120s) when the env var is unset", () => {
    expect(resolveAiTurnIntervalMs({})).toBe(120_000);
  });
  it("honors a valid override", () => {
    expect(resolveAiTurnIntervalMs({ AI_TURN_INTERVAL_MS: "45000" })).toBe(45_000);
  });
  it("clamps positive values below the 30000 ms floor up to the floor", () => {
    expect(resolveAiTurnIntervalMs({ AI_TURN_INTERVAL_MS: "10000" })).toBe(30_000);
    expect(resolveAiTurnIntervalMs({ AI_TURN_INTERVAL_MS: "1" })).toBe(30_000);
  });
  it("falls back to the default for non-numeric / non-finite / empty values", () => {
    expect(resolveAiTurnIntervalMs({ AI_TURN_INTERVAL_MS: "" })).toBe(120_000);
    expect(resolveAiTurnIntervalMs({ AI_TURN_INTERVAL_MS: "abc" })).toBe(120_000);
    expect(resolveAiTurnIntervalMs({ AI_TURN_INTERVAL_MS: "Infinity" })).toBe(120_000);
  });
});

describe("resolveDebuffCleanupIntervalMs", () => {
  it("defaults to 60000 ms (60s) when the env var is unset", () => {
    expect(resolveDebuffCleanupIntervalMs({})).toBe(60_000);
  });
  it("honors a valid override", () => {
    expect(resolveDebuffCleanupIntervalMs({ DEBUFF_CLEANUP_INTERVAL_MS: "30000" })).toBe(30_000);
  });
  it("clamps positive values below the 10000 ms floor up to the floor", () => {
    expect(resolveDebuffCleanupIntervalMs({ DEBUFF_CLEANUP_INTERVAL_MS: "5000" })).toBe(10_000);
    expect(resolveDebuffCleanupIntervalMs({ DEBUFF_CLEANUP_INTERVAL_MS: "1" })).toBe(10_000);
  });
});
