/**
 * Pins the fix for a real production bug: a player who connected their real
 * wallet, then hit "Disconnect", stayed stuck seeing the DEV/TEST identity —
 * because a lingering dev session (started by `VITE_DEV_AUTOLOGIN` on page
 * load, or the manual Dev/Test button) was never cleared on explicit
 * disconnect. `shouldUseDevIdentity` re-fires on the very next render (wallet
 * status flips to "disconnected", dev session is still active in
 * localStorage) and re-presents the dev identity as "connected" — so
 * Disconnect visibly does nothing, and the player can never get back to a
 * real connect-gate to use their own wallet (and its funds) for purchases.
 */
import { describe, it, expect } from "vitest";
import { shouldEndDevSessionOnDisconnect } from "@/contexts/WalletContext";

describe("shouldEndDevSessionOnDisconnect", () => {
  it("clears the dev session on disconnect when dev mode + a dev session are active (the fix)", () => {
    expect(shouldEndDevSessionOnDisconnect(true, true)).toBe(true);
  });

  it("does nothing when there is no active dev session to clear", () => {
    expect(shouldEndDevSessionOnDisconnect(true, false)).toBe(false);
  });

  it("does nothing when dev mode is off (production build), regardless of session state", () => {
    expect(shouldEndDevSessionOnDisconnect(false, true)).toBe(false);
    expect(shouldEndDevSessionOnDisconnect(false, false)).toBe(false);
  });
});
