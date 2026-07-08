/**
 * client/src/lib/algorand.spec.ts
 *
 * Regression coverage for the wallet-sign serialization lock added
 * 2026-07-07: triggering two signing requests close together (an auto-claim
 * poll, a manual "Claim NFT" click, the batch "Claim All" flow, a commander
 * mint, etc.) used to hit the wallet SDK's raw "another request... in
 * progress" rejection. Every signer call now funnels through a shared
 * promise-chain lock so a second call queues instead of racing.
 *
 * 2026-07-08: Added coverage for fresh-params signing helpers and queue reset.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type algosdk from "algosdk";
import {
  registerWalletSigner,
  signTransactionWithActiveWallet,
  signGroupedTransactionsWithActiveWallet,
  resetSignQueue,
  buildAndSignWithFreshParams,
} from "./algorand";

const fakeTxn = {} as algosdk.Transaction;

describe("wallet-sign serialization lock", () => {
  beforeEach(() => {
    registerWalletSigner(null);
  });

  it("never runs two signer invocations concurrently, even when callers don't await each other", async () => {
    let active = 0;
    let maxActive = 0;
    registerWalletSigner(async (txns) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return txns.map(() => new Uint8Array([1]));
    });

    await Promise.all([
      signTransactionWithActiveWallet(fakeTxn, "ADDR"),
      signTransactionWithActiveWallet(fakeTxn, "ADDR"),
      signTransactionWithActiveWallet(fakeTxn, "ADDR"),
    ]);

    expect(maxActive).toBe(1);
  });

  it("queues a grouped-sign call behind an in-flight single-sign call (cross-function serialization)", async () => {
    let active = 0;
    let maxActive = 0;
    registerWalletSigner(async (txns) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return txns.map(() => new Uint8Array([1]));
    });

    await Promise.all([
      signTransactionWithActiveWallet(fakeTxn, "ADDR"),
      signGroupedTransactionsWithActiveWallet([fakeTxn, fakeTxn], "ADDR"),
    ]);

    expect(maxActive).toBe(1);
  });

  it("a rejected/cancelled signature does not wedge the queue for the next caller", async () => {
    let callCount = 0;
    registerWalletSigner(async () => {
      callCount++;
      if (callCount === 1) throw new Error("User rejected the request");
      return [new Uint8Array([1])];
    });

    await expect(signTransactionWithActiveWallet(fakeTxn, "ADDR")).rejects.toThrow("rejected");
    // Must still run — a failed prior call must not permanently lock later callers out.
    const result = await signTransactionWithActiveWallet(fakeTxn, "ADDR");
    expect(result).toEqual([new Uint8Array([1])]);
  });

  describe("a signer call that never settles (stuck wallet request)", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("times out instead of wedging the queue forever, and the next caller still gets to run", async () => {
      let calls = 0;
      registerWalletSigner(async (txns) => {
        calls++;
        if (calls === 1) return new Promise(() => {}); // never resolves — a dead WalletConnect request
        return txns.map(() => new Uint8Array([2]));
      });

      const stuck = signTransactionWithActiveWallet(fakeTxn, "ADDR");
      const rejection = expect(stuck).rejects.toThrow(/didn't respond in time/);
      await vi.advanceTimersByTimeAsync(120_000);
      await rejection;

      // The queue must have advanced past the dead request for the next caller.
      const result = await signTransactionWithActiveWallet(fakeTxn, "ADDR");
      expect(result).toEqual([new Uint8Array([2])]);
    });
  });
});

describe("resetSignQueue", () => {
  beforeEach(() => {
    registerWalletSigner(null);
    resetSignQueue();
  });

  it("clears a wedged queue so new signing attempts can proceed", async () => {
    let calls = 0;
    registerWalletSigner(async () => {
      calls++;
      if (calls === 1) return new Promise(() => {}); // never resolves
      return [new Uint8Array([3])];
    });

    // First call will timeout (use fake timers to speed up)
    vi.useFakeTimers();
    const stuck = signTransactionWithActiveWallet(fakeTxn, "ADDR");
    const rejection = expect(stuck).rejects.toThrow(/didn't respond in time/);
    await vi.advanceTimersByTimeAsync(120_000);
    await rejection;
    vi.useRealTimers();

    // Reset the queue
    resetSignQueue();

    // Next call should work immediately without waiting
    registerWalletSigner(async () => [new Uint8Array([4])]);
    const result = await signTransactionWithActiveWallet(fakeTxn, "ADDR");
    expect(result).toEqual([new Uint8Array([4])]);
  });
});

describe("buildAndSignWithFreshParams", () => {
  beforeEach(() => {
    registerWalletSigner(null);
    resetSignQueue();
  });

  it("fetches fresh params inside the signing lock before building the transaction", async () => {
    const mockParams = {
      fee: 1000,
      firstRound: 100,
      lastRound: 1000,
      genesisID: "testnet-v1.0",
      genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      flatFee: true,
    } as any;

    // Mock the algodClient.getTransactionParams().do() chain
    const { algodClient } = await import("./algorand");
    vi.spyOn(algodClient, "getTransactionParams").mockReturnValue({
      do: () => Promise.resolve(mockParams),
    } as any);

    let capturedParams: any = null;
    registerWalletSigner(async (txns) => {
      return txns.map(() => new Uint8Array([5]));
    });

    const buildTxn = (params: any) => {
      capturedParams = params;
      return { params } as any;
    };

    const result = await buildAndSignWithFreshParams(buildTxn, "ADDR");
    expect(result).toEqual([new Uint8Array([5])]);
    expect(capturedParams).toBe(mockParams);
  });

  it("throws if no wallet signer is registered", async () => {
    const buildTxn = () => fakeTxn;
    await expect(buildAndSignWithFreshParams(buildTxn, "ADDR")).rejects.toThrow("No wallet connected");
  });

  it("serializes concurrent calls through the signing lock", async () => {
    let active = 0;
    let maxActive = 0;
    registerWalletSigner(async (txns) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return txns.map(() => new Uint8Array([6]));
    });

    const buildTxn = () => fakeTxn;
    await Promise.all([
      buildAndSignWithFreshParams(buildTxn, "ADDR"),
      buildAndSignWithFreshParams(buildTxn, "ADDR"),
    ]);

    expect(maxActive).toBe(1);
  });
});
