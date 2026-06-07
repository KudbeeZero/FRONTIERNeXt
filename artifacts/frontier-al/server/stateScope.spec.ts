import { describe, it, expect } from "vitest";
import { scopeGameStateFor } from "./stateScope";
import type { GameState, LandParcel, Player } from "@shared/schema";

const parcel = (id: string, ownerId: string | null, isAi = false): LandParcel =>
  ({
    id,
    plotId: Number(id.replace(/\D/g, "")) || 0,
    ownerId,
    ownerType: ownerId ? (isAi ? "ai" : "player") : null,
    ironStored: 100,
    fuelStored: 200,
    crystalStored: 300,
    frontierAccumulated: 50,
    frontierPerDay: 10,
    biome: "plains",
  }) as unknown as LandParcel;

const player = (id: string, isAI = false): Player =>
  ({
    id,
    address: `ADDR_${id}`,
    name: id,
    isAI,
    iron: 11,
    fuel: 22,
    crystal: 33,
    frontier: 44,
    treasury: 999,
    lootBoxes: [{ tier: "common" }],
    testnetProgress: ["m1"],
  }) as unknown as Player;

const baseState = (): GameState =>
  ({
    parcels: [parcel("p1", "me"), parcel("p2", "enemy"), parcel("p3", "ai1", true), parcel("p4", null)],
    players: [player("me"), player("enemy"), player("ai1", true)],
    battles: [],
    events: [],
    leaderboard: [],
    currentTurn: 1,
    lastUpdateTs: 0,
    totalPlots: 4,
    claimedPlots: 3,
    frontierTotalSupply: 0,
    frontierCirculating: 0,
    currentSeason: null,
  }) as unknown as GameState;

describe("scopeGameStateFor", () => {
  it("keeps the viewer's own parcel resources, redacts all others", () => {
    const s = scopeGameStateFor(baseState(), "me");
    const own = s.parcels.find((p) => p.id === "p1")!;
    const enemy = s.parcels.find((p) => p.id === "p2")!;
    const ai = s.parcels.find((p) => p.id === "p3")!;
    const unclaimed = s.parcels.find((p) => p.id === "p4")!;

    expect(own.ironStored).toBe(100);
    expect(own.crystalStored).toBe(300);
    for (const p of [enemy, ai, unclaimed]) {
      expect(p.ironStored).toBe(0);
      expect(p.fuelStored).toBe(0);
      expect(p.crystalStored).toBe(0);
      expect(p.frontierAccumulated).toBe(0);
    }
    // Non-economic fields are preserved (map still renders).
    expect(enemy.ownerId).toBe("enemy");
    expect(enemy.biome).toBe("plains");
  });

  it("keeps the viewer's own balances, redacts other human players, leaves AI intact", () => {
    const s = scopeGameStateFor(baseState(), "me");
    const me = s.players.find((p) => p.id === "me")!;
    const enemy = s.players.find((p) => p.id === "enemy")!;
    const ai = s.players.find((p) => p.id === "ai1")!;

    expect(me.frontier).toBe(44);
    expect(me.iron).toBe(11);

    expect(enemy.iron).toBe(0);
    expect(enemy.frontier).toBe(0);
    expect(enemy.treasury).toBe(0);
    expect(enemy.lootBoxes).toEqual([]);
    expect(enemy.testnetProgress).toEqual([]);
    // Public identity preserved for name lookups.
    expect(enemy.name).toBe("enemy");
    expect(enemy.address).toBe("ADDR_enemy");

    // AI economy is public game state — untouched.
    expect(ai.iron).toBe(11);
    expect(ai.treasury).toBe(999);
  });

  it("redacts everything for an unauthenticated viewer", () => {
    const s = scopeGameStateFor(baseState(), null);
    expect(s.parcels.every((p) => p.ironStored === 0)).toBe(true);
    expect(s.players.find((p) => p.id === "me")!.frontier).toBe(0);
    expect(s.players.find((p) => p.id === "enemy")!.frontier).toBe(0);
    // AI still intact.
    expect(s.players.find((p) => p.id === "ai1")!.iron).toBe(11);
  });

  it("does not mutate the original state", () => {
    const original = baseState();
    scopeGameStateFor(original, "me");
    expect(original.parcels.find((p) => p.id === "p2")!.ironStored).toBe(100);
    expect(original.players.find((p) => p.id === "enemy")!.frontier).toBe(44);
  });
});
