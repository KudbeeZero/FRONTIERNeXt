import { describe, it } from "vitest";
import TestRenderer from "react-test-renderer";

// Polyfills for Radix primitives
if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = ((cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0)) as unknown as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
}
if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === "undefined") {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { BattlePlanner } from "@/components/game/BattlePlanner";
import type { LandParcel, Player, CommanderAvatar } from "@shared/schema";

function makeParcel(overrides: Partial<LandParcel> = {}): LandParcel {
  return {
    id: overrides.id ?? "parcel-1",
    plotId: overrides.plotId ?? 1,
    lat: overrides.lat ?? 0,
    lng: overrides.lng ?? 0,
    biome: overrides.biome ?? "grassland",
    richness: overrides.richness ?? 50,
    ownerId: overrides.ownerId ?? "player-1",
    ownerType: overrides.ownerType ?? "player",
    defenseLevel: overrides.defenseLevel ?? 5,
    ironStored: overrides.ironStored ?? 100,
    fuelStored: overrides.fuelStored ?? 100,
    crystalStored: overrides.crystalStored ?? 100,
    storageCapacity: 100,
    lastMineTs: 0,
    activeBattleId: overrides.activeBattleId ?? null,
    yieldMultiplier: 1,
    improvements: [],
    purchasePriceAlgo: null,
    ascendAccumulated: 0,
    lastAscendClaimTs: 0,
    ascendPerDay: 0,
    influence: 0,
    influenceRepairRate: 0,
    hazardLevel: 0,
    stability: 100,
    terraformStatus: "none",
    terraformedAt: null,
    terraformLevel: 0,
    terraformType: null,
    metadataVersion: 0,
    visualStateRevision: 0,
    effectiveFaction: overrides.effectiveFaction ?? null,
    ...overrides,
  } as LandParcel;
}

function makeCommander(id: string, tier: CommanderAvatar["tier"]): CommanderAvatar {
  return { id, tier, name: `${tier}-${id}`, attackBonus: 10, defenseBonus: 10, specialAbility: "x", mintedAt: 0, totalKills: 0 };
}

function makePlayer(commanders: CommanderAvatar[]): Player {
  return {
    id: "player-1", address: "addr", name: "Tester",
    iron: 100000, fuel: 100000, crystal: 100000, ascend: 0,
    ownedParcels: [], isAI: false, totalIronMined: 0, totalFuelMined: 0, totalCrystalMined: 0,
    totalAscendEarned: 0, totalAscendBurned: 0, attacksWon: 0, attacksLost: 0,
    territoriesCaptured: 0, commander: commanders[0] ?? null, commanders, activeCommanderIndex: 0,
    specialAttacks: [], drones: [], satellites: [], welcomeBonusReceived: false, testnetProgress: [], playerFactionId: null,
  } as Player;
}

describe("debug duplicates", () => {
  it("counts testids", () => {
    const target = makeParcel({ id: "target", plotId: 999, ownerId: "enemy", effectiveFaction: "KRONOS" });
    const originA = makeParcel({ id: "originA", plotId: 10, ownerId: "player-1" });
    const player = makePlayer([makeCommander("cmd-s", "sentinel")]);

    const root = TestRenderer.create(
      <BattlePlanner
        player={player}
        allParcels={[target, originA]}
        ownedParcels={[originA]}
        selectedParcel={target}
        onSelectTarget={() => {}}
        sourceParcelId={null}
        onSourceParcelChange={() => {}}
        troops={1}
        onTroopsChange={() => {}}
        extraIron={0}
        onExtraIronChange={() => {}}
        extraFuel={0}
        onExtraFuelChange={() => {}}
        extraCrystal={0}
        onExtraCrystalChange={() => {}}
        battles={[]}
        onAttack={() => {}}
        isAttacking={false}
        onOpenMap={() => {}}
      />
    );

    const battlePlannerEls = root.root.findAllByProps({ "data-testid": "battle-planner" });
    const ctaEls = root.root.findAllByProps({ "data-testid": "planner-cta" });
    const targetEls = root.root.findAllByProps({ "data-testid": "planner-step-target" });

    console.log("battle-planner count:", battlePlannerEls.length);
    console.log("planner-cta count:", ctaEls.length);
    console.log("planner-step-target count:", targetEls.length);

    // Print all data-testid props found
    const allIds: string[] = [];
    const traverse = (node: any) => {
      if (node && node.props && node.props["data-testid"]) {
        allIds.push(node.props["data-testid"]);
      }
      if (node && node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(root.toJSON());

    const unique = [...new Set(allIds)];
    console.log("all data-testids:", unique);
    console.log("counts:", allIds.reduce((acc, id) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {} as Record<string, number>));

    expect(battlePlannerEls.length).toBe(1);
    expect(ctaEls.length).toBe(1);
  });
});
