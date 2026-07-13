/**
 * client/tests/battle-target-selector.spec.tsx
 *
 * Smoke + structure coverage for the BattleTargetSelector.
 *
 * HARNESS: renderToStaticMarkup (SSR-safe). The selector is pure UI; no WebGL,
 * wallet, or server needed. Radix Tabs omits inactive panel children in SSR,
 * so we assert structural presence (tabs, data-testids, empty-state) and defer
 * per-tab content validation to the pure unit suite (logic.spec.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

function makeParcel(overrides: Partial<any> = {}): any {
  return {
    id: overrides.id ?? `parcel-${Math.random().toString(36).slice(2, 8)}`,
    plotId: overrides.plotId ?? Math.floor(Math.random() * 21000) + 1,
    lat: overrides.lat ?? 0,
    lng: overrides.lng ?? 0,
    biome: overrides.biome ?? "grassland",
    richness: overrides.richness ?? 50,
    ownerId: overrides.ownerId ?? null,
    ownerType: overrides.ownerType ?? null,
    defenseLevel: overrides.defenseLevel ?? 5,
    effectiveFaction: overrides.effectiveFaction ?? null,
    activeBattleId: overrides.activeBattleId ?? null,
    ...overrides,
  };
}

function makeEnemyParcel(overrides: Partial<any> = {}): any {
  return makeParcel({
    ownerId: overrides.ownerId ?? "enemy-player-1",
    ownerType: overrides.ownerType ?? "ai",
    effectiveFaction: overrides.effectiveFaction ?? "KRONOS",
    ...overrides,
  });
}

import { BattleTargetSelector } from "@/components/game/BattleTargetSelector";

describe("BattleTargetSelector", () => {
  const defaultProps = {
    allParcels: [] as any[],
    ownedParcels: [] as any[],
    playerFactionId: null as string | null | undefined,
    selectedParcelId: null as string | null,
    onSelect: vi.fn(),
    sourceParcelId: null as string | null,
    currentCommanderName: null as string | null,
    currentTroops: 1,
    baseCostIron: 10,
    baseCostFuel: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const html = renderToStaticMarkup(<BattleTargetSelector {...defaultProps} />);
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  it("renders the 5 tab triggers", () => {
    const html = renderToStaticMarkup(<BattleTargetSelector {...defaultProps} />);
    expect(html).toContain('data-testid="tab-recommended"');
    expect(html).toContain('data-testid="tab-nearby"');
    expect(html).toContain('data-testid="tab-mission"');
    expect(html).toContain('data-testid="tab-search"');
    expect(html).toContain('data-testid="tab-globe"');
  });

  it("renders empty-state when no enemies exist", () => {
    const html = renderToStaticMarkup(<BattleTargetSelector {...defaultProps} />);
    expect(html).toContain("No enemy targets detected");
  });

  it("renders enemy parcels in recommended tab when enemies exist", () => {
    const enemy = makeEnemyParcel({ plotId: 42, defenseLevel: 3, richness: 80, lat: 0.02, lng: 0.02 });
    const origin = makeParcel({ plotId: 1, lat: 0, lng: 0, ownerId: "player-1" });
    const props = {
      ...defaultProps,
      allParcels: [origin, enemy],
      ownedParcels: [origin],
      playerFactionId: "NEXUS-7",
      sourceParcelId: origin.id,
    };
    const html = renderToStaticMarkup(<BattleTargetSelector {...props} />);
    expect(html).toContain("Plot #42");
    expect(html).toContain("KRONOS");
  });
});
