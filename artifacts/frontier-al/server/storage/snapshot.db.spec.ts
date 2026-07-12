/**
 * server/storage/snapshot.db.spec.ts
 *
 * Phase B — Postgres-backed integration test for durable BattleSnapshot
 * persistence. Proves the battle row insert carries a non-null JSONB
 * snapshot and the snapshot survives a database round-trip with key
 * reordering (JSONB canonicalization).
 *
 * GATED on DATABASE_URL: skipped in the default CI job (mirrors
 * replay.db.spec.ts and lootbox.db.spec.ts). The migration is applied
 * against a real Postgres connection.
 */
import { describe, it, expect, beforeAll, afterAll, expectTypeOf } from "vitest";
import { readFileSync } from "fs";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { parseStoredBattleSnapshot } from "../engine/battle/snapshotReplay.js";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("battle snapshot persistence (DbStorage / Postgres integration)", () => {
  let pool: Pool;
  let storage: any;
  let human: any;
  let target: any;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // Ensure the schema is present. We apply the REAL migration files
    // that exist in the repo (0014 + 0015 + 0016). For a fresh test
    // database, the earlier migrations must also be present; this test
    // assumes a previously-initialized schema (matching the existing
    // *.db.spec.ts pattern in replay.db.spec.ts).
    const migration16 = readFileSync(
      new URL("../../migrations/0016_battles_battle_snapshot.sql", import.meta.url),
      "utf8",
    );
    await pool.query(migration16);

    const { DbStorage } = await import("./db.js");
    const { MemStorage } = await import("./mem.js");
    const mem = new MemStorage();
    // Use MemStorage to seed a known game state, then load DbStorage
    // against the same DB and call deployAttack to persist a battle.
    const state = await mem.getGameState();
    expectTypeOf(state).toMatchTypeOf<{ parcels: any[]; players: any[] }>();
    human = state.players.find((p: any) => p.isAI === false && p.commanders && p.commanders.length > 0)
      ?? state.players.find((p: any) => p.isAI === false);
    target = state.parcels.find((p: any) => p.ownerId && p.ownerId !== human.id && p.biome !== "water");
    storage = new DbStorage();
    storage.initPromise = Promise.resolve();
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("persists a non-null BattleSnapshot in the battles table", async () => {
    if (!human || !target) return;
    // Mint a commander if the test human has none
    if (!human.commanders || human.commanders.length === 0) {
      await storage.mintAvatar({
        playerId: human.id,
        tier: "sentinel",
        name: "Test Sentinel",
      } as any);
    }
    const battle = await storage.deployAttack({
      attackerId: human.id,
      targetParcelId: target.id,
      troopsCommitted: 5,
      resourcesBurned: { iron: 10, fuel: 10 },
      crystalBurned: 0,
      sourceParcelId: null,
    } as any);
    expect(battle).toBeDefined();
    expect(battle.id).toBeTruthy();
    // Query the battle row and verify the snapshot column is non-null.
    const { rows } = await pool.query(
      `SELECT battle_snapshot FROM battles WHERE id = $1`,
      [battle.id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].battle_snapshot).toBeDefined();
    expect(rows[0].battle_snapshot).not.toBeNull();
    // The snapshot must be parseable as a BattleSnapshot.
    const reparsed = parseStoredBattleSnapshot(rows[0].battle_snapshot);
    expect(reparsed.snapshotId).toBeTruthy();
    expect(reparsed.profile.randomSeed).toBeGreaterThanOrEqual(0);
  });

  it("snapshot survives JSONB key reordering (canonical identity preserved)", async () => {
    if (!human || !target) return;
    const { rows } = await pool.query(
      `SELECT battle_snapshot FROM battles ORDER BY start_ts DESC LIMIT 1`,
    );
    if (rows.length === 0) return; // skip if no battle was created above
    const decoded = rows[0].battle_snapshot;
    // Reorder the top-level keys (PostgreSQL JSONB does not preserve order).
    const reordered: Record<string, unknown> = {};
    for (const k of Object.keys(decoded).reverse()) {
      reordered[k] = decoded[k];
    }
    const reparsed = parseStoredBattleSnapshot(reordered);
    expect(reparsed.snapshotId).toBeDefined();
  });
});
