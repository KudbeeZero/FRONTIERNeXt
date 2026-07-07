/**
 * server/storage/placebet.db.spec.ts
 *
 * Postgres-backed integration test for the prediction-market bet path on
 * DbStorage — the concurrent lost-update guard.
 *
 * `placeBet` used to run bare statements with NO transaction: the player
 * balance debit was a read-then-write (`ascend: playerRow.ascend - amount`)
 * and so was the market pool credit. Two concurrent bets (the same player
 * racing themselves, or two players betting the same market/outcome at once)
 * could both read the same starting value and one update's result got
 * clobbered by the other (a lost update) — a player could place two bets
 * while only ever being charged for one (a free extra stake), and a market's
 * pool total could drift out of sync with the sum of its positions (audit
 * finding, 2026-07-07). The fix wraps it in one transaction with `FOR UPDATE`
 * on both the market and player rows BEFORE any mutation, then conditional
 * relative updates (belt to the lock) for the debit and the pool credit.
 * Mirrors claimWinnings / fillTradeOrder / grantWelcomeBonus.
 *
 * Runs the REAL node-postgres driver against a REAL Postgres so `FOR UPDATE`
 * and rowCount/RETURNING behave authentically. MemStorage's placeBet is a
 * stub ("Not supported in memory storage"), so DbStorage is the only real
 * implementation and can only be exercised here.
 *
 * GATED on DATABASE_URL: skipped when unset. db.ts imported dynamically so the
 * skip path never touches its DATABASE_URL-required module load. Run via
 * `pnpm run test:server:db` (which runs DB specs with --no-file-parallelism so
 * files that share the `players` table don't clobber each other).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("place bet storage (DbStorage / Postgres integration)", () => {
  let storage: any;
  let pool: Pool;
  let seq = 0;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Minimal schema: only the columns placeBet reads/writes. `ascend` is
    // physically the `frontier` column (db-schema.ts:196).
    await pool.query(`DROP TABLE IF EXISTS market_positions`);
    await pool.query(`DROP TABLE IF EXISTS prediction_markets`);
    await pool.query(`DROP TABLE IF EXISTS players`);
    await pool.query(`
      CREATE TABLE players (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "frontier" integer NOT NULL DEFAULT 0,
        "is_ai" boolean NOT NULL DEFAULT false
      )`);
    // Full column set: the final pool-update `.returning()` reads the whole
    // row back into `rowToMarket`, same as the pre-existing createMarket path.
    await pool.query(`
      CREATE TABLE prediction_markets (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "title" varchar(200) NOT NULL DEFAULT 't',
        "description" text NOT NULL DEFAULT '',
        "category" varchar(30) NOT NULL DEFAULT 'battle',
        "resolution_criteria" text NOT NULL DEFAULT '',
        "outcome_a_label" varchar(100) NOT NULL DEFAULT 'Yes',
        "outcome_b_label" varchar(100) NOT NULL DEFAULT 'No',
        "token_pool_a" real NOT NULL DEFAULT 0,
        "token_pool_b" real NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "resolves_at" bigint NOT NULL,
        "resolved_at" bigint,
        "winning_outcome" varchar(1),
        "created_by" varchar(36) NOT NULL DEFAULT 'admin',
        "related_event_id" varchar(36),
        "created_at" bigint NOT NULL DEFAULT 0,
        "resolution_source" jsonb,
        "resolution_cutoff_ts" bigint,
        "resolved_inputs" jsonb,
        "resolution_hash" varchar(64)
      )`);
    await pool.query(`
      CREATE TABLE market_positions (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "market_id" varchar(36) NOT NULL,
        "player_id" varchar(36) NOT NULL,
        "outcome" varchar(1) NOT NULL,
        "amount_wagered" real NOT NULL,
        "claimed" boolean NOT NULL DEFAULT false,
        "created_at" bigint NOT NULL
      )`);

    const { DbStorage } = await import("./db.js");
    storage = new DbStorage();
    storage.initPromise = Promise.resolve(); // skip world seed
  });

  afterAll(async () => {
    await pool?.end();
  });

  let playerId: string, marketId: string;
  const FAR_FUTURE = Date.now() + 1000 * 60 * 60 * 24; // resolves in 24h

  beforeEach(async () => {
    seq++;
    playerId = `pb-player-${seq}`;
    marketId = `pb-market-${seq}`;
    await pool.query(`INSERT INTO players (id, frontier) VALUES ($1, 100)`, [playerId]);
    await pool.query(
      `INSERT INTO prediction_markets (id, status, resolves_at, token_pool_a, token_pool_b)
       VALUES ($1, 'open', $2, 0, 0)`,
      [marketId, FAR_FUTURE],
    );
  });

  async function playerAscend(id: string): Promise<number> {
    const { rows } = await pool.query(`SELECT frontier FROM players WHERE id=$1`, [id]);
    return Number(rows[0].frontier);
  }

  async function marketPools(id: string): Promise<{ a: number; b: number }> {
    const { rows } = await pool.query(`SELECT token_pool_a, token_pool_b FROM prediction_markets WHERE id=$1`, [id]);
    return { a: Number(rows[0].token_pool_a), b: Number(rows[0].token_pool_b) };
  }

  it("serial bets debit the player and credit the pool exactly once each", async () => {
    const first = await storage.placeBet(marketId, playerId, "a", 40);
    expect("position" in first).toBe(true);

    expect(await playerAscend(playerId)).toBe(60);
    expect(await marketPools(marketId)).toEqual({ a: 40, b: 0 });

    // A second bet the player can't afford is rejected without touching state.
    const second = await storage.placeBet(marketId, playerId, "a", 1000);
    expect("error" in second).toBe(true);
    expect(await playerAscend(playerId)).toBe(60);
    expect(await marketPools(marketId)).toEqual({ a: 40, b: 0 });
  });

  it("blocks on an in-flight bet's row lock and bails on insufficient balance without losing the update (FOR UPDATE)", async () => {
    // Deterministically force the race: a separate connection holds a
    // FOR UPDATE lock on the player row (an "in-flight" bet), then the real
    // storage bet runs and must BLOCK on that lock. When the in-flight bet
    // commits (debiting the player down to a balance too low for the second
    // bet), the storage bet unblocks, re-reads the now-lower balance, and
    // must bail on insufficient funds WITHOUT losing the first debit (i.e.
    // without the classic read-then-write race letting both bets through on
    // one deduction).
    //
    // Fixed code: the storage SELECT ... FOR UPDATE on the player blocks →
    //   after commit it sees ascend=10 (100-90) → 10 < 90 → bails, balance
    //   stays at 10, no second position created.
    // Buggy code (no FOR UPDATE, read-then-write): the storage SELECT does
    //   NOT block → reads the still-uncommitted ascend=100 → both bets pass
    //   the balance check → the debit becomes a lost update (both bets ended
    //   up costing only 90 total instead of 180) and a position is created
    //   for a bet the player couldn't actually afford.
    const lockClient = await pool.connect();
    try {
      await lockClient.query("BEGIN");
      await lockClient.query(`SELECT id FROM players WHERE id=$1 FOR UPDATE`, [playerId]);

      // Kick off the real storage bet for 90 — it must block on the lock above.
      const betPromise = storage.placeBet(marketId, playerId, "a", 90);
      await new Promise((r) => setTimeout(r, 250)); // let it reach + block on the lock

      // The in-flight bet completes: debit 90 (100 -> 10), then commit.
      await lockClient.query(`UPDATE players SET frontier = frontier - 90 WHERE id=$1`, [playerId]);
      await lockClient.query("COMMIT");

      // The storage bet now unblocks, re-reads ascend=10, and must bail —
      // 10 < 90, so this bet can't be afforded.
      const res = await betPromise;
      expect("error" in res).toBe(true);
      expect(await playerAscend(playerId)).toBe(10); // debited exactly once, never twice
      expect(await marketPools(marketId)).toEqual({ a: 0, b: 0 }); // no pool credit for the rejected bet
    } finally {
      lockClient.release();
    }
  });

  it("is double-bet safe under CONCURRENCY: two players betting the same market/outcome both land, pool reflects both", async () => {
    const playerBId = `pb-playerB-${seq}`;
    await pool.query(`INSERT INTO players (id, frontier) VALUES ($1, 100)`, [playerBId]);

    const [a, b] = await Promise.all([
      storage.placeBet(marketId, playerId, "a", 30),
      storage.placeBet(marketId, playerBId, "a", 50),
    ]);

    expect("position" in a).toBe(true);
    expect("position" in b).toBe(true);

    // Both debits landed (not a lost update): pool = 30 + 50 = 80, not 30 or 50.
    expect(await marketPools(marketId)).toEqual({ a: 80, b: 0 });
    expect(await playerAscend(playerId)).toBe(70);
    expect(await playerAscend(playerBId)).toBe(50);
  });
});
