/**
 * client/tests/admin.spec.tsx
 *
 * SSR smoke for the real admin surface (`@/pages/admin`, default export
 * `AdminDashboard`). Uses the same `react-dom/server` `renderToStaticMarkup`
 * harness as the rest of the client suite (no jsdom, no @testing-library) — see
 * hud-shell.spec.tsx. A true DOM mount is a separate, planned test-infra PR.
 *
 * Goal: prove the admin page mounts and renders its key-entry gate WITHOUT
 * throwing — the page reads `sessionStorage` in a `useState` initializer and
 * calls `useQuery`, so the only test-only scaffolding is an in-memory
 * `sessionStorage` stub (the suite runs without jsdom) and a `QueryClientProvider`
 * (the 7 `useQuery` hooks run unconditionally, though `enabled:false` pre-key, so
 * nothing fetches). No runtime code is touched; no new dependencies.
 *
 * NOT covered (needs the future DOM harness): typing a key, unlock interaction,
 * the gated dashboard/charts (recharts only renders in the unlocked branch).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminDashboard from "@/pages/admin";

// The client suite has no jsdom, so `sessionStorage` is undefined. admin.tsx
// reads it during render (`useAdminKey` initializer) — provide a minimal
// in-memory stub. Test-only; never shipped.
function installSessionStorageStub(): void {
  const store = new Map<string, string>();
  (globalThis as { sessionStorage?: Storage }).sessionStorage = {
    getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function renderAdmin(): string {
  // retry:false so nothing schedules; queries are enabled:false pre-key anyway.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AdminDashboard />
    </QueryClientProvider>,
  );
}

describe("AdminDashboard (SSR smoke — key-entry gate)", () => {
  beforeEach(() => installSessionStorageStub());

  it("renders the key-entry screen without throwing when no admin key is set", () => {
    const html = renderAdmin();
    expect(html).toContain("Admin Access");
    expect(html).toContain("Enter the ADMIN_KEY");
    expect(html).toContain("Unlock");
    // Stable hook the page exposes on the key input.
    expect(html).toContain('data-testid="input-admin-key"');
  });

  it("does not leak the gated ops dashboard before a key is entered", () => {
    const html = renderAdmin();
    // The unlocked header + control labels must be absent pre-auth.
    expect(html).not.toContain("Ascendancy Ops");
    expect(html).not.toContain("Resolve battles");
  });
});
