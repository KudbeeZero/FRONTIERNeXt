import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { DEV_MODE, devSessionActive, devSessionAddress, endDevSession } from "@/lib/devSession";
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

/** localStorage keys the signer-registration effect below sets/clears. */
export const WALLET_TYPE_KEY = "frontier_wallet_type";
export const WALLET_ADDRESS_KEY = "frontier_wallet_address";

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
 * Extension wallets (Lute, Kibisis) surface their approval popup *instantly* —
 * there's no phone-grab / QR-scan latency to wait out. So a 90s budget here just
 * means a wedged extension handshake reads as "spins forever" to the player.
 * Bound it tighter so a connect that never completes becomes a fast, recoverable
 * "try again" with extension-specific guidance instead of an endless spinner.
 */
export const EXTENSION_CONNECT_TIMEOUT_MS = 30_000;

/**
 * Pick the connect timeout for a wallet. Mobile/QR wallets (Pera, Defly) keep the
 * generous {@link CONNECT_TIMEOUT_MS}; browser-extension wallets get the tighter
 * {@link EXTENSION_CONNECT_TIMEOUT_MS}.
 */
export function connectTimeoutFor(walletId: string): number {
  return walletId === "lute" || walletId === "kibisis"
    ? EXTENSION_CONNECT_TIMEOUT_MS
    : CONNECT_TIMEOUT_MS;
}

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

/**
 * Whether a wallet's half-open WalletConnect pairing should be purged before
 * dialing a fresh connect (audit finding P3, 2026-07-07).
 *
 * The purge must never fire on a wallet the SDK still considers `isActive` —
 * that flag without `isConnected` is precisely the signal that a session
 * resume may still be completing in the background. The bounded reconnect
 * grace (`RECONNECT_GRACE_MS`) gives up on the LOCAL "restoring" spinner after
 * 3s and shows the Connect button again, but it does not cancel the
 * underlying resume promise inside the wallet SDK — that can still land a
 * moment later. If the player then taps Connect on that same wallet and we
 * purge it, we tear down a resume that was about to succeed, forcing a fresh
 * QR/approval flow for no reason.
 *
 * A wallet that is BOTH disconnected and inactive has no resume in flight —
 * that's the exact "abandoned pairing" case #175/#204 purges for, and this
 * check does not loosen that: reasoned through all three of #175's named
 * storm scenarios (crashed connect, cross-origin hop, abandoned tab), the
 * wallet reads `isActive: false` in the first two (a fresh origin/session has
 * nothing marked active yet), so the purge still runs unchanged there.
 *
 * Honest gap: the "abandoned tab with a still-cryptographically-valid but
 * genuinely-given-up-on pairing" case cannot be fully distinguished from a
 * real in-flight resume without live SDK behavior this sandbox cannot
 * exercise — owner should smoke-test connect/disconnect/reconnect (including
 * the multi-stale-pairing storm scenario) on a real device.
 */
export function shouldPurgeBeforeConnect(
  wallet: { isConnected?: boolean; isActive?: boolean } | undefined | null,
): boolean {
  if (!wallet) return false;
  return !wallet.isConnected && !wallet.isActive;
}

/**
 * Module-level (not per-component-instance) memory of which addresses have
 * already completed auto-auth THIS page load. A defense-in-depth backstop for
 * audit finding P1: every route used to mount its OWN `<WalletProvider>`
 * instance, so client-side navigation between routes (no full page reload)
 * unmounted and remounted the provider — resetting its per-instance
 * `authAttemptedFor` ref and re-arming a duplicate signature prompt for an
 * address already authenticated on the previous mount. App.tsx now hoists a
 * single shared `<WalletProvider>` instance so that specific remount no
 * longer happens — but this module-level guard is a second, independent line
 * of defense: even if a future change reintroduces multiple instances, or any
 * other remount occurs, an address already auto-authed this page load will
 * not be re-prompted. Cleared only on an explicit disconnect (mirrors the
 * per-instance ref reset), so reconnecting genuinely re-triggers auto-auth.
 */
const autoAuthedAddressesThisLoad = new Set<string>();

/** Has `address` already completed auto-auth this page load (any instance)? */
export function hasAutoAuthed(address: string): boolean {
  return autoAuthedAddressesThisLoad.has(address);
}

/** Record that `address` has completed auto-auth this page load. */
export function markAutoAuthed(address: string): void {
  autoAuthedAddressesThisLoad.add(address);
}

/** Forget all auto-auth memory — called on an explicit user disconnect. */
export function clearAutoAuthedAddresses(): void {
  autoAuthedAddressesThisLoad.clear();
}

/**
 * Which route should auto-prompt the one wallet signature once connected.
 * Only the in-game route opts in — marketing/info pages never prompt a
 * signature, so players aren't asked to log into the wallet until they
 * actually enter the game. Pure so the routing decision is unit-testable
 * without mounting the router.
 */
export function shouldAutoAuthenticateForPath(pathname: string): boolean {
  return pathname === "/game";
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
export function friendlyErrorMessage(walletId: string, msg: string): string {
  if (msg === CONNECT_TIMEOUT_MESSAGE) {
    if (walletId === "lute" || walletId === "kibisis") {
      return "The wallet extension didn't respond. Make sure it's unlocked and the approval popup isn't blocked, then try again.";
    }
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
  // Guards against a second connect() firing while one is already in flight
  // (e.g. a double-tap re-opening the picker inside the 250ms deferred-open
  // window) — a re-entrant call would purge the pairing the first attempt
  // just opened, turning a good connect into a guaranteed failure.
  const connectInFlight = useRef(false);

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
      localStorage.setItem(WALLET_TYPE_KEY, "use-wallet");
      localStorage.setItem(WALLET_ADDRESS_KEY, activeAddress);
      // Clear any stale error once connected
      setError(null);
    } else {
      registerWalletSigner(null);
      if (!activeAddress) {
        localStorage.removeItem(WALLET_TYPE_KEY);
        localStorage.removeItem(WALLET_ADDRESS_KEY);
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
    // A REAL wallet just became active — it always wins over the dev/test
    // identity. Purge any lingering dev session (e.g. a VITE_DEV_AUTOLOGIN one
    // started on the landing page) so it can't shadow the connected wallet on
    // the /game route, where the post-nav resume gap briefly drops isConnected.
    if (DEV_MODE && devSessionActive()) endDevSession();
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
      // Record success at the module level too (P1 defense-in-depth — see
      // markAutoAuthed's doc comment) so a later WalletProvider remount, if
      // one ever happens, won't re-prompt this same address.
      markAutoAuthed(activeAddress);
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
    // P1 defense-in-depth: this address already completed auto-auth in a
    // PRIOR instance this page load (see markAutoAuthed's doc comment) — mark
    // this instance as attempted too and skip, rather than firing a duplicate
    // signature prompt.
    if (hasAutoAuthed(activeAddress)) {
      authAttemptedFor.current = activeAddress;
      return;
    }
    authAttemptedFor.current = activeAddress;
    void authenticate();
  }, [autoAuth, activeAddress, signTransactions, authenticate]);

  // Reset auth state whenever the active address drops — not just on the
  // explicit disconnect() button below, but for ANY reason (e.g. the wallet
  // SDK itself dropping and later resuming the same address mid-session).
  useEffect(() => {
    if (!activeAddress) {
      setIsAuthenticated(false);
      setAuthError(null);
      authAttemptedFor.current = null;
      // Also clear the module-level auto-auth memory here, not only in
      // disconnect(). Audit finding on PR #210: without this, a wallet SDK
      // that transiently nulls-then-restores the same address (a
      // WalletConnect hiccup that self-resumes, the user re-authorizing from
      // inside the wallet app) would leave hasAutoAuthed() reporting true
      // even though authAttemptedFor was just reset above — the auto-auth
      // effect would then silently skip re-authenticating forever, leaving
      // the player unauthenticated to the game server with no recovery short
      // of a manual Disconnect. Clearing the whole set (not just this one
      // address) matches disconnect()'s existing behavior — only one wallet
      // is ever active at a time in this app.
      clearAutoAuthedAddresses();
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
    if (connectInFlight.current) return;
    connectInFlight.current = true;
    setIsConnecting(true);
    setError(null);

    const wallet = wallets.find((w: any) => w.id === walletId);

    const attemptConnect = async () => {
      if (!wallet) throw new Error(`Wallet ${walletId} not configured`);
      // A previous session can leave half-open WalletConnect pairings behind
      // (abandoned tab, crashed connect, the old cross-origin fly.dev hop).
      // Pera resurfaces EVERY leftover pairing as its own popup on the next
      // connect — the "12 windows" storm. Purge before dialing, but only when
      // this wallet isn't currently connected (never drop a live session) AND
      // isn't still `isActive` (never abort an in-flight session resume —
      // audit finding P3, see shouldPurgeBeforeConnect's doc comment).
      if (shouldPurgeBeforeConnect(wallet)) await purgeStaleSession(wallet);
      // Bound the connect so a modal that never surfaces can't spin forever.
      // Extension wallets get a tighter budget than QR/mobile wallets.
      await promiseWithTimeout(wallet.connect(), connectTimeoutFor(walletId));
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
      connectInFlight.current = false;
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
    // Explicit user disconnect — forget the module-level auto-auth memory too
    // (see markAutoAuthed's doc comment), so a later reconnect genuinely
    // re-triggers auto-auth instead of being skipped as "already done".
    clearAutoAuthedAddresses();
    // Explicit user disconnect — forget the resume hint and skip the grace so
    // the connect-gate shows immediately (no lingering "restoring" spinner).
    hadSessionHint.current = false;
    setRestoreGraceElapsed(true);
    try {
      window.localStorage?.removeItem(WALLET_SESSION_HINT_KEY);
    } catch {
      /* best-effort */
    }
    // A lingering dev/test session (e.g. from VITE_DEV_AUTOLOGIN) must be
    // cleared here too — otherwise `shouldUseDevIdentity` immediately
    // re-shadows the now-genuinely-disconnected wallet with the dev identity
    // on the very next render, and "Disconnect" silently does nothing from
    // the player's point of view.
    if (shouldEndDevSessionOnDisconnect(DEV_MODE, devSessionActive())) endDevSession();
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

/**
 * Whether to present the DEV / TEST identity instead of the real wallet context.
 *
 * The dev/test player is a FALLBACK for no-wallet play — a real wallet always
 * wins. We gate on `walletStatus === "disconnected"` (not merely `!isConnected`)
 * so the dev identity can't shadow a wallet that is still **restoring** after the
 * full-page nav into /game: during that resume gap `isConnected` is briefly false
 * but the status is "restoring", and the connected Lute wallet must win once it
 * lands. Pure so the precedence is unit-pinned without a DOM.
 */
export function shouldUseDevIdentity(
  devMode: boolean,
  walletStatus: WalletStatus,
  devActive: boolean,
): boolean {
  return devMode && devActive && walletStatus === "disconnected";
}

/**
 * Whether an explicit user disconnect should also end an active dev/test
 * session. Without this, a lingering dev session (started by
 * `VITE_DEV_AUTOLOGIN` or the manual Dev/Test button) survives "Disconnect" —
 * so {@link shouldUseDevIdentity} fires again on the next render and the dev
 * identity re-shadows the wallet the player just tried to leave.
 */
export function shouldEndDevSessionOnDisconnect(
  devMode: boolean,
  devActive: boolean,
): boolean {
  return devMode && devActive;
}

/**
 * `authVersion` is what gates `useGameSocket`'s connect effect (`!authTrigger`
 * blocks it) — it's normally bumped by the real wallet's `authenticate()` on
 * success. A dev/test session never calls `authenticate()` (it gets its
 * session token from `POST /api/dev/quick-auth` instead), so `authVersion`
 * would stay at its initial `0` — permanently falsy — for the entire life of
 * a dev session, silently blocking the live WebSocket (weapon fire, battle
 * resolution, chain-health) even though a valid token exists. Force a truthy
 * value whenever the dev identity is active so the same gate that works for
 * real wallets also opens for dev sessions.
 */
export function devIdentityAuthVersion(contextAuthVersion: number): number {
  return contextAuthVersion || 1;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  // DEV / TEST entry: when a dev session is active and no real wallet is
  // connected (or restoring), present the dev address as a connected +
  // authenticated identity so the whole game runs as the test player. The
  // matching server session token is set by the landing page's dev button
  // (POST /api/dev/quick-auth). A real wallet always takes precedence.
  if (shouldUseDevIdentity(DEV_MODE, context.walletStatus, devSessionActive())) {
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
        authVersion: devIdentityAuthVersion(context.authVersion),
      };
    }
  }
  return context;
}
