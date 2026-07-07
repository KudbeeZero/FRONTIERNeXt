import { WALLET_SESSION_HINT_KEY, WALLET_TYPE_KEY, WALLET_ADDRESS_KEY } from "@/contexts/WalletContext";
import { clearAuthToken } from "@/lib/authToken";

/**
 * Recovery for the wallet-popup-storm bug (owner report, 2026-07-07: "8+ Pera
 * / WalletConnect popups back-to-back on page load").
 *
 * Root cause: `@txnlab/use-wallet-react`'s `WalletProvider` calls
 * `manager.resumeSessions()` exactly once per app mount (guarded by its own
 * ref — confirmed by reading the SDK's dist output, this is NOT a React
 * re-render bug in this app's code). For each configured wallet,
 * `resumeSession()` only proceeds past an early `if (!walletState) return`
 * guard when THIS app's own persisted store — `@txnlab/use-wallet`'s
 * `localStorage["@txnlab/use-wallet:v4"]` — already has a recorded session
 * for that wallet. When it does, Pera's wrapper calls the underlying
 * `PeraWalletConnect.reconnectSession()` — and if a browser has accumulated
 * multiple stale/abandoned WalletConnect pairing topics underneath (crashed
 * connects, cross-origin hops, abandoned tabs — see `shouldPurgeBeforeConnect`'s
 * doc comment for the same family of bug on the manual connect path), Pera
 * resurfaces EVERY one as its own popup — a storm that fires on EVERY page
 * load, before the player can click anything, with zero signal in this app's
 * own UI (resumeSessions() runs entirely inside the SDK's provider, invisible
 * to WalletContext's `error` state).
 *
 * There is no public API on `WalletManager` to selectively forget a stuck
 * session (`disconnect()` only acts on wallets already `isConnected`, which a
 * hung resume may never reach). Clearing use-wallet's own persisted key is
 * sufficient to stop `resumeSession()` from ever calling into Pera's
 * `reconnectSession()` again — it doesn't require reaching into
 * WalletConnect's own low-level pairing storage. The player just reconnects
 * normally afterward; `WalletContext`'s own `connect()` already purges any
 * stale pairing for the wallet they pick (`shouldPurgeBeforeConnect`).
 *
 * Honest gap: `"@txnlab/use-wallet:v4"` is an internal storage key, not a
 * documented public API of the SDK — coupled to the installed version
 * (4.6.0). If `@txnlab/use-wallet` is ever upgraded, re-verify this key
 * still matches (search its `dist/index.cjs` for `LOCAL_STORAGE_KEY =`).
 */
export const WALLET_RESET_STORAGE_KEYS = [
  "@txnlab/use-wallet:v4",
  WALLET_TYPE_KEY,
  WALLET_ADDRESS_KEY,
  WALLET_SESSION_HINT_KEY,
] as const;

interface RemovableStorage {
  removeItem(key: string): void;
}

function defaultStorage(): RemovableStorage | undefined {
  return typeof window !== "undefined" ? window.localStorage : undefined;
}

/** Clears every storage key involved in the wallet-popup-storm recovery. Best-effort per key. */
export function clearWalletStorage(storage: RemovableStorage | undefined = defaultStorage()): void {
  for (const key of WALLET_RESET_STORAGE_KEYS) {
    try {
      storage?.removeItem(key);
    } catch {
      /* storage unavailable (private mode) — best-effort */
    }
  }
  clearAuthToken();
}

/** Full recovery: clear storage, then hard-reload so the SDK re-initializes clean. */
export function resetWalletConnection(): void {
  clearWalletStorage();
  window.location.reload();
}
