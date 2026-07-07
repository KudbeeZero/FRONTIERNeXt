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
 * be re-prompted.
 *
 * Audit finding on PR #210: the first cut only cleared this memory inside the
 * explicit `disconnect()` button handler. But `WalletContext.tsx`'s "reset
 * auth state" effect resets `authAttemptedFor` (the per-instance ref)
 * whenever `activeAddress` drops for ANY reason — not just an explicit
 * disconnect (e.g. the wallet SDK itself transiently dropping and
 * later restoring the same address, a WalletConnect hiccup that
 * self-resumes). Without also clearing THIS memory there, the auto-auth
 * effect would see the ref reset but `hasAutoAuthed()` still true, and
 * silently skip re-authenticating forever — leaving the player
 * unauthenticated to the game server with no recovery short of a manual
 * Disconnect. Fixed: that effect now calls `clearAutoAuthedAddresses()` too,
 * not only `disconnect()`.
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

  it("clearAutoAuthedAddresses resets the memory (explicit disconnect)", () => {
    markAutoAuthed("ADDR1");
    clearAutoAuthedAddresses();
    expect(hasAutoAuthed("ADDR1")).toBe(false);
  });

  it("resets the memory on ANY address drop, not just explicit disconnect (audit fix, PR #210) — a subsequent auto-auth for the same address is not silently skipped", () => {
    // Simulates: address auto-authed, then the wallet SDK drops the address
    // for a non-disconnect reason (e.g. a transient WalletConnect hiccup).
    // WalletContext.tsx's "reset auth state" effect fires clearAutoAuthedAddresses()
    // here, same as it does on an explicit disconnect.
    markAutoAuthed("ADDR1");
    clearAutoAuthedAddresses();
    // The address later reconnects (same or a fresh WalletProvider instance) —
    // hasAutoAuthed must report false so the auto-auth effect fires again,
    // rather than silently leaving the player unauthenticated forever.
    expect(hasAutoAuthed("ADDR1")).toBe(false);
  });
});
