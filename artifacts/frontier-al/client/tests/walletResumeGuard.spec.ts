/**
 * client/tests/walletResumeGuard.spec.ts
 *
 * Regression tests for the app-load resume guard that prevents mobile/QR
 * wallets (Pera, Defly, WalletConnect) from automatically reopening on page
 * reload, while allowing extension wallets (Lute, Kibisis) to passively resume.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  USE_WALLET_STORAGE_KEY,
  WALLET_SESSION_HINT_KEY,
  readUseWalletPersistedState,
  writeUseWalletPersistedState,
  suppressInteractiveWalletResume,
  clearAllWalletSessions,
  isInteractiveWallet,
  isPassiveWallet,
} from "@/lib/walletResumeGuard";

function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
}

function setPersistedState(
  storage: Storage,
  state: {
    wallets: Record<string, { accounts: { address: string }[]; activeAccount: null }>;
    activeWallet: string | null;
    activeNetwork: string;
  }
) {
  storage.setItem(USE_WALLET_STORAGE_KEY, JSON.stringify(state));
}

describe("wallet resume guard", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it("identifies interactive and passive wallet families", () => {
    expect(isInteractiveWallet("pera")).toBe(true);
    expect(isInteractiveWallet("defly")).toBe(true);
    expect(isInteractiveWallet("walletconnect")).toBe(true);
    expect(isInteractiveWallet("walletconnect:pera")).toBe(true);
    expect(isInteractiveWallet("lute")).toBe(false);
    expect(isInteractiveWallet("kibisis")).toBe(false);

    expect(isPassiveWallet("lute")).toBe(true);
    expect(isPassiveWallet("kibisis")).toBe(true);
    expect(isPassiveWallet("pera")).toBe(false);
  });

  it("clears only interactive wallets from persisted state before manager init", () => {
    setPersistedState(storage, {
      wallets: {
        pera: { accounts: [{ address: "ADDR1" }], activeAccount: null },
        lute: { accounts: [{ address: "ADDR2" }], activeAccount: null },
      },
      activeWallet: "pera",
      activeNetwork: "testnet",
    });

    const result = suppressInteractiveWalletResume(storage);

    expect(result.cleared).toEqual(["pera"]);
    expect(result.kept).toEqual(["lute"]);
    expect(result.activeWasCleared).toBe(true);

    const remaining = readUseWalletPersistedState(storage);
    expect(remaining?.wallets).not.toHaveProperty("pera");
    expect(remaining?.wallets).toHaveProperty("lute");
    expect(remaining?.activeWallet).toBeNull();
  });

  it("keeps extension wallet sessions and activeWallet when it is passive", () => {
    setPersistedState(storage, {
      wallets: {
        lute: { accounts: [{ address: "ADDR" }], activeAccount: null },
      },
      activeWallet: "lute",
      activeNetwork: "testnet",
    });

    const result = suppressInteractiveWalletResume(storage);

    expect(result.cleared).toEqual([]);
    expect(result.kept).toEqual(["lute"]);
    expect(result.activeWasCleared).toBe(false);

    const remaining = readUseWalletPersistedState(storage);
    expect(remaining?.activeWallet).toBe("lute");
  });

  it("clears the app session hint when the active wallet was interactive", () => {
    storage.setItem(WALLET_SESSION_HINT_KEY, "1");
    setPersistedState(storage, {
      wallets: {
        pera: { accounts: [{ address: "ADDR" }], activeAccount: null },
      },
      activeWallet: "pera",
      activeNetwork: "testnet",
    });

    suppressInteractiveWalletResume(storage);

    expect(storage.getItem(WALLET_SESSION_HINT_KEY)).toBeNull();
  });

  it("leaves the app session hint alone when the active wallet was passive", () => {
    storage.setItem(WALLET_SESSION_HINT_KEY, "1");
    setPersistedState(storage, {
      wallets: {
        lute: { accounts: [{ address: "ADDR" }], activeAccount: null },
      },
      activeWallet: "lute",
      activeNetwork: "testnet",
    });

    suppressInteractiveWalletResume(storage);

    expect(storage.getItem(WALLET_SESSION_HINT_KEY)).toBe("1");
  });

  it("handles missing persisted state gracefully", () => {
    const result = suppressInteractiveWalletResume(storage);
    expect(result.cleared).toEqual([]);
    expect(result.kept).toEqual([]);
    expect(result.activeWasCleared).toBe(false);
  });

  it("clearAllWalletSessions removes use-wallet state and app hint", () => {
    storage.setItem(WALLET_SESSION_HINT_KEY, "1");
    setPersistedState(storage, {
      wallets: { pera: { accounts: [{ address: "ADDR" }], activeAccount: null } },
      activeWallet: "pera",
      activeNetwork: "testnet",
    });

    clearAllWalletSessions(storage);

    expect(storage.getItem(USE_WALLET_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(WALLET_SESSION_HINT_KEY)).toBeNull();
  });

  it("writeUseWalletPersistedState round-trips correctly", () => {
    const state = {
      wallets: { lute: { accounts: [{ address: "ADDR" }], activeAccount: null } },
      activeWallet: "lute" as const,
      activeNetwork: "testnet",
    };
    writeUseWalletPersistedState(state, storage);
    expect(readUseWalletPersistedState(storage)).toEqual(state);
  });
});
