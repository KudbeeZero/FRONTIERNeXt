/**
 * server/tests/reset-testnet-parcels.spec.ts
 *
 * Validates the reset script's pure logic: env gating and post-reset mismatch
 * detection. The DB-backed transaction path is gated on DATABASE_URL.
 */

import { describe, it, expect } from "vitest";
import { resetNetworkIsAllowed, hasResetMismatch, type Counts } from "../storage/reset-helpers";

describe("reset env gating", () => {
  it("refuses mainnet", () => {
    expect(resetNetworkIsAllowed("mainnet")).toBe(false);
  });

  it("allows testnet", () => {
    expect(resetNetworkIsAllowed("testnet")).toBe(true);
  });

  it("allows localnet", () => {
    expect(resetNetworkIsAllowed("localnet")).toBe(true);
  });

  it("allows unset (defaults to testnet in app)", () => {
    expect(resetNetworkIsAllowed(undefined)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(resetNetworkIsAllowed("MAINNET")).toBe(false);
    expect(resetNetworkIsAllowed("MainNet")).toBe(false);
  });
});

describe("reset mismatch detection", () => {
  const perfect: Counts = {
    parcels: 21000,
    available: 21000,
    minted: 0,
    plotNfts: 0,
    mintIdempotency: 0,
    plotMintRetryQueue: 0,
    subParcels: 0,
    tradeOrders: 0,
    orbitalEvents: 0,
    gameEvents: 0,
    battles: 0,
  };

  it("returns false when counts are perfect", () => {
    expect(hasResetMismatch(perfect)).toBe(false);
  });

  it("returns true when parcel count is wrong", () => {
    expect(hasResetMismatch({ ...perfect, parcels: 20999 })).toBe(true);
  });

  it("returns true when owned plots remain (available < total)", () => {
    expect(hasResetMismatch({ ...perfect, available: 20999 })).toBe(true);
  });

  it("returns true when plotNfts remain", () => {
    expect(hasResetMismatch({ ...perfect, plotNfts: 1 })).toBe(true);
  });

  it("returns true when mint retry queue remains", () => {
    expect(hasResetMismatch({ ...perfect, plotMintRetryQueue: 1 })).toBe(true);
  });

  it("returns true when subParcels remain", () => {
    expect(hasResetMismatch({ ...perfect, subParcels: 1 })).toBe(true);
  });

  it("returns true when tradeOrders remain", () => {
    expect(hasResetMismatch({ ...perfect, tradeOrders: 1 })).toBe(true);
  });

  it("returns true when battles remain", () => {
    expect(hasResetMismatch({ ...perfect, battles: 1 })).toBe(true);
  });
});
