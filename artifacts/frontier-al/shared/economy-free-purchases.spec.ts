/**
 * Guards the FREE_PURCHASES toggle's safety gate.
 *
 * FREE_PURCHASES lets TestNet testers buy plots/commanders with no ALGO/ASCEND
 * charge. The load-bearing invariant — and the pricing HARD RULE — is that it
 * can NEVER be active on mainnet or in production economy mode, even if the env
 * flag is set. computeFreePurchases is the single chokepoint, so it is tested
 * directly here.
 */
import { describe, it, expect } from "vitest";
import { computeFreePurchases } from "@shared/economy-config";

describe("computeFreePurchases", () => {
  it("is active only when requested, on testnet, in testing mode", () => {
    expect(computeFreePurchases({ requested: true, economyMode: "testing", network: "testnet" })).toBe(true);
    // network unset (local dev) still resolves to testing/non-mainnet → allowed
    expect(computeFreePurchases({ requested: true, economyMode: "testing", network: undefined })).toBe(true);
  });

  it("is OFF when not requested, regardless of environment", () => {
    expect(computeFreePurchases({ requested: false, economyMode: "testing", network: "testnet" })).toBe(false);
  });

  // HARD RULE: nothing makes mainnet / production purchases free.
  it("REFUSES on mainnet even when requested (case-insensitive)", () => {
    expect(computeFreePurchases({ requested: true, economyMode: "testing", network: "mainnet" })).toBe(false);
    expect(computeFreePurchases({ requested: true, economyMode: "testing", network: "MainNet" })).toBe(false);
  });

  it("REFUSES in production economy mode even when requested", () => {
    expect(computeFreePurchases({ requested: true, economyMode: "production", network: "testnet" })).toBe(false);
  });
});
