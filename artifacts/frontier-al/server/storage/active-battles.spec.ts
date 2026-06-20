/**
 * server/storage/active-battles.spec.ts
 *
 * getActiveBattles() returns the pending battles whose countdown is still running
 * (resolveTs in the future) — the set the battle_tick broadcast pushes. It must be
 * the complement of resolveBattles' "due" set: a battle past its resolveTs, or one
 * already resolved, is NOT active.
 *
 * Runs against MemStorage (pure in-memory — no DB, no chain).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { MemStorage } from "./mem";
import type { Battle, LandParcel, Player } from "@shared/schema";

const storage = new MemStorage();
let human: Player;

const taken = new Set<string>();
async function freshParcel(): Promise<LandParcel> {
  const state = await storage.getGameState();
  const p = state.parcels.find(
    (p) => !p.ownerId && p.purchasePriceAlgo !== null && p.biome !== "water" && !p.activeBattleId && !taken.has(p.id),
  );
  if (!p) throw new Error("no fresh parcel available");
  taken.add(p.id);
  return p;
}

async function deploy(targetParcelId: string): Promise<Battle> {
  return storage.deployAttack({
    attackerId: human.id,
    targetParcelId,
    troopsCommitted: 50,
    resourcesBurned: { iron: 10, fuel: 10 },
  } as any);
}

beforeAll(async () => {
  await storage.initialize();
  human = await storage.getOrCreatePlayerByAddress("TESTACTIVEBATTLESAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  human.iron = 100_000;
  human.fuel = 100_000;
  human.crystal = 100_000;
  human.commanders.push({ id: "cmdr-active-1", tier: "reaper", attackBonus: 5 } as any);
}, 30_000);

describe("getActiveBattles", () => {
  it("includes a pending battle whose resolveTs is still in the future", async () => {
    const parcel = await freshParcel();
    const battle = await deploy(parcel.id);
    expect(battle.resolveTs).toBeGreaterThan(Date.now()); // default duration is in the future

    const active = await storage.getActiveBattles();
    expect(active.find((b) => b.id === battle.id)).toBeDefined();
  });

  it("excludes a battle whose countdown has elapsed (that is resolveBattles' job)", async () => {
    const parcel = await freshParcel();
    const battle = await deploy(parcel.id);

    // Force the countdown to have elapsed — live reference into the store.
    (battle as any).resolveTs = Date.now() - 1;

    const active = await storage.getActiveBattles();
    expect(active.find((b) => b.id === battle.id)).toBeUndefined();
  });

  it("excludes a resolved battle", async () => {
    const parcel = await freshParcel();
    const battle = await deploy(parcel.id);
    (battle as any).resolveTs = Date.now() - 1;
    await storage.resolveBattles(); // → status "resolved"

    const active = await storage.getActiveBattles();
    expect(active.find((b) => b.id === battle.id)).toBeUndefined();
    expect((await storage.getBattle(battle.id))!.status).toBe("resolved");
  });
});
