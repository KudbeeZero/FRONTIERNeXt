import { describe, it, expect, afterEach } from "vitest";
import { evaluateBalanceEligibility, minAlgoMicros, isSybilCheckEnabled } from "./eligibility";

const MICRO = 1_000_000;

afterEach(() => {
  delete process.env.WELCOME_BONUS_SYBIL_CHECK;
  delete process.env.WELCOME_BONUS_MIN_ALGO;
});

describe("welcome-bonus eligibility", () => {
  it("defaults: enabled, 1 ALGO minimum", () => {
    expect(isSybilCheckEnabled()).toBe(true);
    expect(minAlgoMicros()).toBe(1 * MICRO);
  });

  it("rejects an empty/underfunded wallet", () => {
    const e0 = evaluateBalanceEligibility(0);
    expect(e0.eligible).toBe(false);
    expect(e0.algo).toBe(0);

    expect(evaluateBalanceEligibility(0.5 * MICRO).eligible).toBe(false);
  });

  it("accepts a wallet at/above the threshold", () => {
    expect(evaluateBalanceEligibility(1 * MICRO).eligible).toBe(true);
    expect(evaluateBalanceEligibility(5 * MICRO).eligible).toBe(true);
  });

  it("honours a custom WELCOME_BONUS_MIN_ALGO", () => {
    process.env.WELCOME_BONUS_MIN_ALGO = "3";
    expect(minAlgoMicros()).toBe(3 * MICRO);
    expect(evaluateBalanceEligibility(2 * MICRO).eligible).toBe(false);
    expect(evaluateBalanceEligibility(3 * MICRO).eligible).toBe(true);
  });

  it("disables the gate when WELCOME_BONUS_SYBIL_CHECK=false", () => {
    process.env.WELCOME_BONUS_SYBIL_CHECK = "false";
    expect(isSybilCheckEnabled()).toBe(false);
    expect(evaluateBalanceEligibility(0).eligible).toBe(true);
  });

  it("treats min=0 as no gate", () => {
    process.env.WELCOME_BONUS_MIN_ALGO = "0";
    expect(evaluateBalanceEligibility(0).eligible).toBe(true);
  });
});
