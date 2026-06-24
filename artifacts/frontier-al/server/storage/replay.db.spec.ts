/**
 * server/storage/replay.db.spec.ts
 *
 * Postgres-backed integration test for the durable battle-replay path on
 * DbStorage (migration 0011). The Redis path (services/redis.ts) covers the hot
 * 24h cache; THIS proves the persistent fallback that outlives it:
 *   - persistBattleReplay inserts the full record (incl. the jsonb `log`),
 *   - it is idempotent on battleId (re-resolution safe — onConflictDoNothing),
 *   - getPersistedBattleReplay round-trips it byte-for-byte, and
 *   - an unknown id yields null (→ the route's 404).
 *
 * The schema is created by applying the REAL migrations/0011_battle_replays.sql,
 * so the migration itself is exercised. GATED on DATABASE_URL: skipped in the
 * default CI job (mirrors lootbox.db.spec.ts). db.ts is imported dynamically so
 * the skip path never touches its DATABASE_URL-required module load.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import { Pool } from "pg";
import type { BattleReplayRecord } from "../services/redis";

const HAS_DB = !!process.env.DATABASE_URL;

function record(over: Partial<BattleReplayRecord> = {}): BattleReplayRecord {
  return {
    battleId: "replay-test-1",
    attackerName: "NEXUS-7",
    defenderName: "KRONOS",
    attackerPower: 103.5,
    defenderPower: 80,
    randFactor: 3,
    outcome: "attacker_wins",
    plotId: 1234,
    biome: "mountain",
    pillagedIron: 25,
    pillagedFuel: 10,
    pillagedCrystal: 0,
    resolvedAt: 1_700_000_000_000,
    log: [
      { phase: "power_calc", message: "NEXUS-7 committed 50 troops → attack power 103.50" },
      { phase: "resolution", message: "Outcome: attacker_wins" },
    ],
    ...over,
  };
}

describe.skipIf(!HAS_DB)("battle replay persistence (DbStorage / Postgres integration)", () => {
  let storage: any;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`DROP TABLE IF EXISTS battle_replays`);
    const migration = readFileSync(
      new URL("../../migrations/0011_battle_replays.sql", import.meta.url),
      "utf8",
    );
    await pool.query(migration);

    const { DbStorage } = await import("./db.js");
    storage = new DbStorage();
    storage.initPromise = Promise.resolve(); // skip world seed; we only need this table
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("round-trips a persisted replay (incl. the jsonb log)", async () => {
    const rec = record({ battleId: "rt-1" });
    await storage.persistBattleReplay(rec);
    const got = await storage.getPersistedBattleReplay("rt-1");
    expect(got).toEqual(rec);
    expect(got.log).toHaveLength(2);
    expect(got.log[0].phase).toBe("power_calc");
  });

  it("is idempotent on battleId (re-resolution is safe)", async () => {
    const first = record({ battleId: "dup", attackerName: "FIRST" });
    await storage.persistBattleReplay(first);
    await storage.persistBattleReplay(record({ battleId: "dup", attackerName: "SECOND" }));
    const got = await storage.getPersistedBattleReplay("dup");
    expect(got.attackerName).toBe("FIRST"); // onConflictDoNothing kept the original
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM battle_replays WHERE battle_id = 'dup'`);
    expect(rows[0].n).toBe(1);
  });

  it("returns null for an unknown battle id", async () => {
    expect(await storage.getPersistedBattleReplay("nope")).toBeNull();
  });
});
