/**
 * server/storage/battle-concurrency.spec.ts
 *
 * Tripwire tests around battle resolution and land purchase — the storage
 * contract that must survive any concurrency hardening of resolveBattles /
 * deployAttack / purchaseLand:
 *
 *   - a parcel under attack cannot receive a second attack,
 *   - a pending battle past its resolveTs resolves exactly once; a second
 *     resolveBattles() pass is a no-op,
 *   - resolution clears activeBattleId and is deterministic for the stored
 *     snapshot powers,
 *   - purchase of an unowned for-sale parcel succeeds; purchase of an owned
 *     parcel is rejected.
 *
 * Runs against MemStorage (pure in-memory — no DB, no chain).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { MemStorage } from "./mem";
import type { Battle, LandParcel, Player } from "@shared/schema";

const storage = new MemStorage();
let human: Player;

/** Find a fresh unowned, for-sale, non-water parcel nobody has touched yet. */
const taken = new Set<string>();
async function freshParcel(): Promise<LandParcel> {
  const state = await storage.getGameState();
  const p = state.parcels.find(
    (p) =>
      !p.ownerId &&
      p.purchasePriceAlgo !== null &&
      p.biome !== "water" &&
      !p.activeBattleId &&
      !taken.has(p.id)
  );
  if (!p) throw new Error("no fresh parcel available");
  taken.add(p.id);
  return p;
}

async function deploy(targetParcelId: string, troops = 50): Promise<Battle> {
  return storage.deployAttack({
    attackerId: human.id,
    targetParcelId,
    troopsCommitted: troops,
    resourcesBurned: { iron: 10, fuel: 10 },
  } as any);
}

beforeAll(async () => {
  await storage.initialize();
  human = await storage.getOrCreatePlayerByAddress(
    "TESTWALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  );
  // Live reference — equip the player for attacks without the mint flow.
  human.iron = 100_000;
  human.fuel = 100_000;
  human.crystal = 100_000;
  human.commanders.push({
    id: "cmdr-test-1",
    tier: "reaper", // highest tier → max concurrent attacks
    attackBonus: 5,
  } as any);
}, 30_000);

describe("deployAttack", () => {
  it("rejects a second attack on a parcel already under attack", async () => {
    const parcel = await freshParcel();
    const battle = await deploy(parcel.id);
    expect(battle.status).toBe("pending");
    expect((await storage.getParcel(parcel.id))!.activeBattleId).toBe(battle.id);

    await expect(deploy(parcel.id)).rejects.toThrow(/already under attack/);
  });
});

describe("resolveBattles", () => {
  it("resolves a due battle exactly once and clears activeBattleId", async () => {
    const parcel = await freshParcel();
    const battle = await deploy(parcel.id);

    // Not due yet — nothing resolves.
    const early = await storage.resolveBattles();
    expect(early.find((b) => b.id === battle.id)).toBeUndefined();

    // Force the battle due (live reference into the store).
    (battle as any).resolveTs = Date.now() - 1;

    const resolved = await storage.resolveBattles();
    const mine = resolved.find((b) => b.id === battle.id);
    expect(mine).toBeDefined();
    expect(mine!.status).toBe("resolved");
    expect(["attacker_wins", "defender_wins"]).toContain(mine!.outcome!);
    expect((await storage.getParcel(parcel.id))!.activeBattleId).toBeNull();

    // A second pass must be a strict no-op for this battle.
    const again = await storage.resolveBattles();
    expect(again.find((b) => b.id === battle.id)).toBeUndefined();
    expect((await storage.getBattle(battle.id))!.status).toBe("resolved");
  });

  it("an attacker win transfers ownership to the attacker", async () => {
    const parcel = await freshParcel();
    // Overwhelming force ⇒ deterministic attacker win regardless of randFactor.
    const battle = await deploy(parcel.id, 10_000);
    (battle as any).resolveTs = Date.now() - 1;

    const resolved = await storage.resolveBattles();
    const mine = resolved.find((b) => b.id === battle.id)!;
    expect(mine.outcome).toBe("attacker_wins");
    expect((await storage.getParcel(parcel.id))!.ownerId).toBe(human.id);
  });
});

describe("purchaseLand", () => {
  it("sells an unowned for-sale parcel and records the owner", async () => {
    const parcel = await freshParcel();
    const bought = await storage.purchaseLand({ playerId: human.id, parcelId: parcel.id } as any);
    expect(bought.ownerId).toBe(human.id);
    expect(bought.purchasePriceAlgo).toBeNull();
  });

  it("rejects purchase of an owned parcel", async () => {
    const parcel = await freshParcel();
    await storage.purchaseLand({ playerId: human.id, parcelId: parcel.id } as any);
    const other = await storage.getOrCreatePlayerByAddress(
      "TESTWALLETBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
    );
    await expect(
      storage.purchaseLand({ playerId: other.id, parcelId: parcel.id } as any)
    ).rejects.toThrow(/already owned/);
  });
});
