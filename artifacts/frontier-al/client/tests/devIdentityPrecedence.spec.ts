/**
 * Guards the precedence between the DEV / TEST identity and a real connected
 * wallet, fixing the bug where a player who connected their real Lute wallet on
 * the landing page entered /game as "DEV-TEST-COMMANDER" (0 ALGO) instead.
 *
 * Root cause: the dev fallback fired on `!isConnected`, which is briefly true
 * during the post-navigation wallet RESUME on /game. With a lingering dev
 * session in localStorage (e.g. from VITE_DEV_AUTOLOGIN), the dev identity
 * shadowed the real wallet. The contract now: the dev identity is a fallback
 * ONLY when the wallet is genuinely "disconnected" — never while "restoring" or
 * "connected" — so a real wallet always wins.
 */
import { describe, it, expect } from "vitest";
import { shouldUseDevIdentity, devIdentityAuthVersion } from "@/contexts/WalletContext";

describe("shouldUseDevIdentity", () => {
  it("shows the dev identity only when DEV_MODE + a dev session + wallet disconnected", () => {
    expect(shouldUseDevIdentity(true, "disconnected", true)).toBe(true);
  });

  it("NEVER shadows a connected real wallet (the reported bug)", () => {
    expect(shouldUseDevIdentity(true, "connected", true)).toBe(false);
  });

  it("does NOT shadow a wallet that is still restoring (the /game resume gap)", () => {
    // This is the exact window the old `!isConnected` check got wrong.
    expect(shouldUseDevIdentity(true, "restoring", true)).toBe(false);
  });

  it("stays off when there is no dev session", () => {
    expect(shouldUseDevIdentity(true, "disconnected", false)).toBe(false);
  });

  it("stays off when DEV_MODE is not enabled, regardless of session/status", () => {
    expect(shouldUseDevIdentity(false, "disconnected", true)).toBe(false);
    expect(shouldUseDevIdentity(false, "connected", true)).toBe(false);
  });
});

// W2-follow-up (2026-07-07): a dev/test session gets its session token from
// POST /api/dev/quick-auth, never from the real wallet's authenticate() —
// which is the only place `authVersion` used to get bumped. Left at its
// initial 0, `useGameSocket`'s `!authTrigger` gate silently blocked the live
// WebSocket (weapon fire, battle resolution, chain-health) for every dev
// session, forever, even though a valid token existed. Confirmed live in a
// headless run: 3 weapon fires resolved correctly server-side but never
// rendered on screen because the socket never opened.
describe("devIdentityAuthVersion", () => {
  it("forces a truthy trigger when the real context's authVersion is still the initial 0", () => {
    expect(devIdentityAuthVersion(0)).toBe(1);
  });

  it("preserves a real, already-bumped authVersion instead of resetting it", () => {
    expect(devIdentityAuthVersion(3)).toBe(3);
  });
});
