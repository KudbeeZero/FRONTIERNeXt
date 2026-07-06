/**
 * server/storage/claimwinnings.db.spec.ts
 *
 * Postgres-backed integration test for the prediction-market claim path on
 * DbStorage — the concurrent double-payout guard.
 *
 * `claimWinnings` used to run bare statements with NO transaction: the
 * unclaimed-positions read had no lock, the mark-claimed UPDATE keyed only on
 * `id` (no `claimed=false`, no rowCount), and the credit was a read-then-write.
 * So two concurrent claims both saw the positions unclaimed and both paid out
 * (double payout / lost update) — audit finding, 2026-07-06. The fix wraps it
 * in one transaction with `FOR UPDATE` on the positions + a conditional
 * `UPDATE … WHERE claimed=false` (rowCount) claim BEFORE crediting, and a
 * relative balance update. Mirrors openLootBox / fillTradeOrder.
 *
 * Runs the REAL node-postgres driver against a REAL Postgres so `FOR UPDATE`
 * and rowCount behave authentically. MemStorage's claimWinnings is a stub, so
 * DbStorage is the only real implementation.
 *
 * GATED on DATABASE_URL: skipped when unset. db.ts imported dynamically so the
 * skip path never touches its DATABASE_URL-required module load. Run via
 * `pnpm run test:server:db` (which runs DB specs with --no-file-parallelism so
 * files that share the `players` table don't clobber each other).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("claim winnings storage (DbStorage / Postgres integration)", () => {
  let storage: any;
  let pool: Pool;
  let seq = 0;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Minimal schema: only the columns claimWinnings reads/writes. `ascend` is
    // physically the `frontier` column (db-schema.ts:196).
    await pool.query(`DROP TABLE IF EXISTS market_positions`);
    await pool.query(`DROP TABLE IF EXISTS prediction_markets`);
    await pool.query(`DROP TABLE IF EXISTS treasury_ledger`);
    await pool.query(`DROP TABLE IF EXISTS players`);
    await pool.query(`CREATE TABLE players ("id" varchar(36) PRIMARY KEY NOT NULL, "frontier" integer NOT NULL DEFAULT 0)`);
    await pool.query(`
      CREATE TABLE prediction_markets (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "winning_outcome" varchar(1),
        "token_pool_a" real NOT NULL DEFAULT 0,
        "token_pool_b" real NOT NULL DEFAULT 0
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
    await pool.query(`
      CREATE TABLE treasury_ledger (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "event_type" varchar(50) NOT NULL,
        "amount_micro" bigint NOT NULL,
        "from_player_id" varchar(36),
        "settled" boolean NOT NULL DEFAULT false,
        "settle_tx_id" text,
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

  beforeEach(async () => {
    seq++;
    playerId = `cw-player-${seq}`;
    marketId = `cw-market-${seq}`;
    // Resolved market, outcome 'a' wins. Winning pool 100, losing pool 100.
    await pool.query(`INSERT INTO players (id, frontier) VALUES ($1, 0)`, [playerId]);
    await pool.query(
      `INSERT INTO prediction_markets (id, status, winning_outcome, token_pool_a, token_pool_b)
       VALUES ($1, 'resolved', 'a', 100, 100)`,
      [marketId],
    );
    // The player holds the entire winning pool (wagered 100 on 'a').
    await pool.query(
      `INSERT INTO market_positions (id, market_id, player_id, outcome, amount_wagered, claimed, created_at)
       VALUES ($1, $2, $3, 'a', 100, false, $4)`,
      [`cw-pos-${seq}`, marketId, playerId, Date.now()],
    );
    // Expected payout: totalPool 200, fee 5% = 10, distributable 190,
    // share = 100/100 → floor(190) = 190.
  });

  async function ascend(id: string): Promise<number> {
    const { rows } = await pool.query(`SELECT frontier FROM players WHERE id=$1`, [id]);
    return Number(rows[0].frontier);
  }

  it("serial second claim is rejected; payout credited exactly once", async () => {
    const first = await storage.claimWinnings(marketId, playerId);
    expect(first).toEqual({ payout: 190 });

    const second = await storage.claimWinnings(marketId, playerId);
    expect("error" in second).toBe(true);

    expect(await ascend(playerId)).toBe(190);
  });

  it("blocks on an in-flight claim's row lock and bails without double-crediting (FOR UPDATE)", async () => {
    // Deterministically force the race: a separate connection holds a FOR UPDATE
    // lock on the unclaimed position (an "in-flight" claim), then the real
    // storage claim runs and must BLOCK on that lock. When the in-flight claim
    // commits (position claimed + player credited once), the storage claim
    // unblocks, re-reads 0 unclaimed rows, and must bail WITHOUT crediting again.
    //
    // Fixed code: the storage SELECT ... FOR UPDATE blocks → after commit it sees
    //   the claimed position → returns an error, player stays at 190.
    // Buggy code (no FOR UPDATE): the storage SELECT does NOT block → reads the
    //   still-uncommitted-as-unclaimed position → also pays → player ends at 380.
    const lockClient = await pool.connect();
    try {
      await lockClient.query("BEGIN");
      await lockClient.query(
        `SELECT id FROM market_positions WHERE market_id=$1 AND player_id=$2 AND claimed=false FOR UPDATE`,
        [marketId, playerId],
      );

      // Kick off the real storage claim — it must block on the lock above.
      const claimPromise = storage.claimWinnings(marketId, playerId);
      await new Promise((r) => setTimeout(r, 250)); // let it reach + block on the lock

      // The in-flight claim completes: mark claimed + credit the 190, then commit.
      await lockClient.query(
        `UPDATE market_positions SET claimed=true WHERE market_id=$1 AND player_id=$2`,
        [marketId, playerId],
      );
      await lockClient.query(`UPDATE players SET frontier = frontier + 190 WHERE id=$1`, [playerId]);
      await lockClient.query("COMMIT");

      // The storage claim now unblocks and must bail without a second payout.
      const res = await claimPromise;
      expect("error" in res).toBe(true);
      expect(await ascend(playerId)).toBe(190); // credited exactly once, never 380
    } finally {
      lockClient.release();
    }
  });
});
