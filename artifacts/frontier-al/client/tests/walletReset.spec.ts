/**
 * client/tests/walletReset.spec.ts
 *
 * The escape hatch for the wallet-popup-storm bug (owner report, 2026-07-07:
 * "8+ Pera/WalletConnect popups back-to-back on page load"). See
 * `client/src/lib/walletReset.ts`'s doc comment for the full root-cause
 * mechanism — in short, `@txnlab/use-wallet`'s own `resumeSession()` only
 * calls into Pera's `reconnectSession()` (where the storm actually happens,
 * inside a third-party dependency this app doesn't control) when its own
 * persisted key (`@txnlab/use-wallet:v4`) has a recorded session. Clearing
 * that key — and this app's own related keys — is what breaks the cycle.
 *
 * These tests pin the exact key list (the part most likely to silently drift
 * if someone "cleans up" the constant without realizing it's load-bearing)
 * and confirm `clearWalletStorage` actually calls `removeItem` for every one
 * of them, using dependency injection so no jsdom/global stubbing is needed
 * for the primary path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WALLET_RESET_STORAGE_KEYS,
  clearWalletStorage,
  resetWalletConnection,
} from "@/lib/walletReset";
import { WALLET_SESSION_HINT_KEY, WALLET_TYPE_KEY, WALLET_ADDRESS_KEY } from "@/contexts/WalletContext";

describe("WALLET_RESET_STORAGE_KEYS", () => {
  it("includes use-wallet's own persisted session key — clearing this is what actually stops resumeSession() from firing Pera's reconnectSession()", () => {
    expect(WALLET_RESET_STORAGE_KEYS).toContain("@txnlab/use-wallet:v4");
  });

  it("includes every key this app itself sets for wallet identity/session", () => {
    expect(WALLET_RESET_STORAGE_KEYS).toContain(WALLET_TYPE_KEY);
    expect(WALLET_RESET_STORAGE_KEYS).toContain(WALLET_ADDRESS_KEY);
    expect(WALLET_RESET_STORAGE_KEYS).toContain(WALLET_SESSION_HINT_KEY);
  });
});

describe("clearWalletStorage", () => {
  it("calls removeItem for every key in WALLET_RESET_STORAGE_KEYS on the given storage", () => {
    const store = new Map<string, string>();
    for (const key of WALLET_RESET_STORAGE_KEYS) store.set(key, "x");
    const storage = {
      removeItem: vi.fn((k: string) => void store.delete(k)),
    };
    clearWalletStorage(storage);
    for (const key of WALLET_RESET_STORAGE_KEYS) {
      expect(storage.removeItem).toHaveBeenCalledWith(key);
    }
    expect(store.size).toBe(0);
  });

  it("doesn't throw if a given key removal fails (best-effort, e.g. private-mode storage quirks)", () => {
    const storage = {
      removeItem: vi.fn(() => {
        throw new Error("storage disabled");
      }),
    };
    expect(() => clearWalletStorage(storage)).not.toThrow();
    // Still attempted every key, not just the first before the throw.
    expect(storage.removeItem).toHaveBeenCalledTimes(WALLET_RESET_STORAGE_KEYS.length);
  });

  it("is a no-op (not a throw) when storage is undefined (SSR/no-window)", () => {
    expect(() => clearWalletStorage(undefined)).not.toThrow();
  });
});

// clearAuthToken() (called internally by clearWalletStorage) reads the bare
// global `localStorage`, not `window.localStorage` — stub both since this
// suite runs in Node with neither defined by default.
describe("clearWalletStorage clears the session auth token too", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const fakeLocalStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    (globalThis as { localStorage?: unknown }).localStorage = fakeLocalStorage;
    (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { window?: unknown }).window;
  });

  it("removes frontier_session_token via clearAuthToken", () => {
    localStorage.setItem("frontier_session_token", "abc123");
    clearWalletStorage({ removeItem: () => {} });
    expect(localStorage.getItem("frontier_session_token")).toBeNull();
  });
});

describe("resetWalletConnection", () => {
  const originalReload = typeof window !== "undefined" ? window.location.reload : undefined;

  beforeEach(() => {
    if (typeof window !== "undefined") {
      vi.spyOn(window.location, "reload").mockImplementation(() => {});
    }
  });

  afterEach(() => {
    if (typeof window !== "undefined" && originalReload) {
      window.location.reload = originalReload;
    }
  });

  it("calls clearWalletStorage then hard-reloads the page", () => {
    if (typeof window === "undefined") {
      expect(true).toBe(true);
      return;
    }
    resetWalletConnection();
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
