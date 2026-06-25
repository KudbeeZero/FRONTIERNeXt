/**
 * Pins the fail-closed gate for zero-click dev auto-login (shouldDevAutoLogin).
 *
 * The property under guard: auto-login may fire ONLY when both build flags
 * (VITE_DEV_MODE + VITE_DEV_AUTOLOGIN) are on AND no dev session is already
 * active. If either flag is off it must never fire — so a production build
 * (neither flag set) can never silently auto-enter the game. The single-fire
 * guard (sessionAlreadyActive) stops it from re-triggering after it has already
 * signed the test player in. (The server's DEV_LOGIN_ENABLED 403 is a separate,
 * independent gate tested server-side.)
 */
import { describe, it, expect } from "vitest";
import { shouldDevAutoLogin } from "@/lib/devSession";

describe("shouldDevAutoLogin", () => {
  it("fires only when both flags are on and no session is active yet", () => {
    expect(shouldDevAutoLogin(true, true, false)).toBe(true);
  });

  it("never fires once a dev session is already active (single-fire, no loop)", () => {
    expect(shouldDevAutoLogin(true, true, true)).toBe(false);
  });

  it("never fires when auto-login is off, even in dev mode", () => {
    expect(shouldDevAutoLogin(true, false, false)).toBe(false);
  });

  it("never fires when dev mode is off (production build) — both flags required", () => {
    expect(shouldDevAutoLogin(false, true, false)).toBe(false);
    expect(shouldDevAutoLogin(false, false, false)).toBe(false);
    // even with auto-login requested, dev mode off keeps it closed
    expect(shouldDevAutoLogin(false, true, true)).toBe(false);
  });
});
