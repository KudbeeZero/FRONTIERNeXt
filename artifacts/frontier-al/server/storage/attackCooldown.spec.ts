/**
 * Regression: a player on a post-loss attack cooldown must not be able to
 * launch an attack. Before this, DbStorage/MemStorage.deployAttack never checked
 * attackCooldownUntil for humans (only the AI loop did), so a loser could
 * re-attack instantly. The cooldown gate runs before the commander/resource
 * gates, so an on-cooldown attacker rejects specifically for cooldown.
 */
import { describe, it, expect } from "vitest";
import { MemStorage } from "./mem";

describe("deployAttack enforces the attacker's post-loss cooldown (MemStorage)", () => {
  it("rejects an attack while the attacker is on cooldown", async () => {
    const storage = new MemStorage();
    await storage.initialize();

    const attacker = await storage.getOrCreatePlayerByAddress(
      "COOLDOWNATTACKERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
    // getPlayer returns the live in-memory object — put the attacker on cooldown.
    const live = (await storage.getPlayer(attacker.id))!;
    live.attackCooldownUntil = Date.now() + 60_000;

    const state = await storage.getGameState();
    const target = state.parcels.find(
      (p) => p.ownerId && p.ownerId !== attacker.id && !p.activeBattleId && p.biome !== "water",
    );
    expect(target, "expected an enemy-owned attackable parcel in the seed").toBeTruthy();

    await expect(
      storage.deployAttack({
        attackerId: attacker.id,
        targetParcelId: target!.id,
        troopsCommitted: 1,
        resourcesBurned: { iron: 10, fuel: 10 },
      }),
    ).rejects.toThrow(/cooldown/i);
  });
});
