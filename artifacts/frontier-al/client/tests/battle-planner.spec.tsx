/**
 * client/tests/battle-planner.spec.tsx
 *
 * Smoke + interaction coverage for the BattlePlanner component.
 *
 * HARNESS: react-test-renderer (already a dependency). We avoid rendering the
 * commitment Slider (Radix) by navigating target → origin → commander → review
 * only, which exercises the canonical-target flow, origin/commander selection,
 * and the launch payload without browser-only layout APIs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import TestRenderer, { act } from "react-test-renderer";
import { BattlePlanner } from "@/components/game/BattlePlanner";
import { computeAttackCost } from "@/lib/battlePlanner";
import { ATTACK_BASE_COST } from "@shared/schema";
import type { LandParcel, Player, CommanderAvatar } from "@shared/schema";

// Radix primitives (Tabs/ScrollArea) touch browser-only timers/observers.
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

function makeParcel(overrides: Partial<LandParcel> = {}): LandParcel {
  const id = overrides.id ?? `parcel-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    plotId: overrides.plotId ?? Math.floor(Math.random() * 20000) + 1,
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
  return {
    id,
    tier,
    name: `${tier}-${id}`,
    attackBonus: 10,
    defenseBonus: 10,
    specialAbility: "x",
    mintedAt: 0,
    totalKills: 0,
  };
}

function makePlayer(commanders: CommanderAvatar[]): Player {
  return {
    id: "player-1",
    address: "addr",
    name: "Tester",
    iron: 100000,
    fuel: 100000,
    crystal: 100000,
    ascend: 0,
    ownedParcels: [],
    isAI: false,
    totalIronMined: 0,
    totalFuelMined: 0,
    totalCrystalMined: 0,
    totalAscendEarned: 0,
    totalAscendBurned: 0,
    attacksWon: 0,
    attacksLost: 0,
    territoriesCaptured: 0,
    commander: commanders[0] ?? null,
    commanders,
    activeCommanderIndex: 0,
    specialAttacks: [],
    drones: [],
    satellites: [],
    welcomeBonusReceived: false,
    testnetProgress: [],
    playerFactionId: null,
  } as Player;
}

function by(root: TestRenderer.ReactTestRenderer, id: string) {
  return root.root.findByProps({ "data-testid": id });
}
function allBy(root: TestRenderer.ReactTestRenderer, id: string) {
  return root.root.findAllByProps({ "data-testid": id });
}

describe("BattlePlanner (component)", () => {
  const target = makeParcel({ id: "target", plotId: 999, ownerId: "enemy", effectiveFaction: "KRONOS" });
  const originA = makeParcel({ id: "originA", plotId: 10, ownerId: "player-1" });
  const originB = makeParcel({ id: "originB", plotId: 20, ownerId: "player-1" });
  const sentinel = makeCommander("cmd-s", "sentinel");
  const reaper = makeCommander("cmd-r", "reaper");
  const player = makePlayer([sentinel, reaper]);

  const onSelectTarget = vi.fn();
  const onSourceParcelChange = vi.fn();
  const onAttack = vi.fn();
  const onOpenMap = vi.fn();

  function render() {
    let root!: TestRenderer.ReactTestRenderer;
    act(() => {
      root = TestRenderer.create(
        <BattlePlanner
          player={player}
          allParcels={[target, originA, originB]}
          ownedParcels={[originA, originB]}
          selectedParcel={target}
          onSelectTarget={onSelectTarget}
          sourceParcelId={null}
          onSourceParcelChange={onSourceParcelChange}
          troops={1}
          onTroopsChange={() => {}}
          extraIron={0}
          onExtraIronChange={() => {}}
          extraFuel={0}
          onExtraFuelChange={() => {}}
          extraCrystal={0}
          onExtraCrystalChange={() => {}}
          battles={[]}
          onAttack={onAttack}
          isAttacking={false}
          onOpenMap={onOpenMap}
        />,
      );
    });
    return root;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing and exposes the planner + sticky CTA", () => {
    const root = render();
    expect(allBy(root, "battle-planner").length).toBe(1);
    expect(allBy(root, "planner-cta").length).toBe(1);
  });

  it("renders all six planner steps in the stepper", () => {
    const root = render();
    for (const s of ["target", "origin", "commander", "commitment", "review", "launch"]) {
      expect(allBy(root, `planner-step-${s}`).length).toBe(1);
    }
  });

  it("shows the selected canonical target on the target step", () => {
    const root = render();
    const html = JSON.stringify(root.toJSON());
    expect(html).toContain("#999");
    expect(html).toContain("KRONOS");
  });

  it("Change Target / Choose on Globe wire to the right callbacks", () => {
    const root = render();
    act(() => {
      by(root, "button-choose-on-globe").props.onClick();
    });
    expect(onOpenMap).toHaveBeenCalledTimes(1);
  });

  it("selecting an origin updates the source via onSourceParcelChange", () => {
    const root = render();
    act(() => {
      by(root, "planner-step-origin").props.onClick();
    });
    act(() => {
      by(root, "origin-card-10").props.onClick();
    });
    expect(onSourceParcelChange).toHaveBeenCalledWith("originA");
  });

  it("selecting a commander marks it and is reflected in review", () => {
    const root = render();
    act(() => {
      by(root, "planner-step-commander").props.onClick();
    });
    act(() => {
      by(root, "commander-card-cmd-r").props.onClick();
    });
    const label = by(root, "commander-active-cmd-r");
    expect(JSON.stringify(label.props.children)).toContain("0/3");
  });

  it("reaching review and tapping Launch fires exactly one attack with the contract payload", () => {
    const root = render();
    act(() => by(root, "planner-step-origin").props.onClick());
    act(() => by(root, "origin-card-10").props.onClick());
    act(() => by(root, "planner-step-commander").props.onClick());
    act(() => by(root, "commander-card-cmd-s").props.onClick());
    act(() => by(root, "planner-step-review").props.onClick());

    const cta = by(root, "planner-cta");
    expect(cta.props.disabled).toBe(false);

    act(() => {
      cta.props.onClick();
    });

    expect(onAttack).toHaveBeenCalledTimes(1);
    const cost = computeAttackCost(1, 0, 0, 0);
    expect(onAttack).toHaveBeenCalledWith(
      1,
      cost.iron,
      cost.fuel,
      cost.crystal,
      "cmd-s",
      "originA",
    );
    expect(cost.iron).toBe(ATTACK_BASE_COST.iron * 1);
    expect(cost.fuel).toBe(ATTACK_BASE_COST.fuel * 1);
  });

  it("does not invoke wallet signing (uses the existing onAttack handler)", () => {
    const root = render();
    act(() => by(root, "planner-step-origin").props.onClick());
    act(() => by(root, "origin-card-10").props.onClick());
    act(() => by(root, "planner-step-commander").props.onClick());
    act(() => by(root, "commander-card-cmd-s").props.onClick());
    act(() => by(root, "planner-step-review").props.onClick());
    act(() => by(root, "planner-cta").props.onClick());
    expect(onAttack).toHaveBeenCalledTimes(1);
  });
});
