import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
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

interface WalletProviderProps {
  children: ReactNode;
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

export function WalletProvider({ children }: WalletProviderProps) {
  const { wallets, activeAddress, signTransactions } = useWalletLib();

  const [balance, setBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockchainReady, setBlockchainReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Bumps on each successful auth so the game socket reconnects with the fresh token.
  const [authVersion, setAuthVersion] = useState(0);
  // Bounds auto re-auth after server token rejection (avoid infinite sign prompts).
  const sessionRejectCount = useRef(0);
  const authAttemptedFor = useRef<string | null>(null);
  const isReconnecting = useRef(false);

  useEffect(() => {
    fetchBlockchainStatus().then((status) => {
      setBlockchainReady(status.ready || !!status.adminAddress);
    });
    const timer = setTimeout(() => setIsInitialized(true), 800);
    return () => clearTimeout(timer);
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
      // Fresh token issued — bump the socket trigger and reset the reject budget.
      setAuthVersion((v) => v + 1);
      sessionRejectCount.current = 0;
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
  // stale token, or SESSION_SECRET rotated across a deploy). Self-heal by
  // re-signing for a fresh token, but bound it so a genuinely broken server
  // can't spam signature prompts: after a couple of tries, surface an error.
  const handleSessionRejected = useCallback(() => {
    if (!activeAddress) return;
    if (sessionRejectCount.current >= 2) {
      setIsAuthenticated(false);
      setAuthError("Session keeps getting rejected — please reconnect your wallet.");
      return;
    }
    sessionRejectCount.current += 1;
    authAttemptedFor.current = null;
    setIsAuthenticated(false);
    void authenticate();
  }, [activeAddress, authenticate]);

  // Auto-authenticate once per connected address.
  useEffect(() => {
    if (!activeAddress || !signTransactions) return;
    if (authAttemptedFor.current === activeAddress) return;
    authAttemptedFor.current = activeAddress;
    void authenticate();
  }, [activeAddress, signTransactions, authenticate]);

  // Reset auth state on disconnect.
  useEffect(() => {
    if (!activeAddress) {
      setIsAuthenticated(false);
      setAuthError(null);
      authAttemptedFor.current = null;
      sessionRejectCount.current = 0;
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

    const attemptConnect = async () => {
      const wallet = wallets.find((w: any) => w.id === walletId);
      if (!wallet) throw new Error(`Wallet ${walletId} not configured`);
      await wallet.connect();
    };

    try {
      try {
        console.log(`[WALLET] Connecting to ${walletId}...`);
        await attemptConnect();
        console.log(`[WALLET] Connected to ${walletId}`);
      } catch (firstErr: unknown) {
        const e1 = firstErr as { message?: string; data?: { type?: string }; code?: string };
        const msg1 = e1?.message || String(firstErr) || "";

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
    void logoutWallet();
  }, [wallets]);

  const isConnected = !!activeAddress;
  const signerReady = isConnected;
  const activeWallet = wallets.find((w: any) => w.isActive) ?? null;
  const walletType = activeWallet?.id ?? null;

  const walletStatus: WalletStatus = !isInitialized
    ? "restoring"
    : isConnected
    ? "connected"
    : "disconnected";

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
  return context;
}
