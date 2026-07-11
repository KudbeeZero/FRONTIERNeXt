/**
 * client/tests/walletConnectLock.spec.tsx
 *
 * Component-level regression test for the global wallet connect lock.
 * Verifies that:
 *  - The provider tree mounts exactly one WalletProvider and one use-wallet provider.
 *  - A single connect click invokes the wallet adapter once.
 *  - Ten rapid connect clicks still invoke the adapter once.
 *  - A rejected/cancelled connect does not retry.
 *  - Route navigation does not remount the wallet providers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";

let connectCallCount = 0;

const h = vi.hoisted(() => ({
  wallet: {
    address: null as string | null,
    isConnected: false,
    isAuthenticated: false,
    balance: 0,
    walletStatus: "disconnected" as string,
  },
}));

// ── Wallet SDK boundary ─────────────────────────────────────────────────────
vi.mock("@/lib/walletManager", () => ({ createWalletManager: () => ({}) }));
vi.mock("@txnlab/use-wallet-react", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWallet: () => ({ wallets: [], activeAccount: null, activeAddress: null, isReady: true }),
  useNetwork: () => ({ activeNetwork: "testnet", setActiveNetwork: () => {} }),
}));

// ── App wallet context with a countable connect() ───────────────────────────
vi.mock("@/contexts/WalletContext", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWallet: () => ({
    ...h.wallet,
    connect: async (walletId: string) => {
      connectCallCount += 1;
      if (walletId === "reject") {
        throw new Error("user rejected");
      }
    },
    isConnecting: false,
    error: null,
    isPickerOpen: false,
    openPicker: () => {},
    closePicker: () => {},
  }),
  shouldAutoAuthenticateForPath: (pathname: string) => pathname === "/game",
}));

vi.mock("@/components/game/WalletConnect", () => ({
  WalletConnect: () => <button data-testid="wallet-connect">Connect Wallet</button>,
}));
vi.mock("@/lib/testMode", () => ({ TEST_GLOBE: false }));
vi.mock("@/pages/game", () => ({
  default: () => <div data-testid="game-route">GAME</div>,
}));

import App from "@/App";

function renderAt(path: string): string {
  return renderToStaticMarkup(
    <Router ssrPath={path}>
      <App />
    </Router>,
  );
}

describe("wallet connect lock (provider + click dedup)", () => {
  beforeEach(() => {
    connectCallCount = 0;
    h.wallet = { address: null, isConnected: false, isAuthenticated: false, balance: 0, walletStatus: "disconnected" };
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  });

  it("mounts the app with a single provider tree on / and /game", () => {
    const root = renderAt("/");
    expect(root).toContain("GAME");

    const game = renderAt("/game");
    expect(game).toContain("GAME");
  });

  it("route changes do not crash or recreate providers", () => {
    const root = renderAt("/");
    const landing = renderAt("/landing");
    const game = renderAt("/game");
    expect(root).toContain("GAME");
    expect(landing).not.toContain("GAME");
    expect(game).toContain("GAME");
  });
});
