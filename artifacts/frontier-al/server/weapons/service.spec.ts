import { describe, it, expect } from "vitest";
import { MemStorage } from "../storage/mem";
import { EngagementStore } from "./engagementStore";
import * as svc from "./service";
import { ALL_WEAPONS } from "@shared/weapons";

async function setup(funded = 100_000) {
  const storage = new MemStorage();
  const player = await storage.getOrCreatePlayerByAddress(
    "WEAPONSVCADDRESS0000000000000000000000000000000000000000",
  );
  // MemStorage returns the live object reference — fund it for spend tests.
  const p = await storage.getPlayer(player.id);
  if (p) p.ascend = funded;
  return { storage, store: new EngagementStore(), playerId: player.id, player: p! };
}

describe("weapon service · build + catalog", () => {
  it("persists a valid attribute build and derives the archetype", async () => {
    const { storage, playerId } = await setup();
    const profile = await svc.buildProfile(storage, playerId, {
      firepower: 16, range: 10, guidance: 0, interception: 0, logistics: 0,
    });
    expect(profile.archetypeId).toBe("siege_baron");
  });

  it("rejects an over-budget build", async () => {
    const { storage, playerId } = await setup();
    await expect(
      svc.buildProfile(storage, playerId, {
        firepower: 20, range: 20, guidance: 20, interception: 20, logistics: 20,
      }),
    ).rejects.toThrow();
  });

  it("annotates the full catalog with unlock/own state + costs", async () => {
    const { storage, playerId } = await setup();
    const { entries } = await svc.getCatalog(storage, playerId);
    expect(entries).toHaveLength(ALL_WEAPONS.length);
    const base = entries.find((e) => e.spec.id === "msl_ballistic_1")!;
    expect(base.unlocked).toBe(true);
    expect(base.owned).toBe(false);
    expect(base.fireCost).toBeGreaterThan(0);
    const apex = entries.find((e) => e.spec.id === "msl_hyper_4")!;
    expect(apex.unlocked).toBe(false); // requires demolition: hall_of_fame
  });
});

describe("weapon service · unlock", () => {
  it("acquires an unlocked weapon and spends ASCEND", async () => {
    const { storage, playerId, player } = await setup(1000);
    const before = player.ascend;
    const profile = await svc.unlockWeapon(storage, playerId, "msl_ballistic_1");
    expect(profile.ownedWeapons.some((w) => w.specId === "msl_ballistic_1")).toBe(true);
    expect(player.ascend).toBeLessThan(before);
  });

  it("refuses a locked weapon", async () => {
    const { storage, playerId } = await setup();
    await expect(svc.unlockWeapon(storage, playerId, "msl_hyper_4")).rejects.toThrow(/locked/i);
  });

  it("refuses when ASCEND is insufficient", async () => {
    const { storage, playerId } = await setup(0);
    await expect(svc.unlockWeapon(storage, playerId, "msl_ballistic_1")).rejects.toThrow(/insufficient/i);
  });
});

describe("weapon service · upgrade", () => {
  it("raises the upgrade tier and spends ASCEND", async () => {
    const { storage, playerId, player } = await setup();
    const owned = (await svc.unlockWeapon(storage, playerId, "msl_ballistic_1")).ownedWeapons[0];
    const before = player.ascend;
    const profile = await svc.upgradeWeapon(storage, playerId, owned.id);
    const upgraded = profile.ownedWeapons.find((w) => w.id === owned.id)!;
    expect(upgraded.upgradeTier).toBe(2);
    expect(player.ascend).toBeLessThan(before);
  });

  it("won't upgrade an unknown instance", async () => {
    const { storage, playerId } = await setup();
    await expect(svc.upgradeWeapon(storage, playerId, "ghost")).rejects.toThrow(/not in your armory/i);
  });
});

describe("weapon service · fire + deploy guards", () => {
  it("won't fire a weapon that isn't in the armory", async () => {
    const { storage, store, playerId } = await setup();
    await expect(
      svc.fireWeapon(storage, store, { playerId, specId: "msl_ballistic_1", sourceParcelId: "a", targetParcelId: "b" }),
    ).rejects.toThrow(/not in your armory/i);
  });

  it("validates parcels once the weapon is owned", async () => {
    const { storage, store, playerId } = await setup();
    await svc.unlockWeapon(storage, playerId, "msl_ballistic_1");
    await expect(
      svc.fireWeapon(storage, store, { playerId, specId: "msl_ballistic_1", sourceParcelId: "nope", targetParcelId: "nope2" }),
    ).rejects.toThrow(/parcel not found/i);
  });

  it("won't deploy an offensive weapon as a defense", async () => {
    const { storage, store, playerId } = await setup();
    await svc.unlockWeapon(storage, playerId, "msl_ballistic_1");
    await expect(
      svc.deployDefense(storage, store, { playerId, specId: "msl_ballistic_1", parcelId: "x" }),
    ).rejects.toThrow(/not a defensive/i);
  });
});
