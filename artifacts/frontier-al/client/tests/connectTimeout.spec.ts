/**
 * Guards the connect-hang safety net: a wallet connect that never surfaces a
 * modal (the desktop "Pera spins forever, nothing opens" bug) must become a
 * recoverable timeout error instead of an infinite spinner — while a connect
 * that settles in time passes through untouched (real QR scans are slow but do
 * complete).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  promiseWithTimeout,
  CONNECT_TIMEOUT_MESSAGE,
} from "@/contexts/WalletContext";

describe("promiseWithTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rejects with CONNECT_TIMEOUT once the deadline passes (no infinite hang)", async () => {
    // A connect that never resolves — the hang we are guarding against.
    const neverSettles = new Promise<string>(() => {});
    const raced = promiseWithTimeout(neverSettles, 1000);
    const assertion = expect(raced).rejects.toThrow(CONNECT_TIMEOUT_MESSAGE);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("passes a value through when it settles before the deadline", async () => {
    const fast = Promise.resolve("connected");
    const raced = promiseWithTimeout(fast, 1000);
    await vi.advanceTimersByTimeAsync(0);
    await expect(raced).resolves.toBe("connected");
  });

  it("propagates the underlying rejection (e.g. user cancel) unchanged", async () => {
    const rejected = Promise.reject(new Error("user closed"));
    await expect(promiseWithTimeout(rejected, 1000)).rejects.toThrow("user closed");
  });
});
