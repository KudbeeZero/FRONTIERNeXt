/**
 * Guards the wallet-status derivation that fixes the "connect screen flashes up
 * then disappears" bug on the live /game page.
 *
 * Root cause it guards against: the provider used to flip out of "restoring" on
 * a blind 800ms timer, independent of whether use-wallet had actually finished
 * resuming the saved session. On a slow mobile resume the timer fired first, so
 * the UI briefly reported "disconnected" — flashing the wallet-gate ("connect
 * your wallet") — before the resumed address landed and it snapped to the game.
 *
 * The contract now: while the wallet LIBRARY is still resuming (`libReady ===
 * false`) the status is "restoring", never "disconnected" — so the gate cannot
 * flash before the real session state is known.
 */
import { describe, it, expect } from "vitest";
import { deriveWalletStatus } from "@/contexts/WalletContext";

describe("deriveWalletStatus", () => {
  it("reports 'restoring' while the wallet library is not ready — even when not yet connected (no gate flash)", () => {
    // The regression: a not-ready library with no address must NOT read as
    // "disconnected" (that flashed the connect-gate mid-restore).
    expect(deriveWalletStatus(false, false)).toBe("restoring");
    // Still restoring even if an address has appeared but the lib isn't ready.
    expect(deriveWalletStatus(false, true)).toBe("restoring");
  });

  it("trusts connected/disconnected only once the library is ready", () => {
    expect(deriveWalletStatus(true, true)).toBe("connected");
    expect(deriveWalletStatus(true, false)).toBe("disconnected");
  });
});
