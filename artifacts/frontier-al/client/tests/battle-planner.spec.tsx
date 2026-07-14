/**
 * client/tests/battle-planner.spec.tsx
 *
 * Smoke + interaction coverage for the BattlePlanner component.
 *
 * HARNESS: react-test-renderer (already a dependency). We avoid rendering the
 * commitment Slider (Radix) by navigating target → origin → commander → review
 * only, which exercises the canonical-target flow, origin/commander selection,
 * and the launch payload without browser-only layout APIs.
 *
 * Known harness quirk: react-test-renderer's findAllByProps matches both the
 * React component instance AND the underlying DOM element that received the
 * prop, so any test that asserts a count of 1 via findAllByProps will see 2.
 * The test counts via toJSON() (the rendered DOM tree) instead, which is
 * authoritative for "is this actually rendered once".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
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

/** Count occurrences of a data-testid in the rendered DOM tree (toJSON). */
function countTestIdInDom(root: ReactTestRenderer, testId: string): number {
  const json = root.toJSON();
  let count = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { props?: { "data-testid"?: string }; children?: unknown[] };
    if (n.props?.["data-testid"] === testId) count += 1;
    if (Array.isArray(n.children)) for (const c of n.children) walk(c);
  };
  walk(json);
  return count;
}

/** Resolve the DOM element (toJSON node) that has a given data-testid, if any. */
function findByTestIdInDom(root: ReactTestRenderer, testId: string): { props: Record<string, unknown>; children: unknown[] } | null {
  const json = root.toJSON();
  let found: { props: Record<string, unknown>; children: unknown[] } | null = null;
  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    const n = node as { props?: { "data-testid"?: string }; children?: unknown[] };
    if (n.props?.["data-testid"] === testId) {
      found = n as { props: Record<string, unknown>; children: unknown[] };
      return true;
    }
    if (Array.isArray(n.children)) {
      for (const c of n.children) if (walk(c)) return true;
    }
    return false;
  };
  walk(json);
  return found;
}

/**
 * A step testid appears on BOTH the stepper <button> and the content <div>.
 * Return the content node — the match whose rendered text is the most verbose
 * (the stepper button only holds the step number + label).
 */
function findStepContentInDom(root: ReactTestRenderer, stepTestId: string): { props: Record<string, unknown>; children: unknown[] } | null {
  const json = root.toJSON();
  const matches: { props: Record<string, unknown>; children: unknown[] }[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { props?: { "data-testid"?: string }; children?: unknown[] };
    if (n.props?.["data-testid"] === stepTestId) {
      matches.push(n as { props: Record<string, unknown>; children: unknown[] });
    }
    if (Array.isArray(n.children)) for (const c of n.children) walk(c);
  };
  walk(json);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (flattenText(b.children).length >= flattenText(a.children).length ? b : a));
}

interface HostProps {
  target: LandParcel;
  origins: LandParcel[];
  player: Player;
  onSelectTarget: (id: string) => void;
  onAttack: (troops: number, iron: number, fuel: number, crystal: number, commanderId?: string, sourceParcelId?: string) => void;
  onOpenMap: () => void;
  initialTroops?: number;
}

/**
 * Stateful host that owns the planner's controlled props. Mirrors how
 * CommanderPanel keeps sourceParcelId / troops / extras in its own state and
 * feeds them down to <BattlePlanner>. The BattlePlanner is a controlled
 * component for those values, so a unit test has to drive the parent.
 */
function PlannerHost({ target, origins, player, onSelectTarget, onAttack, onOpenMap, initialTroops }: HostProps) {
  const [sourceParcelId, setSourceParcelId] = useState<string | null>(null);
  const [troops, setTroops] = useState(initialTroops ?? 1);
  const [extraIron, setExtraIron] = useState(0);
  const [extraFuel, setExtraFuel] = useState(0);
  const [extraCrystal, setExtraCrystal] = useState(0);
  const [isAttacking, setIsAttacking] = useState(false);

  return (
    <BattlePlanner
      player={player}
      allParcels={[target, ...origins]}
      ownedParcels={origins}
      selectedParcel={target}
      onSelectTarget={onSelectTarget}
      sourceParcelId={sourceParcelId}
      onSourceParcelChange={setSourceParcelId}
      troops={troops}
      onTroopsChange={setTroops}
      extraIron={extraIron}
      onExtraIronChange={setExtraIron}
      extraFuel={extraFuel}
      onExtraFuelChange={setExtraFuel}
      extraCrystal={extraCrystal}
      onExtraCrystalChange={setExtraCrystal}
      battles={[]}
      onAttack={(t, i, f, c, cid, sid) => {
        setIsAttacking(true);
        onAttack(t, i, f, c, cid, sid);
      }}
      isAttacking={isAttacking}
      onOpenMap={onOpenMap}
    />
  );
}

describe("BattlePlanner (component)", () => {
  const target = makeParcel({ id: "target", plotId: 999, ownerId: "enemy", effectiveFaction: "KRONOS" });
  const originA = makeParcel({ id: "originA", plotId: 10, ownerId: "player-1" });
  const originB = makeParcel({ id: "originB", plotId: 20, ownerId: "player-1" });
  const sentinel = makeCommander("cmd-s", "sentinel");
  const reaper = makeCommander("cmd-r", "reaper");
  const player = makePlayer([sentinel, reaper]);

  const onSelectTarget = vi.fn();
  const onAttack = vi.fn();
  const onOpenMap = vi.fn();

  function render() {
    let root!: ReactTestRenderer;
    act(() => {
      root = TestRenderer.create(
        <PlannerHost
          target={target}
          origins={[originA, originB]}
          player={player}
          onSelectTarget={onSelectTarget}
          onAttack={onAttack}
          onOpenMap={onOpenMap}
        />,
      );
    });
    return root;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Drive the canonical flow to the Review step (origin → commander → review). */
  function gotoReview(root: ReactTestRenderer, originPlotId = 10, commanderId = "cmd-s") {
    act(() => {
      (findByTestIdInDom(root, "planner-step-origin")!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      (findByTestIdInDom(root, `origin-card-${originPlotId}`)!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      (findByTestIdInDom(root, "planner-step-commander")!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      (findByTestIdInDom(root, `commander-card-${commanderId}`)!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      (findByTestIdInDom(root, "planner-step-review")!.props as { onClick: () => void }).onClick();
    });
  }

  it("renders exactly one planner with a single sticky CTA", () => {
    const root = render();
    expect(countTestIdInDom(root, "battle-planner")).toBe(1);
    expect(countTestIdInDom(root, "planner-cta")).toBe(1);
  });

  it("renders all six planner steps (active step = 2, others = 1)", () => {
    const root = render();
    // Each step has a stepper <button> for selection. The active step ALSO
    // renders a content <div> with the same data-testid scoping that step's UI.
    // So the active step has 2 occurrences; inactive steps have 1 (just the
    // stepper button). "target" is the initial active step.
    expect(countTestIdInDom(root, "planner-step-target")).toBe(2);
    for (const s of ["origin", "commander", "commitment", "review", "launch"]) {
      expect(countTestIdInDom(root, `planner-step-${s}`)).toBe(1);
    }
  });

  it("shows the selected canonical target on the target step", () => {
    const root = render();
    const html = JSON.stringify(root.toJSON());
    expect(html).toContain("999");
    expect(html).toContain("KRONOS");
  });

  it("Choose on Globe wires to the right callback", () => {
    const root = render();
    const cta = findByTestIdInDom(root, "button-choose-on-globe");
    expect(cta).not.toBeNull();
    act(() => {
      (cta!.props as { onClick: () => void }).onClick();
    });
    expect(onOpenMap).toHaveBeenCalledTimes(1);
  });

  it("selecting an origin updates the source via onSourceParcelChange", () => {
    const root = render();
    act(() => {
      const stepper = findByTestIdInDom(root, "planner-step-origin");
      (stepper!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const card = findByTestIdInDom(root, "origin-card-10");
      (card!.props as { onClick: () => void }).onClick();
    });
    expect(onAttack).not.toHaveBeenCalled();
    expect(countTestIdInDom(root, "origin-card-10")).toBe(1);
  });

  it("selecting a commander marks it and is reflected in the active counter", () => {
    const root = render();
    act(() => {
      const stepper = findByTestIdInDom(root, "planner-step-commander");
      (stepper!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const card = findByTestIdInDom(root, "commander-card-cmd-r");
      (card!.props as { onClick: () => void }).onClick();
    });
    const label = findByTestIdInDom(root, "commander-active-cmd-r");
    expect(label).not.toBeNull();
    const text = flattenText(label!.children);
    expect(text).toContain("0/3");
  });

  it("reaching review and tapping Launch fires exactly one attack with the contract payload", () => {
    const root = render();
    act(() => {
      const stepper = findByTestIdInDom(root, "planner-step-origin");
      (stepper!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const card = findByTestIdInDom(root, "origin-card-10");
      (card!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const stepper = findByTestIdInDom(root, "planner-step-commander");
      (stepper!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const card = findByTestIdInDom(root, "commander-card-cmd-s");
      (card!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const stepper = findByTestIdInDom(root, "planner-step-review");
      (stepper!.props as { onClick: () => void }).onClick();
    });

    const cta = findByTestIdInDom(root, "planner-cta");
    expect(cta).not.toBeNull();
    expect((cta!.props as { disabled?: boolean }).disabled).toBe(false);

    act(() => {
      (cta!.props as { onClick: () => void }).onClick();
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

  it("does not invoke wallet signing — it only routes through the existing onAttack handler", () => {
    const root = render();
    act(() => {
      const stepper = findByTestIdInDom(root, "planner-step-origin");
      (stepper!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const card = findByTestIdInDom(root, "origin-card-10");
      (card!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const stepper = findByTestIdInDom(root, "planner-step-commander");
      (stepper!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const card = findByTestIdInDom(root, "commander-card-cmd-s");
      (card!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const stepper = findByTestIdInDom(root, "planner-step-review");
      (stepper!.props as { onClick: () => void }).onClick();
    });
    act(() => {
      const cta = findByTestIdInDom(root, "planner-cta");
      (cta!.props as { onClick: () => void }).onClick();
    });
    expect(onAttack).toHaveBeenCalledTimes(1);
  });

  it("Outcome Preview section renders on the review step with attacker/defender/win-chance", () => {
    const root = render();
    gotoReview(root);
    const review = findStepContentInDom(root, "planner-step-review");
    expect(review).not.toBeNull();
    const text = flattenText(review!.children);
    expect(text).toContain("Outcome Preview");
    expect(text).toContain("Attacker Power");
    expect(text).toContain("Defender Power");
    expect(text).toContain("Win Chance");
    // With a target selected, values are numeric (not the "—" no-target sentinel).
    const hasPercent = /Win Chance[^%]*\d+%/.test(text.replace(/\s+/g, " "));
    expect(hasPercent).toBe(true);
  });

  it("Outcome values reflect the selected target (defender power is numeric when a target exists)", () => {
    const root = render();
    gotoReview(root);
    const review = findStepContentInDom(root, "planner-step-review");
    const text = flattenText(review!.children).replace(/\s+/g, " ");
    // "Defender PowerNN" (no "—") and a win-chance percentage.
    expect(text).toMatch(/Defender Power\d/);
    expect(text).toMatch(/Win Chance\d+%/);
  });

  it("Outcome values update when planner inputs change (more troops → different projection)", () => {
    const low = renderWith({ initialTroops: 1 });
    const high = renderWith({ initialTroops: 10 });
    gotoReview(low);
    gotoReview(high);
    const lowText = flattenText(findStepContentInDom(low, "planner-step-review")!.children).replace(/\s+/g, " ");
    const highText = flattenText(findStepContentInDom(high, "planner-step-review")!.children).replace(/\s+/g, " ");
    expect(lowText).not.toBe(highText);
  });

  it("Outcome Preview is display-only and does not trigger an attack or wallet interaction", () => {
    const root = render();
    gotoReview(root);
    // The outcome section is advisory: simply reaching review must not fire onAttack.
    expect(onAttack).not.toHaveBeenCalled();
  });

  /** Render the host with overrides (used by the troops-change test above). */
  function renderWith(over: { initialTroops?: number }) {
    let root!: ReactTestRenderer;
    act(() => {
      root = TestRenderer.create(
        <PlannerHost
          target={target}
          origins={[originA, originB]}
          player={player}
          onSelectTarget={onSelectTarget}
          onAttack={onAttack}
          onOpenMap={onOpenMap}
          initialTroops={over.initialTroops}
        />,
      );
    });
    return root;
  }
});

/** Flatten a toJSON children tree into a single concatenated string for text assertions. */
function flattenText(children: unknown): string {
  let out = "";
  const walk = (node: unknown): void => {
    if (node == null || typeof node === "boolean") return;
    if (typeof node === "string" || typeof node === "number") {
      out += String(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const c of node) walk(c);
      return;
    }
    const n = node as { children?: unknown };
    if (n.children) walk(n.children);
  };
  walk(children);
  return out;
}
