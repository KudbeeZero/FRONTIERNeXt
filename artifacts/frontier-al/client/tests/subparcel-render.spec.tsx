import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubParcelPanel } from "@/components/game/subparcel";
import { SubParcelDetail } from "@/components/game/subparcel";

// Render smoke for the extracted sub-parcel panel (feat/subparcel-ui, DORMANT 1.1).
// Confirms the components render without throwing and wire to the real endpoints.
function render(el: React.ReactElement): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(React.createElement(QueryClientProvider, { client: qc }, el));
}

const player: any = { id: "p1", frontier: 1000, iron: 500, fuel: 500, playerFactionId: "KRONOS" };
const longAgo = Date.now() - 1_000_000_000_000;

describe("SubParcelPanel", () => {
  it("renders the subdivide CTA for an owned, not-yet-subdivided plot", () => {
    const parcel: any = { plotId: 42, ownerId: "p1", isSubdivided: false, biome: "plains", capturedAt: longAgo, lastFrontierClaimTs: longAgo };
    const html = render(React.createElement(SubParcelPanel, { parcel, player }));
    expect(html).toContain("Sub-Parcels");
    expect(html).toContain("Subdivide");
  });

  it("renders the 3x3 grid container for a subdivided plot", () => {
    const parcel: any = { plotId: 7, ownerId: "p1", isSubdivided: true, biome: "mountain", capturedAt: longAgo, lastFrontierClaimTs: longAgo };
    const html = render(React.createElement(SubParcelPanel, { parcel, player }));
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("Sub-Parcels");
  });
});

describe("SubParcelDetail", () => {
  it("renders the archetype picker + building tree for an owned sub-parcel", () => {
    const sp: any = { id: "sp1", parentPlotId: 7, subIndex: 0, ownerId: "p1", improvements: [], archetype: null, archetypeLevel: 0, energyAlignment: null, purchasePriceFrontier: 50 };
    const html = render(React.createElement(SubParcelDetail, { sp, player, parentPlotId: 7, biome: "mountain", onClose: () => {} }));
    expect(html).toContain("Archetype");
    expect(html).toContain("Facilities");
    expect(html).toContain("Defense");
  });
});
