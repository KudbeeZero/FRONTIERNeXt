import { describe, it, expect } from "vitest";
import { resolveLootBoxOpen, rollLootBoxAward } from "./open.js";
import {
  LOOT_BOX_DROP_TABLES,
  LOOT_BOX_DROP_CHANCE,
  LOOT_BOX_TRIGGERS,
  type LootBoxTier,
} from "@shared/schema";
import { hashSeed } from "../battle/random.js";

const TIERS: LootBoxTier[] = ["common", "rare", "epic", "legendary"];

describe("resolveLootBoxOpen", () => {
  it("is deterministic for a given (tier, seed)", () => {
    for (const tier of TIERS) {
      const seed = hashSeed("box-abc", "player-xyz");
      const a = resolveLootBoxOpen(tier, seed);
      const b = resolveLootBoxOpen(tier, seed);
      expect(a).toEqual(b);
    }
  });

  it("always returns a reward present in the tier's drop table", () => {
    for (const tier of TIERS) {
      const table = LOOT_BOX_DROP_TABLES[tier];
      for (let i = 0; i < 500; i++) {
        const reward = resolveLootBoxOpen(tier, hashSeed(`box-${i}`, "p"));
        const match = table.find(
          (e) => e.mineral === reward.mineral && e.amount === reward.amount,
        );
        expect(match, `tier=${tier} reward=${JSON.stringify(reward)}`).toBeTruthy();
      }
    }
  });

  it("produces a distribution roughly matching the configured weights", () => {
    const N = 20_000;
    for (const tier of TIERS) {
      const table = LOOT_BOX_DROP_TABLES[tier];
      const total = table.reduce((s, e) => s + e.weight, 0);
      const counts: Record<string, number> = {};
      for (let i = 0; i < N; i++) {
        const reward = resolveLootBoxOpen(tier, hashSeed(`d-${tier}-${i}`));
        counts[reward.mineral] = (counts[reward.mineral] ?? 0) + 1;
      }
      for (const entry of table) {
        const expected = entry.weight / total;
        const observed = (counts[entry.mineral] ?? 0) / N;
        expect(
          Math.abs(observed - expected),
          `tier=${tier} mineral=${entry.mineral} expected≈${expected} observed=${observed}`,
        ).toBeLessThan(0.04);
      }
    }
  });

  it("differing seeds can yield differing rewards", () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const r = resolveLootBoxOpen("rare", hashSeed(`seed-${i}`));
      results.add(`${r.mineral}:${r.amount}`);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("rollLootBoxAward", () => {
  it("returns the configured tier for each trigger when it fires, else null", () => {
    for (const trigger of Object.keys(LOOT_BOX_TRIGGERS) as (keyof typeof LOOT_BOX_TRIGGERS)[]) {
      let fired: string | null = null;
      for (let i = 0; i < 5000 && fired === null; i++) {
        fired = rollLootBoxAward(trigger, hashSeed(`${trigger}-${i}`));
      }
      expect(fired).toBe(LOOT_BOX_TRIGGERS[trigger]);
    }
  });

  it("awards at approximately the configured rate for mine_action", () => {
    const N = 50_000;
    let hits = 0;
    for (let i = 0; i < N; i++) {
      if (rollLootBoxAward("mine_action", hashSeed("p", `parcel-${i}`, i, "lootbox"))) hits++;
    }
    const rate = hits / N;
    expect(Math.abs(rate - LOOT_BOX_DROP_CHANCE.mine_action)).toBeLessThan(0.005);
  });

  it("is deterministic for a given (trigger, seed)", () => {
    const seed = hashSeed("p", "parcel-1", 123, "lootbox");
    expect(rollLootBoxAward("mine_action", seed)).toBe(
      rollLootBoxAward("mine_action", seed),
    );
  });
});
