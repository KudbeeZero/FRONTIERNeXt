/**
 * server/engine/lootbox/open.ts
 *
 * Pure, deterministic loot-box logic for the Phase-2 rare-mineral economy.
 * No DB / network — reuses the battle engine's seeded PRNG so outcomes are
 * reproducible across MemStorage and DbStorage (mirrors server/engine/battle).
 *
 * Seeding convention (the caller owns the seed):
 *   - Opening a box:  hashSeed(lootBoxId, playerId)
 *       The box id is the entropy, so a given box always yields the SAME
 *       reward — an idempotent re-open (guard replay) recomputes identically.
 *   - Award-on-event: hashSeed(playerId, parcelId, now, "lootbox")
 *       A distinct namespace from any mine/battle seed so rolls don't collide.
 */

import { mulberry32 } from "../battle/random.js";
import {
  LOOT_BOX_DROP_TABLES,
  LOOT_BOX_DROP_CHANCE,
  LOOT_BOX_TRIGGERS,
} from "@shared/schema";
import type { LootBoxTier, LootBoxReward } from "@shared/schema";

/**
 * Deterministic weighted pick from LOOT_BOX_DROP_TABLES[tier].
 *
 * The total weight is derived from the table rather than assumed to be 100, so
 * the math stays correct if the drop tables are ever retuned.
 */
export function resolveLootBoxOpen(tier: LootBoxTier, seed: number): LootBoxReward {
  const table = LOOT_BOX_DROP_TABLES[tier];
  const rng = mulberry32(seed);
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);

  let r = rng() * totalWeight;
  for (const entry of table) {
    r -= entry.weight;
    if (r < 0) return { mineral: entry.mineral, amount: entry.amount };
  }
  // Floating-point boundary fallback — return the last entry.
  const last = table[table.length - 1];
  return { mineral: last.mineral, amount: last.amount };
}

/**
 * Per-trigger award roll. Returns the tier to award (per LOOT_BOX_TRIGGERS),
 * or null if no box dropped (probability per LOOT_BOX_DROP_CHANCE).
 */
export function rollLootBoxAward(
  trigger: keyof typeof LOOT_BOX_TRIGGERS,
  seed: number,
): LootBoxTier | null {
  const rng = mulberry32(seed);
  return rng() < LOOT_BOX_DROP_CHANCE[trigger] ? LOOT_BOX_TRIGGERS[trigger] : null;
}

/** Map a rare-mineral type to its player-vault property name. */
export const MINERAL_TO_VAULT_FIELD = {
  xenorite:    "xenoriteVault",
  void_shard:  "voidShardVault",
  plasma_core: "plasmaCoreVault",
  dark_matter: "darkMatterVault",
} as const;
