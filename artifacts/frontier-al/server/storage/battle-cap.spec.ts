/**
 * server/storage/battle-cap.spec.ts
 *
 * Active-battle cap (Reaper = 3) and Commander lock regression tests.
 * Uses its own MemStorage instance so the cap tests don't pollute the
 * shared state in battle-concurrency.spec.ts.
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
    "TESTCAPHUMANAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  );
  human.iron = 100_000;
  human.fuel = 100_000;
  human.crystal = 100_000;
  human.commanders.push({
    id: "cmdr-cap-1",
    tier: "reaper",
    attackBonus: 5,
  } as any);
}, 30_000);

describe("deployAttack active-battle cap (Reaper = 3)", () => {
  async function cleanPending() {
    for (let i = 0; i < 3; i++) {
      const pending = (await storage.getGameState()).battles.filter(
        b => b.attackerId === human.id && b.status === "pending",
      );
      for (const b of pending) {
        (b as any).resolveTs = Date.now() - 1;
      }
      if (pending.length > 0) await storage.resolveBattles();
    }
  }

  it("permits 1/3, 2/3, and 3/3 pending battles", async () => {
    await cleanPending();
    const p1 = await freshParcel();
    const p2 = await freshParcel();
    const p3 = await freshParcel();
    await deploy(p1.id);
    await deploy(p2.id);
    await deploy(p3.id);
    const state = await storage.getGameState();
    const pending = state.battles.filter(b => b.attackerId === human.id && b.status === "pending");
    expect(pending).toHaveLength(3);
  });

  it("rejects a fourth pending battle", async () => {
    await cleanPending();
    const p1 = await freshParcel();
    const p2 = await freshParcel();
    const p3 = await freshParcel();
    await deploy(p1.id);
    await deploy(p2.id);
    await deploy(p3.id);
    const p4 = await freshParcel();
    await expect(deploy(p4.id)).rejects.toThrow(/Attack limit reached/);
  });

  it("resolving one battle releases one slot", async () => {
    await cleanPending();
    const p1 = await freshParcel();
    const p2 = await freshParcel();
    const b1 = await deploy(p1.id);
    await deploy(p2.id);
    expect(await storage.getGameState().then(s => s.battles.filter(b => b.attackerId === human.id && b.status === "pending").length)).toBe(2);

    (b1 as any).resolveTs = Date.now() - 1;
    await storage.resolveBattles();
    expect(await storage.getGameState().then(s => s.battles.filter(b => b.attackerId === human.id && b.status === "pending").length)).toBe(1);
  });

  it("target with activeBattleId is rejected", async () => {
    await cleanPending();
    const parcel = await freshParcel();
    await deploy(parcel.id);
    await expect(deploy(parcel.id)).rejects.toThrow(/already under attack/);
  });

  it("rapid duplicate launch produces no duplicate battle", async () => {
    await cleanPending();
    const parcel = await freshParcel();
    await deploy(parcel.id);
    const state1 = await storage.getGameState();
    const count1 = state1.battles.filter(b => b.attackerId === human.id).length;
    await expect(deploy(parcel.id)).rejects.toThrow(/already under attack/);
    const state2 = await storage.getGameState();
    expect(state2.battles.filter(b => b.attackerId === human.id).length).toBe(count1);
  });
});

describe("Commander lock", () => {
  it("rejects attack when Commander is locked", async () => {
    for (let i = 0; i < 3; i++) {
      const pending = (await storage.getGameState()).battles.filter(
        b => b.attackerId === human.id && b.status === "pending",
      );
      for (const b of pending) {
        (b as any).resolveTs = Date.now() - 1;
      }
      if (pending.length > 0) await storage.resolveBattles();
    }

    const player = await storage.getPlayer(human.id);
    if (!player) throw new Error("player not found");
    const cmd = player.commanders[0];
    (cmd as any).lockedUntil = Date.now() + 60_000;

    const parcel = await freshParcel();
    await expect(
      storage.deployAttack({
        attackerId: human.id,
        targetParcelId: parcel.id,
        troopsCommitted: 1,
        resourcesBurned: { iron: 10, fuel: 10 },
        commanderId: cmd.id,
      } as any)
    ).rejects.toThrow(/deployed and unavailable/);
  });
});
