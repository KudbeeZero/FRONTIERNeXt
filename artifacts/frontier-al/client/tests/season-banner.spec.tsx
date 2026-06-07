import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SeasonBanner } from "@/components/game/SeasonBanner";

// Render smoke for the season HUD banner (feat/seasons-hud, DORMANT 1.3).
function renderWith(seasonData: unknown): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["/api/season/current"], seasonData);
  return renderToString(
    React.createElement(QueryClientProvider, { client: qc }, React.createElement(SeasonBanner)),
  );
}

describe("SeasonBanner", () => {
  it("shows the season name, countdown and $ASCEND prize pool for an active season", () => {
    const season = {
      id: "s1", number: 1, name: "First Colonists",
      startedAt: Date.now() - 1000, endsAt: Date.now() + 5 * 86400_000,
      status: "active", winnerId: null, totalPlotsAtEnd: null, rewardPool: 12500,
    };
    const html = renderWith({ season });
    expect(html).toContain("FIRST COLONISTS");
    expect(html).toContain("ASCEND");
    expect(html).toContain("12,500");
  });

  it("renders nothing when there is no active season", () => {
    expect(renderWith({ season: null })).toBe("");
  });
});
