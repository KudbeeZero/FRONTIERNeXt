/**
 * client/src/lib/algorand.spec.ts
 *
 * Regression coverage for the wallet-sign serialization lock added
 * 2026-07-07: triggering two signing requests close together (an auto-claim
 * poll, a manual "Claim NFT" click, the batch "Claim All" flow, a commander
 * mint, etc.) used to hit the wallet SDK's raw "another request... in
 * progress" rejection. Every signer call now funnels through a shared
 * promise-chain lock so a second call queues instead of racing.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type algosdk from "algosdk";
import {
  registerWalletSigner,
  signTransactionWithActiveWallet,
  signGroupedTransactionsWithActiveWallet,
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
});
