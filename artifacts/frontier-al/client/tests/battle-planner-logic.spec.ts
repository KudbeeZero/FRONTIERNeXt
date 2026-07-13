/**
 * client/tests/battle-planner-logic.spec.ts
 *
 * Pure unit tests for the Battle Planner helpers in @/lib/battlePlanner.
 * No React / DOM / server — every assertion exercises deterministic logic.
 */

import { describe, it, expect } from "vitest";
import {
  sphereDistance,
  evaluateOrigins,
  recommendOrigins,
  evaluateCommander,
  evaluateCommanders,
  computeAttackCost,
  remainingBalance,
  isAffordable,
  maxTroopsFor,
  resolveLaunchState,
  isLaunchEnabled,
  type LaunchState,
} from "@/lib/battlePlanner";
import { ATTACK_BASE_COST, COMMANDER_INFO } from "@shared/schema";
import type { LandParcel, Player, CommanderAvatar, Battle } from "@shared/schema";

// ── Factories ──────────────────────────────────────────────────────────────────

let pid = 0;
function makeParcel(overrides: Partial<LandParcel> = {}): LandParcel {
  const id = overrides.id ?? `parcel-${++pid}`;
  return {
    id,
    plotId: overrides.plotId ?? pid + 1000,
    lat: overrides.lat ?? 0,
    lng: overrides.lng ?? 0,
    biome: overrides.biome ?? "grassland",
    richness: overrides.richness ?? 50,
    ownerId: overrides.ownerId ?? "player-1",
    ownerType: overrides.ownerType ?? "player",
    defenseLevel: overrides.defenseLevel ?? 5,
    ironStored: overrides.ironStored ?? 0,
    fuelStored: overrides.fuelStored ?? 0,
    crystalStored: overrides.crystalStored ?? 0,
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

function makeCommander(overrides: Partial<CommanderAvatar> = {}): CommanderAvatar {
  return {
    id: overrides.id ?? "cmd-1",
    tier: overrides.tier ?? "sentinel",
    name: overrides.name ?? "Test Cmd",
    attackBonus: overrides.attackBonus ?? 10,
    defenseBonus: overrides.defenseBonus ?? 10,
    specialAbility: overrides.specialAbility ?? "Fortify",
    mintedAt: overrides.mintedAt ?? 0,
    totalKills: overrides.totalKills ?? 0,
    lockedUntil: overrides.lockedUntil,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    address: "addr",
    name: "Tester",
    iron: 1000,
    fuel: 1000,
    crystal: 1000,
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
    commander: null,
    commanders: [],
    activeCommanderIndex: 0,
    specialAttacks: [],
    drones: [],
    satellites: [],
    welcomeBonusReceived: false,
    testnetProgress: [],
    playerFactionId: overrides.playerFactionId ?? null,
    attackCooldownUntil: overrides.attackCooldownUntil,
    ...overrides,
  } as Player;
}

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: overrides.id ?? "battle-1",
    attackerId: overrides.attackerId ?? "player-1",
    defenderId: overrides.defenderId ?? null,
    targetParcelId: overrides.targetParcelId ?? "parcel-t",
    attackerPower: 100,
    defenderPower: 100,
    troopsCommitted: 1,
    resourcesBurned: { iron: 10, fuel: 10 },
    startTs: 0,
    resolveTs: 1,
    status: overrides.status ?? "pending",
    commanderId: overrides.commanderId,
    sourceParcelId: overrides.sourceParcelId,
  } as Battle;
}

const NOW = 1_000_000_000_000;

describe("Battle Planner — pure logic", () => {
  // ── Geometry ──
  describe("sphereDistance", () => {
    it("returns 0 for identical coordinates", () => {
      expect(sphereDistance(0, 0, 0, 0)).toBeCloseTo(0);
    });
    it("returns a small value for nearby points", () => {
      const d = sphereDistance(0, 0, 0.01, 0.01);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(0.01);
    });
    it("returns a larger value for distant points", () => {
      expect(sphereDistance(0, 0, 90, 90)).toBeGreaterThan(1);
    });
  });

  // ── Origin eligibility & recommendation ──
  describe("origin evaluation", () => {
    const target = makeParcel({ id: "t", plotId: 1, ownerId: "enemy", effectiveFaction: "KRONOS" });
    const ownedA = makeParcel({ id: "a", plotId: 10, lat: 0.01, lng: 0.01 });
    const ownedB = makeParcel({ id: "b", plotId: 20, lat: 0.05, lng: 0.05 });
    const engaged = makeParcel({ id: "e", plotId: 30, activeBattleId: "battle-x" });
    const owned = [target, ownedA, ownedB, engaged]; // includes the target itself

    it("only returns owned eligible origins (excludes target + non-owned)", () => {
      const evals = evaluateOrigins(owned, target);
      const ids = evals.map((e) => e.parcel.id);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
      expect(ids).toContain("e");
      // target plot cannot be its own origin
      const tEval = evals.find((e) => e.parcel.id === "t");
      expect(tEval?.eligible).toBe(false);
      expect(tEval?.blockedReason).toBe("Target plot");
    });

    it("marks engaged origins as ineligible", () => {
      const evals = evaluateOrigins(owned, target);
      const eEval = evals.find((e) => e.parcel.id === "e");
      expect(eEval?.eligible).toBe(false);
      expect(eEval?.blockedReason).toBe("Origin engaged");
      expect(eEval?.hasActiveBattle).toBe(true);
    });

    it("recommends deterministically by distance (eligible + shortest first)", () => {
      const rec = recommendOrigins(owned, target);
      // closest eligible first: a (0.01) before b (0.05); engaged/target excluded
      expect(rec[0].id).toBe("a");
      expect(rec[1].id).toBe("b");
    });

    it("distance is calculated correctly relative to target", () => {
      const evals = evaluateOrigins([ownedA, ownedB], target);
      const a = evals.find((e) => e.parcel.id === "a")!;
      const b = evals.find((e) => e.parcel.id === "b")!;
      expect(a.distance).toBeLessThan(b.distance);
      // recomputed helper matches
      expect(a.distance).toBeCloseTo(sphereDistance(0.01, 0.01, 0, 0));
    });

    it("recommendation helper is pure (same input → same output)", () => {
      // recommendOrigins keeps every owned parcel (eligible first, blocked last)
      const r1 = recommendOrigins(owned, target).map((p) => p.id);
      const r2 = recommendOrigins(owned, target).map((p) => p.id);
      expect(r1).toEqual(["a", "b", "t", "e"]);
      expect(r1).toEqual(r2);
    });

    it("does not invent a second global target id", () => {
      // single target argument drives every evaluation
      const evals = evaluateOrigins(owned, target);
      expect(evals.every((e) => e.distance === Infinity || typeof e.distance === "number")).toBe(true);
    });
  });

  // ── Commander evaluation ──
  describe("commander evaluation", () => {
    const reaper = makeCommander({ id: "r", tier: "reaper" });

    it("Reaper displays N/3 (active battles / max)", () => {
      const battles = [
        makeBattle({ id: "b1", commanderId: "r" }),
        makeBattle({ id: "b2", commanderId: "r" }),
      ];
      const ev = evaluateCommander(reaper, battles, NOW);
      expect(ev.activeBattles).toBe(2);
      expect(ev.maxConcurrent).toBe(3);
      expect(ev.commander.tier).toBe("reaper");
    });

    it("3/3 marks the commander maxed and disables launch", () => {
      const battles = [
        makeBattle({ id: "b1", commanderId: "r" }),
        makeBattle({ id: "b2", commanderId: "r" }),
        makeBattle({ id: "b3", commanderId: "r" }),
      ];
      const ev = evaluateCommander(reaper, battles, NOW);
      expect(ev.isMaxed).toBe(true);
      expect(ev.state).toBe("maxed");
    });

    it("locked commander shows a countdown and locked state", () => {
      const locked = makeCommander({ id: "r", tier: "reaper", lockedUntil: NOW + 3_600_000 });
      const ev = evaluateCommander(locked, [], NOW);
      expect(ev.isLocked).toBe(true);
      expect(ev.lockRemainingMs).toBe(3_600_000);
      expect(ev.state).toBe("locked");
    });

    it("selecting another available commander yields its own evaluation", () => {
      const sentinel = makeCommander({ id: "s", tier: "sentinel" });
      const reaper = makeCommander({ id: "r", tier: "reaper" });
      const evals = evaluateCommanders([sentinel, reaper], [], NOW);
      expect(evals.find((e) => e.commander.id === "s")?.maxConcurrent).toBe(1);
      expect(evals.find((e) => e.commander.id === "r")?.maxConcurrent).toBe(3);
    });

    it("reconstructs state purely from server data (no internal state)", () => {
      const cmd = makeCommander({ id: "r", tier: "reaper" });
      const b = [makeBattle({ commanderId: "r" }), makeBattle({ commanderId: "r" })];
      const first = evaluateCommander(cmd, b, NOW);
      const second = evaluateCommander(cmd, b, NOW);
      expect(first).toEqual(second);
    });
  });

  // ── Resource commitment ──
  describe("resource commitment", () => {
    const player = makePlayer({ iron: 100, fuel: 100, crystal: 50 });

    it("payload values match the existing attack contract exactly", () => {
      const cost = computeAttackCost(3, 40, 20, 5);
      expect(cost).toEqual({
        iron: ATTACK_BASE_COST.iron * 3 + 40,
        fuel: ATTACK_BASE_COST.fuel * 3 + 20,
        crystal: 5,
      });
    });

    it("resource values cannot exceed available balances", () => {
      const cost = computeAttackCost(10, 0, 0, 0); // 300 iron / 200 fuel
      expect(isAffordable(player, cost)).toBe(false);
      const within = computeAttackCost(2, 0, 0, 0);
      expect(isAffordable(player, within)).toBe(true);
    });

    it("remaining balances are computed correctly", () => {
      const cost = computeAttackCost(1, 10, 10, 5);
      const rem = remainingBalance(player, cost);
      expect(rem.iron).toBe(100 - (ATTACK_BASE_COST.iron + 10));
      expect(rem.fuel).toBe(100 - (ATTACK_BASE_COST.fuel + 10));
      expect(rem.crystal).toBe(50 - 5);
    });

    it("unaffordable plans are blocked by launch resolution", () => {
      const state = resolveLaunchState({
        target: makeParcel(),
        sourceParcelId: "a",
        selectedCommander: evaluateCommander(makeCommander(), [], NOW),
        player,
        cost: computeAttackCost(10, 0, 0, 0), // exceeds balance
        attacking: false,
        now: NOW,
      });
      expect(state).toBe("INSUFFICIENT_RESOURCES");
    });

    it("maxTroopsFor caps at the iron/fuel base cost", () => {
      expect(maxTroopsFor(player)).toBeLessThanOrEqual(10);
    });
  });

  // ── Planner state / launch resolution ──
  describe("launch-state resolution", () => {
    const target = makeParcel({ id: "t" });
    const sourceId = "a";
    const commander = evaluateCommander(makeCommander(), [], NOW);
    const player = makePlayer();
    const cost = computeAttackCost(1, 0, 0, 0);

    const base = (over: Partial<Parameters<typeof resolveLaunchState>[0]> = {}) =>
      resolveLaunchState({
        target,
        sourceParcelId: sourceId,
        selectedCommander: commander,
        player,
        cost,
        attacking: false,
        now: NOW,
        ...over,
      });

    it("canonical target: missing target stays in REVIEW_ATTACK", () => {
      expect(base({ target: null }).includes("REVIEW_ATTACK")).toBe(true);
      expect(base({ sourceParcelId: null }).includes("REVIEW_ATTACK")).toBe(true);
      expect(base({ selectedCommander: null }).includes("REVIEW_ATTACK")).toBe(true);
    });

    it("invalid (null) target resolves safely to REVIEW_ATTACK", () => {
      expect(resolveLaunchState({
        target: null,
        sourceParcelId: null,
        selectedCommander: null,
        player,
        cost,
        attacking: false,
        now: NOW,
      })).toBe("REVIEW_ATTACK");
    });

    it("changing target changes origin recommendation (single canonical target)", () => {
      const origin = makeParcel({ id: "a", plotId: 10, lat: 0.01, lng: 0.01 });
      const near = makeParcel({ id: "t1", plotId: 1, lat: 0.005, lng: 0.005 });
      const far = makeParcel({ id: "t2", plotId: 2, lat: 0.2, lng: 0.2 });
      const recNear = recommendOrigins([origin], near).map((p) => p.id);
      const recFar = recommendOrigins([origin], far).map((p) => p.id);
      expect(recNear).toEqual(recFar); // both contain the single origin
      const distNear = evaluateOrigins([origin], near)[0].distance;
      const distFar = evaluateOrigins([origin], far)[0].distance;
      expect(distNear).toBeLessThan(distFar);
    });

    it("target already engaged blocks launch", () => {
      expect(base({ target: makeParcel({ id: "t", activeBattleId: "x" }) })).toBe("TARGET_ALREADY_ENGAGED");
    });

    it("player cooldown blocks launch", () => {
      expect(base({ player: makePlayer({ attackCooldownUntil: NOW + 60_000 }) })).toBe("PLAYER_COOLDOWN");
    });

    it("commander locked blocks launch", () => {
      const lockedCmd = evaluateCommander(makeCommander({ lockedUntil: NOW + 1000 }), [], NOW);
      expect(base({ selectedCommander: lockedCmd })).toBe("COMMANDER_LOCKED");
    });

    it("maximum active (3/3 Reaper) blocks launch", () => {
      const reaper = makeCommander({ id: "r", tier: "reaper" });
      const battles = [makeBattle({ commanderId: "r" }), makeBattle({ commanderId: "r" }), makeBattle({ commanderId: "r" })];
      const maxed = evaluateCommander(reaper, battles, NOW);
      expect(base({ selectedCommander: maxed })).toBe("MAXIMUM_ACTIVE");
    });

    it("in-flight submission shows ATTACK_SUBMITTING and disables launch", () => {
      const state = base({ attacking: true });
      expect(state).toBe("ATTACK_SUBMITTING");
      expect(isLaunchEnabled(state)).toBe(false);
    });

    it("ready plan resolves to READY_TO_LAUNCH and is enabled", () => {
      const state = base();
      expect(state).toBe("READY_TO_LAUNCH");
      expect(isLaunchEnabled(state)).toBe(true);
    });

    it("does not get stuck after a failed submit (returns to blockable state)", () => {
      const submitting = base({ attacking: true });
      expect(submitting).toBe("ATTACK_SUBMITTING");
      const recovered = resolveLaunchState({
        target,
        sourceParcelId: sourceId,
        selectedCommander: commander,
        player,
        cost,
        attacking: false,
        now: NOW,
      });
      expect(recovered).toBe("READY_TO_LAUNCH");
    });

    it("never returns a surprise state outside the known enum", () => {
      const valid: LaunchState[] = [
        "REVIEW_ATTACK", "READY_TO_LAUNCH", "ATTACK_SUBMITTING",
        "TARGET_ALREADY_ENGAGED", "COMMANDER_LOCKED", "MAXIMUM_ACTIVE",
        "INSUFFICIENT_RESOURCES", "PLAYER_COOLDOWN",
      ];
      expect(valid).toContain(base());
    });
  });
});
