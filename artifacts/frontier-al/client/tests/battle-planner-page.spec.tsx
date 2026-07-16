/**
 * client/tests/battle-planner-page.spec.tsx
 *
 * SSR smoke for the Battle Planner page (`@/pages/battle-planner`).
 * Uses `renderToStaticMarkup` to prove the page mounts without throwing
 * when wrapped in the minimal query-client + wallet stubs.
 *
 * NOT covered (future DOM harness): full planner interaction flow,
 * wallet connect/disconnect, attack mutation success/error branches.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BattlePlannerPage from "@/pages/battle-planner";

function installWalletStub(): void {
  (globalThis as any).txnlab = {
    useWallet: () => ({
      wallets: [],
      activeWallet: null,
      connect: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      isConnected: false,
      address: null,
    }),
  };
}

describe("BattlePlannerPage", () => {
  beforeEach(() => {
    installWalletStub();
  });

  it("renders without throwing", () => {
    const queryClient = new QueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <BattlePlannerPage />
      </QueryClientProvider>,
    );
    expect(html).toContain("battle-planner");
  });
});
