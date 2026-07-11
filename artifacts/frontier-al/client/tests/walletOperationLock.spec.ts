/**
 * client/tests/walletOperationLock.spec.ts
 *
 * Regression tests for the application-wide signing operation lock. Ensures
 * rapid clicks on a wallet action dedupe to a single signing request, while
 * concurrent *different* operations are rejected rather than stacking popups.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { withWalletOperation, isWalletOperationInProgress, resetWalletOperationLock } from "@/lib/walletOperationLock";

describe("wallet operation lock", () => {
  beforeEach(() => {
    resetWalletOperationLock();
  });
  it("returns the same promise for concurrent calls with the same id", async () => {
    let resolve: (value: string) => void = () => {};
    const runner = vi.fn(() => new Promise<string>((r) => { resolve = r; }));

    const p1 = withWalletOperation("op:1", runner);
    const p2 = withWalletOperation("op:1", runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);
    expect(isWalletOperationInProgress()).toBe(true);

    resolve("tx-id");
    await expect(p1).resolves.toBe("tx-id");
    await expect(p2).resolves.toBe("tx-id");
    expect(isWalletOperationInProgress()).toBe(false);
  });

  it("rejects concurrent calls with a different id", async () => {
    let resolve: () => void = () => {};
    const runner = vi.fn(() => new Promise<void>((r) => { resolve = r; }));

    const p1 = withWalletOperation("op:a", runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(() => withWalletOperation("op:b", runner)).toThrow(/already in progress/);

    resolve();
    await p1;
    expect(isWalletOperationInProgress()).toBe(false);
  });

  it("releases the lock after rejection so a new operation can run", async () => {
    const runner = vi.fn(() => Promise.reject(new Error("user rejected")));

    await expect(withWalletOperation("op:x", runner)).rejects.toThrow("user rejected");
    expect(isWalletOperationInProgress()).toBe(false);

    const runner2 = vi.fn(() => Promise.resolve("ok"));
    await expect(withWalletOperation("op:x", runner2)).resolves.toBe("ok");
    expect(runner2).toHaveBeenCalledTimes(1);
  });

  it("ten rapid clicks still invoke the runner once", async () => {
    const runner = vi.fn(() => Promise.resolve("tx-id"));

    const promises = Array.from({ length: 10 }, () => withWalletOperation("op:rapid", runner));
    const results = await Promise.all(promises);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r === "tx-id")).toBe(true);
  });
});
