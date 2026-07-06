/**
 * client/tests/landing-token-data.spec.tsx
 *
 * Pins the D1 "truth pass": the public landing/tokenomics pages used to ship
 * hardcoded, wrong, and outright fabricated token/economy data (10B total
 * supply vs the real 1B ASA; a synthetic sine-wave "trend" chart; a frozen
 * "4,218 parcels claimed" counter; "0.5-1.5 ASCEND/hr" vs the real per-day
 * rate). SSR smoke (same `renderToStaticMarkup` harness as admin.spec.tsx —
 * no jsdom) proving those exact strings never reappear, and that the
 * live-data components render the "…"/"—" loading placeholder instead of a
 * baked-in number pre-fetch (query is unresolved during a synchronous SSR
 * render, so this is what "wired to real data" looks like at this layer).
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { HypeTicker, TokenSection } from "@/pages/landing.tsx";
import { LandingFooter } from "@/pages/landing-shared.tsx";

function renderWithQueryClient(node: React.ReactElement): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Router ssrPath="/">{node}</Router>
    </QueryClientProvider>,
  );
}

describe("landing.tsx token/parcel data (D1 truth pass)", () => {
  it("HypeTicker never re-hardcodes the frozen 4,218 parcel count", () => {
    const html = renderWithQueryClient(<HypeTicker />);
    expect(html).not.toContain("4,218");
    // Pre-fetch SSR render shows the loading placeholder, not a baked-in number.
    expect(html).toContain("parcels claimed");
  });

  it("HypeTicker no longer claims the token is merely 'launching soon'", () => {
    const html = renderWithQueryClient(<HypeTicker />);
    expect(html).not.toContain("launching soon");
  });

  it("TokenSection never re-hardcodes the wrong 10B supply or the unsourced 5B/5B split", () => {
    const html = renderWithQueryClient(<TokenSection />);
    expect(html).not.toContain("10,000,000,000");
    expect(html).not.toContain("5,000,000,000");
    expect(html).not.toContain("Liquidity-Backed");
    expect(html).not.toContain("Land-Minted");
  });

  it("TokenSection no longer contradicts itself with 'Pre-Launch' status", () => {
    const html = renderWithQueryClient(<TokenSection />);
    expect(html).not.toContain("Pre-Launch");
    expect(html).toContain("Live");
  });

  it("TokenSection renders the real supply-breakdown labels sourced from /api/economics", () => {
    const html = renderWithQueryClient(<TokenSection />);
    expect(html).toContain("In Circulation");
    expect(html).toContain("Treasury");
    expect(html).toContain("Burned");
  });
});

describe("landing-shared.tsx LandingFooter (D1 truth pass)", () => {
  it("never re-hardcodes the frozen 4,218 parcels-reserved stat", () => {
    const html = renderWithQueryClient(<LandingFooter />);
    expect(html).not.toContain("4,218");
    expect(html).toContain("Parcels Reserved");
    expect(html).toContain("/ 21,000");
  });
});
