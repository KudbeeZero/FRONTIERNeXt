/**
 * server/storage/welcomebonus.db.spec.ts
 *
 * Postgres-backed integration test for the welcome-bonus grant path on
 * DbStorage — the concurrent double-enqueue guard.
 *
 * `grantWelcomeBonus` used to SELECT the player without a row lock and mark
 * `welcomeBonusReceived` with an unconditional UPDATE (no rowCount check), so
 * two concurrent logins/connect-wallet calls both saw `welcomeBonusReceived:
 * false`, both credited the in-game balance, and — worse — the route layer
 * (`maybeGrantWelcomeBonus` / `/api/actions/connect-wallet` in routes.ts) both
 * enqueued the on-chain 500-ASCEND transfer, a real double-spend of funds
 * (audit finding, 2026-07-07). The fix mirrors claimWinnings/fillTradeOrder:
 * `FOR UPDATE` on the player SELECT + a conditional
 * `UPDATE … WHERE welcomeBonusReceived=false` (rowCount via RETURNING) BEFORE
 * crediting, and the storage method now returns a boolean the route layer
 * gates its enqueue on.
 *
 * Runs the REAL node-postgres driver against a REAL Postgres so `FOR UPDATE`
 * and rowCount/RETURNING behave authentically. MemStorage's grantWelcomeBonus
 * has no `await` between its check and its mutation, so it is already
 * single-process-atomic and isn't exercised here — DbStorage is the only
 * implementation where the race is real.
 *
 * GATED on DATABASE_URL: skipped when unset. db.ts imported dynamically so the
 * skip path never touches its DATABASE_URL-required module load. Run via
 * `pnpm run test:server:db` (which runs DB specs with --no-file-parallelism so
 * files that share the `players` table don't clobber each other).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";

const HAS_DB = !!process.env.DATABASE_URL;
const WELCOME_BONUS_ASCEND = 500;
const MICRO = 1_000_000;

describe.skipIf(!HAS_DB)("welcome bonus storage (DbStorage / Postgres integration)", () => {
  let storage: any;
  let pool: Pool;
  let seq = 0;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Minimal schema: only the columns grantWelcomeBonus reads/writes, plus
    // game_events/game_meta which it also writes to inside the same txn.
    await pool.query(`DROP TABLE IF EXISTS game_events`);
    await pool.query(`DROP TABLE IF EXISTS game_meta`);
    await pool.query(`DROP TABLE IF EXISTS players`);
    await pool.query(`
      CREATE TABLE players (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "name" varchar(100) NOT NULL DEFAULT 'p',
        "welcome_bonus_received" boolean NOT NULL DEFAULT false,
        "frntr_balance_micro" bigint NOT NULL DEFAULT 0,
        "total_frontier_earned" real NOT NULL DEFAULT 0
      )`);
    await pool.query(`
      CREATE TABLE game_events (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "type" varchar(30) NOT NULL,
        "player_id" varchar(36) NOT NULL,
        "parcel_id" varchar(36),
        "battle_id" varchar(36),
        "description" text NOT NULL,
        "ts" bigint NOT NULL,
        "narrative_text" text
      )`);
    await pool.query(`
      CREATE TABLE game_meta (
        "id" integer PRIMARY KEY DEFAULT 1,
        "initialized" boolean NOT NULL DEFAULT false,
        "current_turn" integer NOT NULL DEFAULT 1,
        "last_update_ts" bigint NOT NULL DEFAULT 0
      )`);
    await pool.query(`INSERT INTO game_meta (id) VALUES (1)`);

    const { DbStorage } = await import("./db.js");
    storage = new DbStorage();
    storage.initPromise = Promise.resolve(); // skip world seed
  });

  afterAll(async () => {
    await pool?.end();
  });

  let playerId: string;

  beforeEach(async () => {
    seq++;
    playerId = `wb-player-${seq}`;
    await pool.query(`INSERT INTO players (id, name) VALUES ($1, 'p')`, [playerId]);
  });

  async function playerRow(id: string): Promise<{ balanceMicro: number; earned: number; received: boolean }> {
    const { rows } = await pool.query(
      `SELECT frntr_balance_micro, total_frontier_earned, welcome_bonus_received FROM players WHERE id=$1`,
      [id],
    );
    return {
      balanceMicro: Number(rows[0].frntr_balance_micro),
      earned: Number(rows[0].total_frontier_earned),
      received: rows[0].welcome_bonus_received,
    };
  }

  it("serial second grant is a no-op; balance credited exactly once", async () => {
    const first = await storage.grantWelcomeBonus(playerId);
    expect(first).toBe(true);

    const second = await storage.grantWelcomeBonus(playerId);
    expect(second).toBe(false);

    const row = await playerRow(playerId);
    expect(row.balanceMicro).toBe(WELCOME_BONUS_ASCEND * MICRO);
    expect(row.earned).toBe(WELCOME_BONUS_ASCEND);
    expect(row.received).toBe(true);
  });

  it("blocks on an in-flight grant's row lock and bails without double-crediting (FOR UPDATE)", async () => {
    // Deterministically force the race: a separate connection holds a FOR
    // UPDATE lock on the player row (an "in-flight" grant), then the real
    // storage grant runs and must BLOCK on that lock. When the in-flight
    // grant commits (welcome_bonus_received flipped + balance credited once),
    // the storage grant unblocks, re-reads welcomeBonusReceived=true, and must
    // bail WITHOUT crediting again — the caller (routes.ts) uses this exact
    // return value to decide whether to enqueue the on-chain transfer, so a
    // false here means no second enqueue.
    //
    // Fixed code: the storage SELECT ... FOR UPDATE blocks → after commit it
    //   sees welcomeBonusReceived=true → returns false, balance stays at 500.
    // Buggy code (no FOR UPDATE, no conditional UPDATE): the storage SELECT
    //   does NOT block → reads the still-uncommitted-as-false row → also
    //   credits → balance ends at 1000 and a second on-chain transfer is
    //   enqueued.
    const lockClient = await pool.connect();
    try {
      await lockClient.query("BEGIN");
      await lockClient.query(`SELECT id FROM players WHERE id=$1 FOR UPDATE`, [playerId]);

      // Kick off the real storage grant — it must block on the lock above.
      const grantPromise = storage.grantWelcomeBonus(playerId);
      await new Promise((r) => setTimeout(r, 250)); // let it reach + block on the lock

      // The in-flight grant completes: flip received + credit the bonus, then commit.
      await lockClient.query(
        `UPDATE players SET welcome_bonus_received=true, frntr_balance_micro=frntr_balance_micro+$2, total_frontier_earned=total_frontier_earned+$3 WHERE id=$1`,
        [playerId, WELCOME_BONUS_ASCEND * MICRO, WELCOME_BONUS_ASCEND],
      );
      await lockClient.query("COMMIT");

      // The storage grant now unblocks and must bail without a second credit.
      const granted = await grantPromise;
      expect(granted).toBe(false);

      const row = await playerRow(playerId);
      expect(row.balanceMicro).toBe(WELCOME_BONUS_ASCEND * MICRO); // credited exactly once, never doubled
      expect(row.earned).toBe(WELCOME_BONUS_ASCEND);
    } finally {
      lockClient.release();
    }
  });

  it("is double-grant safe under CONCURRENCY: exactly one grant, one credit", async () => {
    const [a, b] = await Promise.all([
      storage.grantWelcomeBonus(playerId),
      storage.grantWelcomeBonus(playerId),
    ]);

    const grants = [a, b].filter((r) => r === true);
    expect(grants).toHaveLength(1);

    const row = await playerRow(playerId);
    expect(row.balanceMicro).toBe(WELCOME_BONUS_ASCEND * MICRO);
    expect(row.earned).toBe(WELCOME_BONUS_ASCEND);
    expect(row.received).toBe(true);
  });
});
