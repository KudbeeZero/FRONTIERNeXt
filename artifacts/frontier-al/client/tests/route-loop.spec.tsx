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
 *   the wallet SDK's connectors touch `window`/IndexedDB when constructed (now
 *   during React's render, inside `App`'s `useMemo` — see `createWalletManager`'s
 *   doc comment — so a real construction failure is a catchable render error
 *   instead of a module-load crash), so they are stubbed to inert passthroughs
 *   with a disconnected wallet — the real first-load state for a visitor who
 *   hasn't connected.
 * - `/` mounts the gameplay page directly (2026-07-07: skip the marketing
 *   landing page, drop straight into the globe). The old landing homepage is
 *   kept at `/landing`, not deleted, just no longer the default. The `/info/*`
 *   and catch-all (404) routes render their REAL components. The gameplay page
 *   is a heavy WebGL globe (`@react-three/fiber` Canvas) that cannot render
 *   headless; it is stubbed at the page render BOUNDARY so this test asserts
 *   the router MOUNTS the gameplay page for `/` and `/game`. Rendering the
 *   real 3D entry state headless is out of scope — a focused GameLayout
 *   component test is the follow-up.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";

// ── Explicit, realistic boundary mocks ──────────────────────────────────────
// Wallet SDK manager (constructs against window/IndexedDB) → inert.
vi.mock("@/lib/walletManager", () => ({ createWalletManager: () => ({}) }));

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
  shouldAutoAuthenticateForPath: (pathname: string) => pathname === "/game",
}));

// Inert test-mode flag (App no longer branches `/` on it — landing is bypassed —
// but keep the stub so nothing transitively reads import.meta.env under SSR).
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

  it("mounts the gameplay page directly on the core route '/' (owner directive 2026-07-07)", () => {
    const html = renderAt("/");
    expect(html).toContain("GAME ROUTE ENTRY");
    expect(html).not.toContain("404 Page Not Found");
  });

  it("still serves the old landing homepage at '/landing' (kept, not deleted)", () => {
    const html = renderAt("/landing");
    expect(html).toContain("Conquer the");
    expect(html).not.toContain("GAME ROUTE ENTRY");
    expect(html).not.toContain("404 Page Not Found");
  });

  it("mounts the gameplay page on '/game' too (route → page boundary)", () => {
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

  // Regression guard for the P1 fix (2026-07-07): /university and /admin were
  // pulled out of the flat per-route list into an outer Switch branch (ahead of
  // the shared-WalletProvider catch-all that now wraps every other route) so
  // they keep mounting with NO wallet context. Wouter's Switch selects the
  // first matching path regardless of nesting depth, so this reorder must not
  // change which route wins for these two exact paths.
  it("still resolves /university and /admin to their own routes, not the 404 fallback", () => {
    expect(renderAt("/university")).not.toContain("404 Page Not Found");
    expect(renderAt("/admin")).not.toContain("404 Page Not Found");
  });

  it("transitions between routes — the loop is wired, not a single shared page", () => {
    const home = renderAt("/");
    const info = renderAt("/info/economics");
    const missing = renderAt("/definitely-not-a-route");
    // '/' now mounts the game; an /info page and the 404 fallback are distinct
    // outputs, so the Switch still selects per-path — a dropped or mis-wired
    // <Route> would break at least one of these assertions.
    expect(home).toContain("GAME ROUTE ENTRY");
    expect(info).not.toBe(home);
    expect(info).not.toBe(missing);
    expect(home).not.toBe(missing);
  });
});
