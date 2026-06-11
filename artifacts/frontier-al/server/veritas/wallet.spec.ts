/**
 * server/veritas/wallet.spec.ts
 *
 * Tests for the VERITAS test-wallet manager. All offline — algosdk key derivation runs
 * without a network, and the balance/holding helpers are pure.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  TestWallet,
  microToAlgo,
  algoToMicro,
  needsTopUp,
  findAssetAmount,
} from "./wallet.js";

describe("pure helpers", () => {
  it("micro/algo conversions round-trip", () => {
    expect(microToAlgo(1_500_000n)).toBe(1.5);
    expect(algoToMicro(1.5)).toBe(1_500_000n);
    expect(microToAlgo(algoToMicro(2.25))).toBe(2.25);
  });

  it("needsTopUp is inclusive at the minimum", () => {
    expect(needsTopUp(300_000n, 300_000n)).toBe(false); // exactly enough
    expect(needsTopUp(299_999n, 300_000n)).toBe(true);
    expect(needsTopUp(500_000n, 300_000n)).toBe(false);
  });

  it("findAssetAmount tolerates field-name variants and missing holdings", () => {
    const info = {
      amount: 5_000_000,
      assets: [
        { assetId: 111, amount: 42 },
        { "asset-id": 222, amount: 7 },
        { assetIndex: 333, amount: 0 },
      ],
    };
    expect(findAssetAmount(info, 111)).toBe(42n);
    expect(findAssetAmount(info, 222)).toBe(7n);
    expect(findAssetAmount(info, 333)).toBe(0n); // opted-in, zero balance → 0n, not null
    expect(findAssetAmount(info, 999)).toBeNull(); // not held
  });
});

describe("TestWallet", () => {
  const origEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("generates a valid 58-char address and round-trips via mnemonic", () => {
    const w = new TestWallet();
    expect(w.address).toHaveLength(58);
    const reloaded = new TestWallet({ mnemonic: w.exportMnemonic() });
    expect(reloaded.address).toBe(w.address);
  });

  it("derives a deterministic address from a mnemonic", () => {
    const w1 = new TestWallet();
    const mn = w1.exportMnemonic();
    expect(new TestWallet({ mnemonic: mn }).address).toBe(new TestWallet({ mnemonic: mn }).address);
  });

  it("fromEnv returns null without a test mnemonic, a wallet with one", () => {
    delete process.env.VERITAS_TEST_MNEMONIC;
    expect(TestWallet.fromEnv()).toBeNull();

    const mn = new TestWallet().exportMnemonic();
    process.env.VERITAS_TEST_MNEMONIC = mn;
    const w = TestWallet.fromEnv();
    expect(w).not.toBeNull();
    expect(w!.address).toBe(new TestWallet({ mnemonic: mn }).address);
  });
});
