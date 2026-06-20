/**
 * server/services/chain/chainEventStore.db.spec.ts
 *
 * Postgres-backed integration test for the purchase-intent TIMEOUT REAPER
 * (`timeoutStalePurchaseIntents`). The pure selection logic is unit-tested in
 * chainEventLog.spec.ts; this proves the real DB mutation:
 *   - stale PENDING intents (age > ttl) flip to `timeout`;
 *   - recently-created pending intents stay pending;
 *   - terminal intents (complete/failed/…) are never touched;
 *   - the reaper is idempotent (a second run times out nothing more);
 *   - the original player_id / kind / created_at are preserved and a
 *     `purchase_timeout` chain_event is appended.
 *
 * GATED on DATABASE_URL: when unset (the default CI job + local `test:server`)
 * the whole block is skipped, and `chainEventStore` (which imports the
 * DATABASE_URL-required `db.ts`) is only imported dynamically inside the gated
 * `beforeAll`, so the skip path never evaluates it. Schema comes from applying
 * the real `migrations/0009_chain_events.sql` (two standalone tables, no FKs).
 * Runs in the "Integration tests (Postgres)" CI step via `test:server:db`.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { Pool } from "pg";

const HAS_DB = !!process.env.DATABASE_URL;
const DAY = 24 * 60 * 60 * 1000;
const TTL = 7 * DAY;
const NOW = 1_700_000_000_000;
const OLD = NOW - TTL - 1; // strictly older than the TTL → stale if pending
const RECENT = NOW - TTL + 60_000; // pending but inside the TTL window

describe.skipIf(!HAS_DB)("purchase-intent timeout reaper (Postgres integration)", () => {
  let pool: Pool;
  let store: typeof import("./chainEventStore.js");

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // Import only now that DATABASE_URL is known-set (db.ts throws without it).
    store = await import("./chainEventStore.js");
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    // Fresh schema from the real migration (chain_events + purchase_intents).
    await pool.query(`DROP TABLE IF EXISTS chain_events`);
    await pool.query(`DROP TABLE IF EXISTS purchase_intents`);
    const migration = readFileSync(
      new URL("../../../migrations/0009_chain_events.sql", import.meta.url),
      "utf8",
    );
    await pool.query(migration);
  });

  // Seed via the real recorder, backdating createdAt through its `now` input.
  async function seed(
    intentId: string,
    state: string,
    createdAt: number,
    kind: "plot" | "commander" = "plot",
  ): Promise<void> {
    await store.recordPurchaseTransition({
      intentId,
      playerId: `p-${intentId}`,
      kind,
      state: state as any,
      refId: "r1",
      txId: `tx-${intentId}`,
      amount: 1000,
      now: createdAt,
    });
  }
  async function stateOf(id: string): Promise<string | undefined> {
    const r = await pool.query(`SELECT state FROM purchase_intents WHERE id = $1`, [id]);
    return r.rows[0]?.state;
  }

  it("flips stale pending intents to timeout; leaves recent + terminal untouched", async () => {
    await seed("stale-confirmed", "confirmed", OLD);
    await seed("stale-syncing", "inventory_syncing", OLD);
    await seed("recent-submitting", "submitting", RECENT);
    await seed("done", "complete", OLD);
    await seed("failed", "failed", OLD);

    const n = await store.timeoutStalePurchaseIntents({ now: NOW, ttlMs: TTL });
    expect(n).toBe(2);

    expect(await stateOf("stale-confirmed")).toBe("timeout");
    expect(await stateOf("stale-syncing")).toBe("timeout");
    expect(await stateOf("recent-submitting")).toBe("submitting");
    expect(await stateOf("done")).toBe("complete");
    expect(await stateOf("failed")).toBe("failed");
  });

  it("is idempotent — a second run times out nothing more", async () => {
    await seed("s1", "confirmed", OLD);
    expect(await store.timeoutStalePurchaseIntents({ now: NOW, ttlMs: TTL })).toBe(1);
    expect(await store.timeoutStalePurchaseIntents({ now: NOW, ttlMs: TTL })).toBe(0);
    expect(await stateOf("s1")).toBe("timeout");
  });

  it("preserves player_id / kind / created_at and appends a purchase_timeout event", async () => {
    await seed("keep", "confirmed", OLD, "commander");
    await store.timeoutStalePurchaseIntents({ now: NOW, ttlMs: TTL });

    const row = (
      await pool.query(`SELECT player_id, kind, created_at FROM purchase_intents WHERE id = $1`, ["keep"])
    ).rows[0];
    expect(row.player_id).toBe("p-keep");
    expect(row.kind).toBe("commander");
    expect(Number(row.created_at)).toBe(OLD); // original creation time preserved (not bumped to NOW)

    const ev = await pool.query(
      `SELECT count(*)::int AS c FROM chain_events WHERE event = 'purchase_timeout' AND player_id = $1`,
      ["p-keep"],
    );
    expect(ev.rows[0].c).toBe(1);
  });

  it("no-ops to 0 when there are no stale intents", async () => {
    await seed("fresh", "submitting", RECENT);
    expect(await store.timeoutStalePurchaseIntents({ now: NOW, ttlMs: TTL })).toBe(0);
    expect(await stateOf("fresh")).toBe("submitting");
  });
});
