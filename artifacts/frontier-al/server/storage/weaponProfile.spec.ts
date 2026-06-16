import { describe, it, expect } from "vitest";
import { MemStorage } from "./mem";

describe("MemStorage weapon profile (persisted memory layer)", () => {
  it("returns a default profile, then persists and recomputes on update", async () => {
    const storage = new MemStorage();
    const player = await storage.getOrCreatePlayerByAddress("WEAPONTESTADDRESS000000000000000000000000000000000000000");

    // default profile before any build
    const initial = await storage.getWeaponProfile(player.id);
    expect(initial.archetypeId).toBe("siege_baron");
    expect(initial.ownedWeapons).toEqual([]);

    // build into an interception-heavy spread
    const updated = await storage.updateWeaponProfile(player.id, {
      attributes: { firepower: 0, range: 0, guidance: 12, interception: 18, logistics: 0 },
      stats: { shotsFired: 0, kills: 0, intercepts: 40, precisionHits: 0, longRangeHits: 0 },
    });
    expect(updated.archetypeId).toBe("aegis_interceptor");
    expect(updated.badges.aegis).not.toBe("none");

    // persisted across reads
    const reread = await storage.getWeaponProfile(player.id);
    expect(reread.attributes.interception).toBe(18);
    expect(reread.archetypeId).toBe("aegis_interceptor");
  });

  it("throws for an unknown player", async () => {
    const storage = new MemStorage();
    await expect(storage.getWeaponProfile("nope")).rejects.toThrow();
  });
});
