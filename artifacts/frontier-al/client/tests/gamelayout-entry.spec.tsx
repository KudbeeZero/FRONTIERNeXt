/**
 * client/tests/gamelayout-entry.spec.tsx
 *
 * Renders the REAL GameLayout (`/game` → GamePage → GameLayout) and asserts its
 * entry-state shells. Unlike the route-loop test (which stubs the page at the
 * boundary), this mounts the real component so a regression in the entry-state
 * gating (wallet gate / error / restoring) or in the shell container is caught.
 *
 * APPROACH: `react-dom/server` `renderToStaticMarkup` of the real `<App/>` under
 * wouter `ssrPath="/game"` — Node env, NO jsdom, NO new deps. GameLayout's four
 * pre-shell early returns (error → gamer-tag → restoring → wallet-gate) render
 * BEFORE the `<PlanetGlobe>` WebGL boundary (it's gated on `gameState` truthy),
 * so the real entry states render without any Canvas. All side effects in the
 * mocked hooks live in `useEffect`, which `renderToStaticMarkup` does not run.
 *
 * MOCKED (explicit, realistic) — the browser/WebGL/data boundaries only:
 *   wallet (disconnected by default), the wallet SDK/manager, WalletConnect,
 *   TEST_GLOBE=false, PlanetGlobe (→ null), and the data/socket/chain hooks
 *   (useGameState/useBlockchainActions/useGameSocket/useOrbitalEngine/
 *   useWorldEvents/useToast). Mutable state (`h`) lets each test drive a state.
 *
 * EXPLICITLY OUT OF SCOPE (documented, not faked): the real 3D PlanetGlobe scene,
 * WebSocket/effect behavior, and post-mount data fetching. Those need a
 * WebGL-capable / jsdom harness — a follow-up unit, not covered here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";

const h = vi.hoisted(() => ({
  wallet: {
    address: null as string | null,
    isConnected: false,
    isAuthenticated: false,
    balance: 0,
    walletStatus: "disconnected" as string,
  },
  gameState: { data: undefined as unknown, isLoading: false, error: null as unknown },
}));

// ── Wallet / SDK boundary (touch window/IndexedDB at import) ─────────────────
vi.mock("@/lib/walletManager", () => ({ walletManager: {} }));
vi.mock("@txnlab/use-wallet-react", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWallet: () => ({ wallets: [], activeAccount: null, activeAddress: null, isReady: true }),
  useNetwork: () => ({ activeNetwork: "testnet", setActiveNetwork: () => {} }),
}));
vi.mock("@/contexts/WalletContext", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWallet: () => h.wallet,
  shouldAutoAuthenticateForPath: (pathname: string) => pathname === "/game",
}));
vi.mock("@/components/game/WalletConnect", () => ({
  WalletConnect: () => <button data-testid="wallet-connect">Connect Wallet</button>,
}));
vi.mock("@/lib/testMode", () => ({ TEST_GLOBE: false }));

// ── WebGL boundary: the 3D globe never renders in these tests ────────────────
vi.mock("@/components/game/PlanetGlobe", () => ({ default: () => null }));

// ── Data / socket / chain hooks (effects don't run under SSR) ────────────────
vi.mock("@/hooks/useGameSocket", () => ({ useGameSocket: () => {}, useLiveWorldEvents: () => {} }));
vi.mock("@/hooks/useOrbitalEngine", () => ({ useOrbitalEngine: () => ({ events: [], impactEvents: [] }) }));
vi.mock("@/hooks/useWorldEvents", () => ({ useWorldEvents: () => ({ data: [] }) }));
// NOTE: useToast is intentionally NOT mocked — the real one is SSR-safe and the
// top-level <Toaster/> needs its real `toasts` array.
vi.mock("@/hooks/useBlockchainActions", () => ({
  // Permissive: known value fields returned as-is; every other accessed member
  // (the queue*/sign* action functions) resolves to a no-op.
  useBlockchainActions: () =>
    new Proxy(
      { isWalletConnected: false, ascendAsaId: null, isOptedInToAscend: false, treasuryAddress: "" },
      { get: (t, p) => (p in t ? (t as Record<string, unknown>)[p as string] : typeof p === "string" ? () => {} : undefined) },
    ),
}));
vi.mock("@/hooks/useGameState", () => {
  const noopMutation = () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false });
  return {
    useGameState: () => h.gameState,
    useCurrentPlayer: () => null,
    useMine: noopMutation,
    useOpenLootBox: noopMutation,
    useUpgrade: noopMutation,
    useAttack: noopMutation,
    useBuild: noopMutation,
    usePurchase: noopMutation,
    useCollectAll: noopMutation,
    useClaimAscend: noopMutation,
    useMintAvatar: noopMutation,
    useSwitchCommander: noopMutation,
    useSpecialAttack: noopMutation,
    useDeployDrone: noopMutation,
    useDeploySatellite: noopMutation,
  };
});

import App from "@/App";

function renderGame(): string {
  return renderToStaticMarkup(
    <Router ssrPath="/game">
      <App />
    </Router>,
  );
}

describe("GameLayout entry state (/game, real component)", () => {
  beforeEach(() => {
    h.wallet = { address: null, isConnected: false, isAuthenticated: false, balance: 0, walletStatus: "disconnected" };
    h.gameState = { data: undefined, isLoading: false, error: null };
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  });

  it("renders the wallet gate for a disconnected visitor (the first-load entry state)", () => {
    const html = renderGame();
    expect(html).toContain('data-testid="wallet-gate"');
    expect(html).toContain("Connect your Algorand wallet");
    // Did not fall through to the main shell or an error.
    expect(html).not.toContain('data-testid="game-layout"');
    expect(html).not.toContain('data-testid="game-error"');
  });

  it("renders the connection-error entry state when game state fails to load", () => {
    h.gameState = { data: undefined, isLoading: false, error: new Error("backend unreachable") };
    const html = renderGame();
    expect(html).toContain('data-testid="game-error"');
    expect(html).toContain("Connection Error");
    expect(html).not.toContain('data-testid="game-layout"');
  });

  it("renders the wallet-restoring entry state while a session reconnects", () => {
    h.wallet = { ...h.wallet, walletStatus: "restoring" };
    const html = renderGame();
    expect(html).toContain('data-testid="wallet-restoring"');
    expect(html).toContain("Reconnecting Wallet");
  });

  it("mounts the main GameLayout shell when connected (no WebGL globe yet)", () => {
    // Connected + no gameState data → passes every gate and reaches the main
    // container, but the `gameState ? <PlanetGlobe/> : null` block is skipped,
    // so the shell mounts WITHOUT rendering the 3D canvas.
    h.wallet = { address: "TESTADDR", isConnected: true, isAuthenticated: true, balance: 0, walletStatus: "connected" };
    h.gameState = { data: undefined, isLoading: false, error: null };
    const html = renderGame();
    expect(html).toContain('data-testid="game-layout"');
    // It is the real shell, not an entry-gate screen.
    expect(html).not.toContain('data-testid="wallet-gate"');
    expect(html).not.toContain('data-testid="game-error"');
  });

  it("gates are mutually exclusive — entry state changes with the inputs", () => {
    const gate = renderGame();
    h.gameState = { data: undefined, isLoading: false, error: new Error("x") };
    const errored = renderGame();
    // A change in inputs produces a different entry state, so the gating logic
    // is actually exercised (a regression that always renders one screen fails).
    expect(gate).not.toBe(errored);
    expect(gate).toContain('data-testid="wallet-gate"');
    expect(errored).toContain('data-testid="game-error"');
  });
});
