/**
 * server/storage/lootbox.db.spec.ts
 *
 * Postgres-backed integration test for the loot-box storage path on DbStorage.
 *
 * The MemStorage suite (lootbox.storage.spec.ts) verifies the same surface in
 * memory, but the DbStorage path has SQL-only guards that a JS map cannot
 * exercise — flagged in the #60 audit as untested:
 *   - the `FOR UPDATE` row lock + concurrent double-open race,
 *   - the conditional `UPDATE ... WHERE opened_at IS NULL` double-open guard
 *     (relies on the driver's `rowCount`), and
 *   - the `LEAST(col + n, CAP)` rare-mineral vault clamp.
 *
 * This runs the REAL `node-postgres` driver against a REAL Postgres (so
 * `rowCount`, `FOR UPDATE` and `LEAST(...)` behave authentically — an in-memory
 * shim such as PGlite does NOT populate `rowCount`, which would break the
 * double-open guard under test). The schema is created by applying the actual
 * `migrations/0010_loot_box_inventory.sql` over a minimal `players` stub, so the
 * migration itself is exercised too.
 *
 * GATED on DATABASE_URL: when unset (the default CI job) the whole block is
 * skipped — see the "Integration tests (Postgres)" CI step / docs/COVERAGE_GATE.md.
 * `db.ts` is imported dynamically so the skip path never touches its
 * DATABASE_URL-required module load.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { Pool } from "pg";
import { resolveLootBoxOpen, MINERAL_TO_VAULT_FIELD } from "../engine/lootbox/open.js";
import { hashSeed } from "../engine/battle/random.js";
import { LOOT_BOX_INVENTORY_CAP, RARE_MINERAL_VAULT_CAP } from "@shared/schema";

const HAS_DB = !!process.env.DATABASE_URL;

// vault property name (camelCase, as returned in OpenLootBoxResult.vaults) →
// physical column. Mirrors the map in db.ts openLootBox().
const FIELD_TO_COLUMN = {
  xenoriteVault: "xenorite_vault",
  voidShardVault: "void_shard_vault",
  plasmaCoreVault: "plasma_core_vault",
  darkMatterVault: "dark_matter_vault",
} as const;
const ALL_VAULT_COLUMNS = Object.values(FIELD_TO_COLUMN);

describe.skipIf(!HAS_DB)("loot box storage (DbStorage / Postgres integration)", () => {
  let storage: any;
  let pool: Pool;
  let playerSeq = 0;
  let playerId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Fresh schema: a minimal players stub + the real migration 0010 (which
    // creates loot_box_inventory and ALTERs in the four *_vault columns).
    await pool.query(`DROP TABLE IF EXISTS loot_box_inventory`);
    await pool.query(`DROP TABLE IF EXISTS players`);
    await pool.query(`CREATE TABLE players ("id" varchar(36) PRIMARY KEY NOT NULL)`);
    const migration = readFileSync(
      new URL("../../migrations/0010_loot_box_inventory.sql", import.meta.url),
      "utf8",
    );
    await pool.query(migration);

    // Import DbStorage only now that DATABASE_URL is known-set, so the skip
    // path never evaluates db.ts (which throws without DATABASE_URL).
    const { DbStorage } = await import("./db.js");
    storage = new DbStorage();
    // Skip seedDatabase() — we only need the loot-box tables, not the world.
    storage.initPromise = Promise.resolve();
  });

  afterAll(async () => {
    await pool?.end();
  });

  // Fresh player row per test so award/open/vault state never leaks.
  beforeEach(async () => {
    playerSeq++;
    playerId = `db-loot-player-${playerSeq}`;
    await pool.query(`INSERT INTO players ("id") VALUES ($1)`, [playerId]);
  });

  async function unopenedCount(id = playerId): Promise<number> {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS c FROM loot_box_inventory WHERE player_id=$1 AND opened_at IS NULL`,
      [id],
    );
    return rows[0].c;
  }

  async function vaultTotals(id = playerId): Promise<number[]> {
    const { rows } = await pool.query(
      `SELECT ${ALL_VAULT_COLUMNS.join(", ")} FROM players WHERE id=$1`,
      [id],
    );
    return ALL_VAULT_COLUMNS.map((c) => Number(rows[0][c]));
  }

  it("awards a box and persists it as unopened", async () => {
    const rec = await storage.awardLootBox(playerId, "common", Date.now());
    expect(rec).not.toBeNull();
    const { rows } = await pool.query(
      `SELECT tier, opened_at FROM loot_box_inventory WHERE id=$1`,
      [rec.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tier).toBe("common");
    expect(rows[0].opened_at).toBeNull();
  });

  it("enforces the unopened inventory cap (drops the overflow)", async () => {
    for (let i = 0; i < LOOT_BOX_INVENTORY_CAP; i++) {
      expect(await storage.awardLootBox(playerId, "common", Date.now())).not.toBeNull();
    }
    expect(await unopenedCount()).toBe(LOOT_BOX_INVENTORY_CAP);
    // At cap → next award is silently dropped (null).
    expect(await storage.awardLootBox(playerId, "common", Date.now())).toBeNull();

    // Opening one frees a slot — opened boxes don't count toward the cap.
    const { rows } = await pool.query(
      `SELECT id FROM loot_box_inventory WHERE player_id=$1 LIMIT 1`,
      [playerId],
    );
    const open = await storage.openLootBox(playerId, rows[0].id);
    expect(open.ok).toBe(true);
    expect(await storage.awardLootBox(playerId, "common", Date.now())).not.toBeNull();
  });

  it("opens a box, credits the vault by the deterministic reward, marks it opened", async () => {
    const rec = await storage.awardLootBox(playerId, "rare", Date.now());
    const expected = resolveLootBoxOpen("rare", hashSeed(rec.id, playerId));

    const res = await storage.openLootBox(playerId, rec.id);
    expect(res.ok).toBe(true);
    expect(res.reward).toEqual(expected);

    const field = MINERAL_TO_VAULT_FIELD[expected.mineral];
    expect(res.vaults[field]).toBe(expected.amount);

    // Persisted: the credited column holds the reward, the box is marked opened.
    const column = FIELD_TO_COLUMN[field];
    const { rows: pRows } = await pool.query(`SELECT ${column} AS v FROM players WHERE id=$1`, [playerId]);
    expect(Number(pRows[0].v)).toBe(expected.amount);
    const { rows: bRows } = await pool.query(`SELECT opened_at FROM loot_box_inventory WHERE id=$1`, [rec.id]);
    expect(bRows[0].opened_at).not.toBeNull();
  });

  it("is double-open safe (serial): second open is already_opened, vault credited once", async () => {
    const rec = await storage.awardLootBox(playerId, "epic", Date.now());
    const first = await storage.openLootBox(playerId, rec.id);
    expect(first.ok).toBe(true);

    const second = await storage.openLootBox(playerId, rec.id);
    expect(second).toEqual({ ok: false, reason: "already_opened" });

    // Sum across all four vaults equals exactly one reward amount.
    const total = (await vaultTotals()).reduce((a, b) => a + b, 0);
    expect(total).toBe(first.reward.amount);
  });

  it("is double-open safe under CONCURRENCY (FOR UPDATE + rowCount guard): exactly one win", async () => {
    const rec = await storage.awardLootBox(playerId, "epic", Date.now());

    // Two opens race on separate pooled connections. The FOR UPDATE row lock
    // serializes them; whichever commits second hits opened_at != null (or the
    // conditional UPDATE matches 0 rows via rowCount) and loses.
    const [a, b] = await Promise.all([
      storage.openLootBox(playerId, rec.id),
      storage.openLootBox(playerId, rec.id),
    ]);

    const wins = [a, b].filter((r) => r.ok);
    const losses = [a, b].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]).toEqual({ ok: false, reason: "already_opened" });

    // Credited exactly once despite the race.
    const total = (await vaultTotals()).reduce((acc, v) => acc + v, 0);
    expect(total).toBe(wins[0].reward.amount);
  });

  it("clamps the vault at RARE_MINERAL_VAULT_CAP via LEAST(...)", async () => {
    // Pre-fill every vault to one below the cap so any open clamps.
    await pool.query(
      `UPDATE players SET ${ALL_VAULT_COLUMNS.map((c) => `${c}=${RARE_MINERAL_VAULT_CAP - 1}`).join(", ")} WHERE id=$1`,
      [playerId],
    );
    // legendary always grants >= 1, so col + amount exceeds the cap and clamps.
    const rec = await storage.awardLootBox(playerId, "legendary", Date.now());
    const res = await storage.openLootBox(playerId, rec.id);
    expect(res.ok).toBe(true);

    const maxVault = Math.max(...Object.values(res.vaults as Record<string, number>));
    expect(maxVault).toBe(RARE_MINERAL_VAULT_CAP);
    // And persisted clamped (never exceeds the cap).
    expect(Math.max(...(await vaultTotals()))).toBe(RARE_MINERAL_VAULT_CAP);
  });

  it("returns not_found for an unknown id and for another player's box (ownership)", async () => {
    expect(await storage.openLootBox(playerId, "does-not-exist")).toEqual({
      ok: false,
      reason: "not_found",
    });

    const otherId = `db-loot-other-${playerSeq}`;
    await pool.query(`INSERT INTO players ("id") VALUES ($1)`, [otherId]);
    const rec = await storage.awardLootBox(otherId, "common", Date.now());
    // Opening another player's box under the wrong id must not find it...
    expect(await storage.openLootBox(playerId, rec.id)).toEqual({ ok: false, reason: "not_found" });
    // ...and the box stays sealed.
    const { rows } = await pool.query(`SELECT opened_at FROM loot_box_inventory WHERE id=$1`, [rec.id]);
    expect(rows[0].opened_at).toBeNull();
  });
});
