import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { MemStorage } from "./mem.js";
import { resolveLootBoxOpen } from "../engine/lootbox/open.js";
import { hashSeed } from "../engine/battle/random.js";
import { LOOT_BOX_INVENTORY_CAP, RARE_MINERAL_VAULT_CAP, type Player } from "@shared/schema";

describe("loot box storage (MemStorage)", () => {
  const storage = new MemStorage();
  let player: Player;

  beforeAll(async () => {
    await storage.initialize();
  });

  // Fresh player per test so award/open state doesn't leak between cases.
  let addrCounter = 0;
  beforeEach(async () => {
    addrCounter++;
    player = await storage.getOrCreatePlayerByAddress(
      `LOOTBOXWALLET${String(addrCounter).padStart(40, "A")}`,
    );
  });

  it("awards a box and surfaces it on the hydrated player", async () => {
    const rec = await storage.awardLootBox(player.id, "common", Date.now());
    expect(rec).not.toBeNull();
    const fresh = await storage.getPlayer(player.id);
    expect(fresh?.lootBoxes?.some((b) => b.id === rec!.id && b.openedAt == null)).toBe(true);
  });

  it("enforces the unopened inventory cap (drops the overflow)", async () => {
    for (let i = 0; i < LOOT_BOX_INVENTORY_CAP; i++) {
      expect(await storage.awardLootBox(player.id, "common", Date.now())).not.toBeNull();
    }
    // Cap reached → next award is silently dropped.
    expect(await storage.awardLootBox(player.id, "common", Date.now())).toBeNull();

    // Opening one frees a slot (opened boxes don't count toward the cap).
    const boxes = (await storage.getPlayer(player.id))!.lootBoxes!;
    await storage.openLootBox(player.id, boxes[0].id);
    expect(await storage.awardLootBox(player.id, "common", Date.now())).not.toBeNull();
  });

  it("opens a box, credits the vault by the deterministic reward, marks it opened", async () => {
    const rec = (await storage.awardLootBox(player.id, "rare", Date.now()))!;
    const expected = resolveLootBoxOpen("rare", hashSeed(rec.id, player.id));

    const res = await storage.openLootBox(player.id, rec.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.reward).toEqual(expected);

    const field = `${expected.mineral === "void_shard" ? "voidShard" : expected.mineral === "plasma_core" ? "plasmaCore" : expected.mineral === "dark_matter" ? "darkMatter" : "xenorite"}Vault` as const;
    expect((res.vaults as any)[field]).toBe(expected.amount);

    const fresh = await storage.getPlayer(player.id);
    expect(fresh?.lootBoxes?.find((b) => b.id === rec.id)?.openedAt).toBeTypeOf("number");
  });

  it("is double-open safe: second open is already_opened, vault credited once", async () => {
    const rec = (await storage.awardLootBox(player.id, "epic", Date.now()))!;
    const first = await storage.openLootBox(player.id, rec.id);
    expect(first.ok).toBe(true);
    const second = await storage.openLootBox(player.id, rec.id);
    expect(second).toEqual({ ok: false, reason: "already_opened" });

    // Sum of all four vaults equals the single reward amount.
    const p = (await storage.getPlayer(player.id))!;
    const total = (p.xenoriteVault ?? 0) + (p.voidShardVault ?? 0) + (p.plasmaCoreVault ?? 0) + (p.darkMatterVault ?? 0);
    if (first.ok) expect(total).toBe(first.reward.amount);
  });

  it("returns not_found for an unknown id and for another player's box", async () => {
    expect(await storage.openLootBox(player.id, "does-not-exist")).toEqual({ ok: false, reason: "not_found" });

    const other = await storage.getOrCreatePlayerByAddress("OTHEROWNERWALLETBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
    const rec = (await storage.awardLootBox(other.id, "common", Date.now()))!;
    // Opening other's box under the wrong playerId must not find it.
    expect(await storage.openLootBox(player.id, rec.id)).toEqual({ ok: false, reason: "not_found" });
  });

  it("clamps the vault at RARE_MINERAL_VAULT_CAP", async () => {
    // legendary always grants ≥5; pre-fill every vault near the cap so the open clamps.
    player.xenoriteVault = RARE_MINERAL_VAULT_CAP - 1;
    player.voidShardVault = RARE_MINERAL_VAULT_CAP - 1;
    player.plasmaCoreVault = RARE_MINERAL_VAULT_CAP - 1;
    player.darkMatterVault = RARE_MINERAL_VAULT_CAP - 1;

    const rec = (await storage.awardLootBox(player.id, "legendary", Date.now()))!;
    const res = await storage.openLootBox(player.id, rec.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const all = Object.values(res.vaults);
    expect(Math.max(...all)).toBe(RARE_MINERAL_VAULT_CAP);
  });
});
