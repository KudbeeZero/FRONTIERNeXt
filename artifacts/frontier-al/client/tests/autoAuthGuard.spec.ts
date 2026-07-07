/**
 * Guards the P1 defense-in-depth fix (2026-07-07): every route used to mount
 * its OWN `<WalletProvider>` instance, so a client-side nav between routes (no
 * full page reload) unmounted and remounted the provider — resetting its
 * per-instance `authAttemptedFor` ref and re-arming a duplicate signature
 * prompt for an address already authenticated on the previous mount. App.tsx
 * now hoists a single shared `<WalletProvider>` so that specific remount no
 * longer happens, but this module-level memory is a second, independent line
 * of defense: even if a future change reintroduces multiple instances, or any
 * other remount occurs, an address already auto-authed this page load won't
 * be re-prompted. It must still reset on an explicit disconnect so a genuine
 * reconnect re-triggers auto-auth exactly once.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  hasAutoAuthed,
  markAutoAuthed,
  clearAutoAuthedAddresses,
} from "@/contexts/WalletContext";

describe("module-level auto-auth guard", () => {
  afterEach(() => clearAutoAuthedAddresses());

  it("reports not-yet-authed for a fresh address", () => {
    expect(hasAutoAuthed("ADDR1")).toBe(false);
  });

  it("remembers an address once marked (simulating a remounted instance)", () => {
    markAutoAuthed("ADDR1");
    expect(hasAutoAuthed("ADDR1")).toBe(true);
  });

  it("tracks multiple addresses independently", () => {
    markAutoAuthed("ADDR1");
    expect(hasAutoAuthed("ADDR1")).toBe(true);
    expect(hasAutoAuthed("ADDR2")).toBe(false);
  });

  it("clearAutoAuthedAddresses (explicit disconnect) resets the memory", () => {
    markAutoAuthed("ADDR1");
    clearAutoAuthedAddresses();
    expect(hasAutoAuthed("ADDR1")).toBe(false);
  });
});
