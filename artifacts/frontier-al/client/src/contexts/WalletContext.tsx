import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { DEV_MODE, devSessionActive, devSessionAddress } from "@/lib/devSession";
import { useWallet as useWalletLib } from "@txnlab/use-wallet-react";
import {
  getAccountBalance,
  formatAddress,
  fetchBlockchainStatus,
  registerWalletSigner,
} from "@/lib/algorand";
import { authenticateWallet, logoutWallet } from "@/lib/auth";

type WalletStatus = "restoring" | "connected" | "disconnected";

export interface WalletInfo {
  id: string;
  name: string;
  icon: string;
  isConnected: boolean;
  isActive: boolean;
}

interface WalletContextValue {
  isConnected: boolean;
  walletStatus: WalletStatus;
  address: string | null;
  displayAddress: string | null;
  balance: number;
  isConnecting: boolean;
  error: string | null;
  walletType: string | null;
  signerReady: boolean;
  blockchainReady: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  /** Bumps on every successful auth — used to (re)trigger the game socket with a fresh token. */
  authVersion: number;
  /** Called when the server rejects our session token (WS 1008): re-auth once to self-heal. */
  onSessionRejected: () => void;
  availableWallets: WalletInfo[];
  connect: (walletId: string) => Promise<void>;
  disconnect: () => void;
  authenticate: () => Promise<void>;
  clearError: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Derive the coarse wallet status the UI gates on.
 *
 * Two windows used to flash the connect-gate up before the real session landed;
 * both are closed here:
 *
 *  1. **Library not ready** (`libReady === false`) — use-wallet is still
 *     resuming. Report "restoring", never "disconnected".
 *  2. **Post-ready reconnect gap** (`libReady === true`, not yet connected, but
 *     `reconnectPending === true`) — use-wallet has flipped ready, yet a saved
 *     Pera/WalletConnect session is still repopulating `activeAddress` a tick
 *     later. Reporting "disconnected" in this gap is exactly the "spinner →
 *     connect screen → game" flash the owner saw. Keep reporting "restoring"
 *     until the address lands (or the bounded grace in the provider gives up).
 *
 * Genuinely-disconnected visitors (ready, not connected, nothing pending) get
 * "disconnected" immediately — so a brand-new player still sees the connect gate
 * without delay.
 */
export function deriveWalletStatus(
  libReady: boolean,
  isConnected: boolean,
  reconnectPending = false,
): WalletStatus {
  if (!libReady) return "restoring";
  if (isConnected) return "connected";
  if (reconnectPending) return "restoring";
  return "disconnected";
}

/**
 * localStorage flag remembering that THIS browser had a wallet connected on a
 * previous load. Used only as a hint to hold the "restoring" spinner across the
 * post-ready reconnect gap (see {@link deriveWalletStatus}) instead of flashing
 * the connect-gate. Written when an address is active; cleared only on an
 * explicit user disconnect.
 */
export const WALLET_SESSION_HINT_KEY = "frontier_wallet_session";

/**
 * How long to keep showing "restoring" after the library is ready while we wait
 * for a saved session to repopulate the address. Generous enough for a real
 * WalletConnect resume to land, finite so a session that will NEVER resume falls
 * through to the connect-gate instead of spinning forever. NOT the old cosmetic
 * blind timer — it only applies when there is concrete evidence (active wallet
 * or persisted hint) that a reconnect is actually expected, and it is
 * short-circuited the instant the address arrives.
 */
export const RECONNECT_GRACE_MS = 3_000;

/** Read the persisted "we had a session last load" hint (SSR/test safe). */
export function readWalletSessionHint(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage?.getItem(WALLET_SESSION_HINT_KEY);
  } catch {
    return false;
  }
}

/** Thrown when a wallet connect attempt exceeds {@link CONNECT_TIMEOUT_MS}. */
export const CONNECT_TIMEOUT_MESSAGE = "CONNECT_TIMEOUT";
/**
 * How long to wait for `wallet.connect()` before giving up. Generous enough for
 * a real Pera QR scan (grab phone, scan, approve) but finite so a connect that
 * never surfaces a modal (the desktop "spins forever, nothing opens" hang)
 * becomes a recoverable "try again" error instead of an infinite spinner.
 */
export const CONNECT_TIMEOUT_MS = 90_000;

/**
 * Race a promise against a timeout. Rejects with {@link CONNECT_TIMEOUT_MESSAGE}
 * if `p` has not settled within `ms`. The timer is always cleared so it can't
 * leak or fire after the promise settles.
 */
export function promiseWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(CONNECT_TIMEOUT_MESSAGE)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Best-effort purge of a half-open wallet session left behind by a failed or
 * aborted connect, so stale WalletConnect pairings don't accumulate and
 * resurface as duplicate popups. Swallows every error — this is cleanup, never
 * the main path. Returns true iff a disconnect was actually attempted.
 */
export async function purgeStaleSession(
  wallet: { disconnect?: () => unknown } | undefined | null,
): Promise<boolean> {
  if (!wallet || typeof wallet.disconnect !== "function") return false;
  try {
    await wallet.disconnect();
  } catch {
    /* ignore — best-effort cleanup */
  }
  return true;
}

interface WalletProviderProps {
  children: ReactNode;
  /**
   * When true, automatically prompt for the one wallet signature once a wallet is
   * connected. Only the in-game route opts in — so players are NOT asked to log
   * into the wallet on the landing / info pages, only when they enter the game.
   */
  autoAuth?: boolean;
}

// Broad set of strings that indicate user-cancelled / modal-dismissed — not real errors.
function isUserCancellation(msg: string, data?: { type?: string }): boolean {
  if (data?.type === "CONNECT_MODAL_CLOSED") return true;
  const lower = msg.toLowerCase();
  return (
    lower.includes("cancel") ||
    lower.includes("reject") ||
    lower.includes("denied") ||
    lower.includes("closed") ||
    lower.includes("dismissed") ||
    lower.includes("user abort") ||
    lower.includes("user closed") ||
    lower.includes("modal") ||
    lower.includes("declined")
  );
}

// Map raw SDK errors to user-friendly messages.
function friendlyErrorMessage(walletId: string, msg: string): string {
  if (msg === CONNECT_TIMEOUT_MESSAGE) {
    return walletId === "pera" || walletId === "defly"
      ? "The wallet didn't respond. Make sure the QR / wallet popup opened, then try again."
      : "The wallet didn't respond — please try again.";
  }
  const lower = msg.toLowerCase();
  const isExtensionWallet = walletId === "lute" || walletId === "kibisis";
  const isNotInstalled =
    lower.includes("not installed") ||
    lower.includes("not found") ||
    lower.includes("not available") ||
    lower.includes("is not defined") ||
    lower.includes("cannot read") ||
    lower.includes("undefined") ||
    lower.includes("extension") ||
    lower.includes("failed to load") ||
    lower.includes("import") ||
    msg === "" || msg === "undefined";

  if (isExtensionWallet && isNotInstalled) {
    if (walletId === "lute") {
      return "LUTE extension not detected. Install it from the Chrome Web Store, then reload this page.";
    }
    if (walletId === "kibisis") {
      return "Kibisis extension not detected. Install it for Chrome or Firefox, then reload this page.";
    }
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
    return "Connection timed out — check your internet and try again.";
  }
  return msg || "Connection failed — please try again.";
}

export function WalletProvider({ children, autoAuth = false }: WalletProviderProps) {
  // `isReady` flips true once use-wallet has finished resuming any saved session
  // from storage. We gate "restoring" on THIS — not a blind timer — so the UI
  // never snaps to the "connect your wallet" gate before the real restore lands
  // (a slow mobile resume used to flash the connect screen, then the game).
  const { wallets, activeAddress, signTransactions, isReady: walletLibReady } = useWalletLib();

  const [balance, setBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockchainReady, setBlockchainReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Bumps on each successful auth so the game socket reconnects with the fresh token.
  const [authVersion, setAuthVersion] = useState(0);
  const authAttemptedFor = useRef<string | null>(null);
  const isReconnecting = useRef(false);

  // Did THIS browser have a wallet connected last load? If so we expect an async
  // resume to land shortly, so we hold the "restoring" spinner across the
  // post-ready reconnect gap instead of flashing the connect-gate.
  const hadSessionHint = useRef<boolean>(readWalletSessionHint());
  // Flips true once the bounded reconnect grace elapses, so a session that will
  // never resume falls through to the gate instead of spinning forever.
  const [restoreGraceElapsed, setRestoreGraceElapsed] = useState(false);

  useEffect(() => {
    fetchBlockchainStatus().then((status) => {
      setBlockchainReady(status.ready || !!status.adminAddress);
    });
  }, []);

  // Register the signer whenever the active wallet changes
  useEffect(() => {
    if (activeAddress && signTransactions) {
      registerWalletSigner(async (txns) => {
        const results = await signTransactions([txns]);
        return results.map((r) => (r === null ? new Uint8Array() : r));
      });
      localStorage.setItem("frontier_wallet_type", "use-wallet");
      localStorage.setItem("frontier_wallet_address", activeAddress);
      // Clear any stale error once connected
      setError(null);
    } else {
      registerWalletSigner(null);
      if (!activeAddress) {
        localStorage.removeItem("frontier_wallet_type");
        localStorage.removeItem("frontier_wallet_address");
      }
    }
  }, [activeAddress, signTransactions]);

  // Remember that this browser had a live session, so the NEXT load holds the
  // restoring spinner across the reconnect gap instead of flashing the gate.
  // Deliberately NOT cleared when activeAddress drops to null (that transient
  // drop IS the reconnect gap we're papering over) — only an explicit user
  // disconnect clears it.
  useEffect(() => {
    if (!activeAddress) return;
    hadSessionHint.current = true;
    try {
      window.localStorage?.setItem(WALLET_SESSION_HINT_KEY, "1");
    } catch {
      /* storage unavailable (private mode / SSR) — hint is best-effort */
    }
  }, [activeAddress]);

  // ── Wallet-signature authentication ─────────────────────────────────────────
  // Prove control of the connected wallet to the server and obtain a session
  // token. One signature prompt per connected address.
  const authenticate = useCallback(async () => {
    if (!activeAddress) return;
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      await authenticateWallet(activeAddress);
      setIsAuthenticated(true);
      // Fresh token issued — bump the socket trigger so the WS reconnects with it.
      setAuthVersion((v) => v + 1);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Authentication failed";
      setIsAuthenticated(false);
      // Allow a manual retry (e.g. user dismissed the signature prompt).
      authAttemptedFor.current = null;
      if (!isUserCancellation(msg)) setAuthError(msg);
    } finally {
      setIsAuthenticating(false);
    }
  }, [activeAddress]);

  // The game socket reports the server rejected our session token (WS 1008 —
  // stale/expired token, or SESSION_SECRET rotated across a deploy). Do NOT
  // silently re-sign: prompting a fresh signature on every rejection produced a
  // storm of wallet popups (the "seven wallets popped up" the owner saw, because
  // a successful re-auth reset the retry budget so the bound never tripped).
  // Mark the session unauthenticated and let the player reconnect with ONE
  // deliberate tap. The game stays usable via the REST polling fallback until
  // they do. (authAttemptedFor is intentionally left set so the auto-auth effect
  // below does not immediately re-fire and re-create the storm.)
  const handleSessionRejected = useCallback(() => {
    setIsAuthenticated(false);
    setAuthError("Session expired — reconnect your wallet to go live again.");
  }, []);

  // Auto-authenticate once per connected address — but ONLY where the host opted
  // in (the in-game route passes autoAuth). On the marketing / landing pages we
  // never prompt a signature, so players don't have to log into the wallet until
  // they enter the game. One signature per connected address, in the game — that's it.
  useEffect(() => {
    if (!autoAuth) return;
    if (!activeAddress || !signTransactions) return;
    if (authAttemptedFor.current === activeAddress) return;
    authAttemptedFor.current = activeAddress;
    void authenticate();
  }, [autoAuth, activeAddress, signTransactions, authenticate]);

  // Reset auth state on disconnect.
  useEffect(() => {
    if (!activeAddress) {
      setIsAuthenticated(false);
      setAuthError(null);
      authAttemptedFor.current = null;
    }
  }, [activeAddress]);

  // Refresh balance whenever the active address changes
  useEffect(() => {
    if (activeAddress) {
      getAccountBalance(activeAddress).then(setBalance);
    } else {
      setBalance(0);
    }
  }, [activeAddress]);

  const refreshBalance = useCallback(async () => {
    if (activeAddress) {
      const b = await getAccountBalance(activeAddress);
      setBalance(b);
    }
  }, [activeAddress]);

  const clearError = useCallback(() => setError(null), []);

  const connect = useCallback(async (walletId: string) => {
    setIsConnecting(true);
    setError(null);

    const wallet = wallets.find((w: any) => w.id === walletId);

    const attemptConnect = async () => {
      if (!wallet) throw new Error(`Wallet ${walletId} not configured`);
      // Bound the connect so a modal that never surfaces can't spin forever.
      await promiseWithTimeout(wallet.connect(), CONNECT_TIMEOUT_MS);
    };

    try {
      try {
        console.log(`[WALLET] Connecting to ${walletId}...`);
        await attemptConnect();
        console.log(`[WALLET] Connected to ${walletId}`);
      } catch (firstErr: unknown) {
        const e1 = firstErr as { message?: string; data?: { type?: string }; code?: string };
        const msg1 = e1?.message || String(firstErr) || "";

        // Failed/aborted connect (including user cancel) can leave a HALF-OPEN
        // WalletConnect session behind. If it isn't purged it accumulates and
        // Pera resurfaces every leftover pairing on the next attempt — the
        // "extra wallets keep popping up" storm. Drop it before we return/throw.
        await purgeStaleSession(wallet);

        // User cancelled — don't retry, don't show error.
        if (isUserCancellation(msg1, e1?.data)) return;

        // Do NOT silently retry: a second wallet.connect() opens ANOTHER
        // deep-link tab (the "trying to open another application" storm on
        // mobile). Surface the error and let the user retry deliberately via
        // the "Try Again" button — one tab per intentional attempt.
        throw firstErr;
      }
    } catch (err: unknown) {
      const e = err as { message?: string; data?: { type?: string }; code?: string };
      const msg = e?.message || String(err) || "";
      console.error(`[WALLET] Error connecting to ${walletId}:`, { message: msg, data: e?.data, code: e?.code });
      if (!isUserCancellation(msg, e?.data)) {
        setError(friendlyErrorMessage(walletId, msg));
      }
    } finally {
      setIsConnecting(false);
    }
  }, [wallets]);

  const disconnect = useCallback(() => {
    const activeWallet = wallets.find((w: any) => w.isActive);
    activeWallet?.disconnect();
    setError(null);
    setBalance(0);
    registerWalletSigner(null);
    setIsAuthenticated(false);
    setAuthError(null);
    authAttemptedFor.current = null;
    // Explicit user disconnect — forget the resume hint and skip the grace so
    // the connect-gate shows immediately (no lingering "restoring" spinner).
    hadSessionHint.current = false;
    setRestoreGraceElapsed(true);
    try {
      window.localStorage?.removeItem(WALLET_SESSION_HINT_KEY);
    } catch {
      /* best-effort */
    }
    void logoutWallet();
  }, [wallets]);

  const isConnected = !!activeAddress;
  const signerReady = isConnected;
  const activeWallet = wallets.find((w: any) => w.isActive) ?? null;
  const walletType = activeWallet?.id ?? null;

  // We expect an address to land (so keep showing "restoring", not the gate)
  // while use-wallet still marks a wallet active OR this browser had a session
  // last load — until the bounded grace gives up.
  const hasActiveWallet = !!activeWallet;
  const reconnectPending =
    !restoreGraceElapsed && (hasActiveWallet || hadSessionHint.current);

  // Start the bounded grace once the library is ready but we're not yet
  // connected and a reconnect is expected. If the address never lands, give up
  // so the connect-gate can show instead of an endless spinner.
  useEffect(() => {
    if (!walletLibReady || isConnected || restoreGraceElapsed) return;
    if (!hasActiveWallet && !hadSessionHint.current) return;
    const t = setTimeout(() => setRestoreGraceElapsed(true), RECONNECT_GRACE_MS);
    return () => clearTimeout(t);
  }, [walletLibReady, isConnected, hasActiveWallet, restoreGraceElapsed]);

  const walletStatus: WalletStatus = deriveWalletStatus(
    walletLibReady,
    isConnected,
    reconnectPending,
  );

  const availableWallets: WalletInfo[] = wallets.map((w: any) => ({
    id: w.id,
    name: w.metadata.name,
    icon: w.metadata.icon,
    isConnected: w.isConnected,
    isActive: w.isActive,
  }));

  const isReady = isConnected && signerReady && !!activeAddress;

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        walletStatus,
        address: activeAddress ?? null,
        displayAddress: activeAddress ? formatAddress(activeAddress) : null,
        balance,
        isConnecting,
        error,
        walletType,
        signerReady,
        blockchainReady,
        isReady,
        isAuthenticated,
        isAuthenticating,
        authError,
        authVersion,
        onSessionRejected: handleSessionRejected,
        availableWallets,
        connect,
        disconnect,
        authenticate,
        clearError,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  // DEV / TEST entry: when a dev session is active and no real wallet is
  // connected, present the dev address as a connected + authenticated identity
  // so the whole game runs as the test player. The matching server session
  // token is set by the landing page's dev button (POST /api/dev/quick-auth).
  if (DEV_MODE && !context.isConnected && devSessionActive()) {
    const address = devSessionAddress();
    if (address) {
      return {
        ...context,
        isConnected: true,
        walletStatus: "connected" as WalletStatus,
        address,
        displayAddress: formatAddress(address),
        signerReady: true,
        blockchainReady: true,
        isReady: true,
        isAuthenticated: true,
      };
    }
  }
  return context;
}
