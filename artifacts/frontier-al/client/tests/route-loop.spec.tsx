/**
 * client/tests/route-loop.spec.tsx
 *
 * Route-layer integration test for the client app router (`client/src/App.tsx`,
 * wouter). Proves the route loop — the path → page wiring plus the provider
 * boot — works and would FAIL if a route were dropped, mis-wired, or the app
 * stopped booting. No game logic or routing is changed by this test.
 *
 * HOW (and why this shape):
 * - Renders the REAL `<App/>` through `react-dom/server` (already a dependency)
 *   under wouter's `Router ssrPath`, so we drive routes deterministically with
 *   NO new test deps and NO jsdom (the existing client suite runs in Node). SSR
 *   runs render bodies but not effects, which keeps the boot deterministic
 *   (WebSocket connect, localStorage, fetch all live in effects).
 * - The wallet/auth/blockchain boundary is mocked EXPLICITLY and realistically:
 *   the wallet SDK + walletManager touch `window`/IndexedDB at import, so they
 *   are stubbed to inert passthroughs with a disconnected wallet — the real
 *   first-load state for a visitor who hasn't connected.
 * - The `/` (landing) and catch-all (404) routes render their REAL components.
 *   The `/game` route's page is a heavy WebGL globe (`@react-three/fiber`
 *   Canvas) that cannot render headless; it is stubbed at the page render
 *   BOUNDARY so this test asserts the router MOUNTS the gameplay page for
 *   `/game`. Rendering the real 3D entry state headless is out of scope (see the
 *   PR "not covered" note) — a focused GameLayout component test is the follow-up.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";

// ── Explicit, realistic boundary mocks ──────────────────────────────────────
// Wallet SDK manager (constructs against window/IndexedDB at import) → inert.
vi.mock("@/lib/walletManager", () => ({ walletManager: {} }));

// use-wallet-react provider/hooks → passthrough provider + disconnected wallet.
vi.mock("@txnlab/use-wallet-react", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWallet: () => ({ wallets: [], activeAccount: null, activeAddress: null, isReady: true }),
  useNetwork: () => ({ activeNetwork: "testnet", setActiveNetwork: () => {} }),
}));

// App's own wallet context → passthrough provider + disconnected state.
vi.mock("@/contexts/WalletContext", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWallet: () => ({
    address: null,
    isConnected: false,
    isAuthenticated: false,
    balance: 0,
    walletStatus: "disconnected",
  }),
}));

// Force the landing branch of `/` deterministically (don't depend on env flags).
vi.mock("@/lib/testMode", () => ({ TEST_GLOBE: false }));

// Wallet connect button (a wallet/auth UI boundary, rendered in the landing nav
// and the game shell). Stub to an inert button so route rendering doesn't depend
// on the wallet picker's internals.
vi.mock("@/components/game/WalletConnect", () => ({
  WalletConnect: () => <button data-testid="wallet-connect">Connect Wallet</button>,
}));

// Heavy gameplay page is a WebGL globe — stub at the render boundary so the
// router test asserts the mount, not the 3D scene.
vi.mock("@/pages/game", () => ({
  default: () => <div data-testid="game-route">GAME ROUTE ENTRY</div>,
}));

import App from "@/App";

/** Render the real <App/> at a given path via wouter SSR. */
function renderAt(path: string): string {
  return renderToStaticMarkup(
    <Router ssrPath={path}>
      <App />
    </Router>,
  );
}

describe("client route loop (App router)", () => {
  beforeEach(() => {
    // No backend in a unit test: keep any render-path fetch inert (effects that
    // would fetch don't run under SSR anyway).
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  });

  it("boots the app/router without crashing", () => {
    const html = renderAt("/");
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  it("renders the landing shell on the core route '/'", () => {
    const html = renderAt("/");
    // Landing-specific copy (the token name pervades the landing page).
    expect(html).toMatch(/\$ASCEND/);
    // It is NOT the gameplay page nor the 404 fallback.
    expect(html).not.toContain("GAME ROUTE ENTRY");
    expect(html).not.toContain("404 Page Not Found");
  });

  it("mounts the gameplay page on '/game' (route → page boundary)", () => {
    const html = renderAt("/game");
    expect(html).toContain("GAME ROUTE ENTRY");
    // The router selected the gameplay branch, not the fallback.
    expect(html).not.toContain("404 Page Not Found");
  });

  it("falls back to NotFound (404) on an unknown route", () => {
    const html = renderAt("/no-such-route-xyz");
    expect(html).toContain("404 Page Not Found");
    expect(html).not.toContain("GAME ROUTE ENTRY");
  });

  it("transitions between routes — the loop is wired, not a single shared page", () => {
    const landing = renderAt("/");
    const game = renderAt("/game");
    const missing = renderAt("/definitely-not-a-route");
    // Three distinct outputs prove the Switch selects per-path, so a dropped or
    // mis-wired <Route> would break at least one of these assertions.
    expect(landing).not.toBe(game);
    expect(game).not.toBe(missing);
    expect(landing).not.toBe(missing);
  });
});
