/**
 * server/services/chain/commanderMint.spec.ts
 *
 * Focused regression tests for the Commander NFT mint idempotency helpers
 * added to fix the "Mint Failed — Tap Retry" production defect:
 *   - `decideCommanderRetry`: idempotent retry decision (no duplicate ASA,
 *     no parallel in-flight retry).
 *   - `withCommanderMintLock`: single-flight lock so concurrent retries share
 *     ONE chain mint instead of minting duplicate ASAs.
 *
 * No chain interaction — client is stubbed, no network, no real keys.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({
  getAlgodClient: () => { throw new Error("algod must not be used by these tests"); },
  getAdminAccount: () => ({ addr: { toString: () => "ADMIN" }, sk: new Uint8Array() }),
  getAdminAddress: () => "ADMIN",
  getNetwork: () => "testnet",
  getIndexerClient: () => { throw new Error("indexer must not be used by these tests"); },
}));

import { decideCommanderRetry, withCommanderMintLock } from "./commander";

describe("decideCommanderRetry", () => {
  it("returns already_minted when the NFT row already has an assetId", () => {
    const d = decideCommanderRetry({ existingNftAssetId: 123, idempotencyStatus: null, idempotencyAssetId: null });
    expect(d).toEqual({ kind: "already_minted", assetId: 123 });
  });

  it("returns already_minted when idempotency is confirmed with an assetId (orphaned on-chain mint recovered)", () => {
    const d = decideCommanderRetry({ existingNftAssetId: null, idempotencyStatus: "confirmed", idempotencyAssetId: 456 });
    expect(d).toEqual({ kind: "already_minted", assetId: 456 });
  });

  it("returns already_minting when an idempotency row is still pending (blocks parallel retry)", () => {
    const d = decideCommanderRetry({ existingNftAssetId: null, idempotencyStatus: "pending", idempotencyAssetId: null });
    expect(d).toEqual({ kind: "already_minting" });
  });

  it("returns mint when idempotency is failed and no NFT row exists", () => {
    const d = decideCommanderRetry({ existingNftAssetId: null, idempotencyStatus: "failed", idempotencyAssetId: null });
    expect(d).toEqual({ kind: "mint" });
  });

  it("returns mint when there is no idempotency row and no NFT row", () => {
    const d = decideCommanderRetry({ existingNftAssetId: null, idempotencyStatus: null, idempotencyAssetId: null });
    expect(d).toEqual({ kind: "mint" });
  });
});

describe("withCommanderMintLock", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("runs the fn exactly once for concurrent callers (single-flight, no duplicate mint)", async () => {
    const fn = vi.fn(async () => "minted-asa-1");
    const [a, b, c] = await Promise.all([
      withCommanderMintLock("cmd-1", fn),
      withCommanderMintLock("cmd-1", fn),
      withCommanderMintLock("cmd-1", fn),
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(a).toBe("minted-asa-1");
    expect(b).toBe("minted-asa-1");
    expect(c).toBe("minted-asa-1");
  });

  it("releases the lock after success so a later call runs again", async () => {
    const fn = vi.fn(async (n: number) => `run-${n}`);
    await withCommanderMintLock("cmd-2", () => fn(1));
    await withCommanderMintLock("cmd-2", () => fn(2));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases the lock after rejection so a later call can retry", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("chain blip"))
      .mockResolvedValueOnce("recovered");
    await expect(withCommanderMintLock("cmd-3", fn)).rejects.toThrow("chain blip");
    await expect(withCommanderMintLock("cmd-3", fn)).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("separates distinct commanders (different keys mint independently)", async () => {
    const fn = vi.fn(async (id: string) => `asa-${id}`);
    const [a, b] = await Promise.all([
      withCommanderMintLock("cmd-A", () => fn("A")),
      withCommanderMintLock("cmd-B", () => fn("B")),
    ]);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(a).toBe("asa-A");
    expect(b).toBe("asa-B");
  });
});
