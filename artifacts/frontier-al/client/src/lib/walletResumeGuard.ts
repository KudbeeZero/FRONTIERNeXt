import { WALLET_SESSION_HINT_KEY } from "@/contexts/WalletContext";

export { WALLET_SESSION_HINT_KEY };

/**
 * Internal storage key used by `@txnlab/use-wallet` v4 to persist session state.
 * Coupled to the installed SDK version (4.6.0). See `walletReset.ts` for the
 * same dependency and upgrade note.
 */
export const USE_WALLET_STORAGE_KEY = "@txnlab/use-wallet:v4";

/**
 * Wallets that require an interactive popup/QR-scan to resume a saved session.
 * Allowing these to auto-resume on app load opens the wallet window(s)
 * automatically, which violates the "reload must never auto-open the wallet"
 * guarantee and is the root cause of the Pera/WalletConnect popup storm.
 */
export const INTERACTIVE_WALLET_IDS = new Set([
  "pera",
  "defly",
  "walletconnect",
]);

/**
 * Wallets that can passively resume without opening a popup (browser-extension
 * wallets). Extension wallets can check `client.isConnected` during resume and
 * either restore silently or fail cleanly without surfacing UI.
 */
export const PASSIVE_WALLET_IDS = new Set(["lute", "kibisis"]);

interface PersistedWalletState {
  accounts: Array<{ address: string; name?: string }>;
  activeAccount: { address: string; name?: string } | null;
}

interface PersistedState {
  wallets: Record<string, PersistedWalletState>;
  activeWallet: string | null;
  activeNetwork: string;
  customNetworkConfigs?: Record<string, unknown>;
}

function safeGetStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : undefined;
  } catch {
    return undefined;
  }
}

function getStorage(storage?: Storage): Storage | undefined {
  return storage ?? safeGetStorage();
}

export function readUseWalletPersistedState(storage?: Storage): PersistedState | null {
  const target = getStorage(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(USE_WALLET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("wallets" in parsed)) {
      return null;
    }
    return parsed as PersistedState;
  } catch {
    return null;
  }
}

export function writeUseWalletPersistedState(state: PersistedState | null, storage?: Storage): void {
  const target = getStorage(storage);
  if (!target) return;
  try {
    if (state === null) {
      target.removeItem(USE_WALLET_STORAGE_KEY);
    } else {
      target.setItem(USE_WALLET_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    /* storage unavailable (private mode) — best-effort */
  }
}

function baseWalletId(walletId: string): string {
  return walletId.split(":")[0] ?? walletId;
}

export function isInteractiveWallet(walletId: string): boolean {
  return INTERACTIVE_WALLET_IDS.has(baseWalletId(walletId));
}

export function isPassiveWallet(walletId: string): boolean {
  return PASSIVE_WALLET_IDS.has(baseWalletId(walletId));
}

export interface SuppressResult {
  /** Wallet keys removed from persisted state because they require interactive resume. */
  cleared: string[];
  /** Wallet keys kept because they can resume passively. */
  kept: string[];
  /** True iff the previously-active wallet was cleared. */
  activeWasCleared: boolean;
}

/**
 * Prevent mobile/QR wallets from auto-resuming on app load and opening wallet
 * popups. Extension wallets are allowed to passively resume because they can
 * verify the extension is still connected without surfacing a popup.
 *
 * Must run BEFORE `new WalletManager(...)` reads persisted state in
 * `createWalletManager()`.
 *
 * Returns the wallet keys that were cleared/kept so callers can log or update UI.
 */
export function suppressInteractiveWalletResume(storage?: Storage): SuppressResult {
  const resolvedStorage = getStorage(storage);
  const state = readUseWalletPersistedState(resolvedStorage);
  if (!state) {
    return { cleared: [], kept: [], activeWasCleared: false };
  }

  const cleared: string[] = [];
  const kept: string[] = [];
  const nextWallets: Record<string, PersistedWalletState> = {};

  for (const [walletId, walletState] of Object.entries(state.wallets)) {
    if (isInteractiveWallet(walletId)) {
      cleared.push(walletId);
    } else {
      nextWallets[walletId] = walletState;
      kept.push(walletId);
    }
  }

  if (cleared.length === 0) {
    return { cleared: [], kept, activeWasCleared: false };
  }

  const activeWasCleared = state.activeWallet ? cleared.includes(state.activeWallet) : false;
  const nextActiveWallet = activeWasCleared
    ? null
    : state.activeWallet && state.activeWallet in nextWallets
      ? state.activeWallet
      : null;

  const nextState: PersistedState = {
    ...state,
    wallets: nextWallets,
    activeWallet: nextActiveWallet,
  };

  writeUseWalletPersistedState(nextState, resolvedStorage);

  // Also clear our own session hint whenever we drop an interactive wallet.
  // Otherwise the UI would show "Restoring..." for 3s even though we
  // deliberately chose not to resume that session.
  if (resolvedStorage && cleared.length > 0) {
    try {
      resolvedStorage.removeItem(WALLET_SESSION_HINT_KEY);
    } catch {
      /* best-effort */
    }
  }

  return { cleared, kept, activeWasCleared };
}

/**
 * Full recovery: clear every wallet session key so the next load starts
 * completely clean. Used by the "Trouble connecting? Reset" escape hatch.
 */
export function clearAllWalletSessions(storage?: Storage): void {
  const resolvedStorage = getStorage(storage);
  writeUseWalletPersistedState(null, resolvedStorage);
  if (resolvedStorage) {
    try {
      resolvedStorage.removeItem(WALLET_SESSION_HINT_KEY);
    } catch {
      /* best-effort */
    }
  }
}
