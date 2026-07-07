/**
 * client/tests/sessionMismatchRecovery.spec.ts
 *
 * Owner report: a 403 "session does not own this player" (from the global
 * mutation-ownership middleware or assertPlayerOwnership in server/routes.ts,
 * see server/routeOwnership.ts's evaluateOwnership) left the player stuck on
 * a raw error toast with no recovery — most plausibly hit after a wallet
 * reconnect/switch, when the client's cache-derived player identity
 * (useCurrentPlayer) has drifted from the auth-token-derived session.
 *
 * The server now tags that specific 403 with `code: "SESSION_MISMATCH"`
 * (routeOwnership.ts). This test proves the client's single request
 * chokepoint (apiRequest/throwIfResNotOk in lib/queryClient.ts) recognizes
 * that code and self-heals: clears the stale session token, tells the player,
 * then hard-reloads so they get a clean re-authentication handshake — instead
 * of silently stalling on every subsequent mutation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: (...args: unknown[]) => toastMock(...args) }));

import { apiRequest } from "@/lib/queryClient";

describe("apiRequest — session-mismatch recovery (403 SESSION_MISMATCH)", () => {
  const originalFetch = global.fetch;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    reloadSpy = vi.fn();
    (globalThis as { window?: unknown }).window = { location: { reload: reloadSpy } };
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    toastMock.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("clears the stale token, toasts, and hard-reloads on a SESSION_MISMATCH 403", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({ error: "Forbidden — session does not own this player", code: "SESSION_MISMATCH" }),
    }) as unknown as typeof fetch;
    localStorage.setItem("frontier_session_token", "stale-token");

    await expect(apiRequest("POST", "/api/actions/purchase", {})).rejects.toThrow("403");

    expect(localStorage.getItem("frontier_session_token")).toBeNull();
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled(); // not yet — reload is deferred so the toast can render
    vi.advanceTimersByTime(1500);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("does not trigger recovery for a plain 403 with no SESSION_MISMATCH code", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: "Forbidden" }),
    }) as unknown as typeof fetch;

    await expect(apiRequest("POST", "/api/actions/purchase", {})).rejects.toThrow("403");

    expect(toastMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
