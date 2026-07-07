/**
 * Guards the P3 audit finding (2026-07-07): purging a wallet's half-open
 * session before dialing a fresh connect must never fire on a wallet the SDK
 * still considers `isActive` — that's the signal a session resume may still
 * be completing in the background. The bounded reconnect grace gives up on
 * the LOCAL "restoring" spinner after 3s and shows the Connect button again,
 * but doesn't cancel the underlying resume promise; purging in that window
 * can tear down a resume that was about to succeed. Only a wallet that is
 * BOTH disconnected and inactive is safely assumed abandoned — the exact
 * "leftover pairing" case #175/#204 purges for.
 */
import { describe, it, expect } from "vitest";
import { shouldPurgeBeforeConnect } from "@/contexts/WalletContext";

describe("shouldPurgeBeforeConnect", () => {
  it("purges a wallet that is neither connected nor active (the #175 abandoned-pairing case)", () => {
    expect(shouldPurgeBeforeConnect({ isConnected: false, isActive: false })).toBe(true);
  });

  it("does NOT purge a wallet the SDK still marks active (a resume may still be in flight — P3)", () => {
    expect(shouldPurgeBeforeConnect({ isConnected: false, isActive: true })).toBe(false);
  });

  it("never purges an already-connected wallet (never drop a live session)", () => {
    expect(shouldPurgeBeforeConnect({ isConnected: true, isActive: true })).toBe(false);
    expect(shouldPurgeBeforeConnect({ isConnected: true, isActive: false })).toBe(false);
  });

  it("no-ops safely when there is no wallet", () => {
    expect(shouldPurgeBeforeConnect(undefined)).toBe(false);
    expect(shouldPurgeBeforeConnect(null)).toBe(false);
  });

  it("treats missing isActive/isConnected as falsy (still purges — matches pre-fix default behavior)", () => {
    expect(shouldPurgeBeforeConnect({})).toBe(true);
  });
});
