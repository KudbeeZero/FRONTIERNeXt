/**
 * client/tests/walletNetworkGuard.spec.ts
 *
 * Guards the Algorand TestNet configuration invariant — the app must always
 * point at Algorand TestNet unless the owner explicitly flips the build-time
 * env flag. No mainnet, no dev, no staging.
 */
import { describe, it, expect } from "vitest";
import { ALGORAND_TESTNET } from "@/lib/algorand";

describe("Algorand network configuration", () => {
  it("defaults to TestNet genesis and API endpoints", () => {
    expect(ALGORAND_TESTNET.genesisID).toBe("testnet-v1.0");
    expect(ALGORAND_TESTNET.algodUrl).toContain("testnet");
    expect(ALGORAND_TESTNET.indexerUrl).toContain("testnet");
  });
});
