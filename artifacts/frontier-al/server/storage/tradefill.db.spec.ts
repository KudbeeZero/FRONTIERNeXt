/**
 * server/storage/tradefill.db.spec.ts
 *
 * Postgres-backed integration test for the trade-fill storage path on
 * DbStorage — specifically the concurrent double-fill guard.
 *
 * `fillTradeOrder` used to SELECT the order without a row lock and mark it
 * filled keying only on `id`, so two concurrent fills of the SAME open order
 * both passed the `status==='open'` check and both applied the resource
 * transfer — a real double-spend (audit finding, 2026-07-06). The fix mirrors
 * openLootBox: `FOR UPDATE` on the order SELECT + a conditional
 * `UPDATE … WHERE status='open'` (rowCount) claim BEFORE moving any resources.
 *
 * This runs the REAL node-postgres driver against a REAL Postgres so
 * `FOR UPDATE` and the driver `rowCount`/`RETURNING` behave authentically (an
 * in-memory shim does not populate them). MemStorage's fillTradeOrder is a stub,
 * so DbStorage is the only real implementation and can only be exercised here.
 *
 * GATED on DATABASE_URL: when unset (the default CI job) the whole block is
 * skipped — see docs/COVERAGE_GATE.md / the "Integration tests (Postgres)" step.
 * db.ts is imported dynamically so the skip path never touches its
 * DATABASE_URL-required module load.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("trade fill storage (DbStorage / Postgres integration)", () => {
  let storage: any;
  let pool: Pool;
  let seq = 0;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Minimal schema: just the columns fillTradeOrder reads/writes. `ascend` is
    // physically the `frontier` column (db-schema.ts:196).
    await pool.query(`DROP TABLE IF EXISTS trade_orders`);
    await pool.query(`DROP TABLE IF EXISTS players`);
    await pool.query(`
      CREATE TABLE players (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "name" varchar(100) NOT NULL DEFAULT 'p',
        "iron" integer NOT NULL DEFAULT 0,
        "fuel" integer NOT NULL DEFAULT 0,
        "crystal" integer NOT NULL DEFAULT 0,
        "frontier" integer NOT NULL DEFAULT 0
      )`);
    await pool.query(`
      CREATE TABLE trade_orders (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "offerer_id" varchar(36) NOT NULL,
        "offerer_name" varchar(100) NOT NULL,
        "give_resource" varchar(20) NOT NULL,
        "give_amount" integer NOT NULL,
        "want_resource" varchar(20) NOT NULL,
        "want_amount" integer NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "created_at" bigint NOT NULL,
        "filled_by_id" varchar(36),
        "filled_by_name" varchar(100),
        "filled_at" bigint
      )`);

    const { DbStorage } = await import("./db.js");
    storage = new DbStorage();
    storage.initPromise = Promise.resolve(); // skip world seed
  });

  afterAll(async () => {
    await pool?.end();
  });

  let offererId: string, fillerAId: string, fillerBId: string, orderId: string;

  beforeEach(async () => {
    seq++;
    offererId = `tf-offerer-${seq}`;
    fillerAId = `tf-fillerA-${seq}`;
    fillerBId = `tf-fillerB-${seq}`;
    orderId = `tf-order-${seq}`;
    // Offerer gives 100 iron, wants 50 fuel. Both fillers hold 50 fuel.
    await pool.query(`INSERT INTO players (id,name,iron,fuel) VALUES ($1,'offerer',100,0)`, [offererId]);
    await pool.query(`INSERT INTO players (id,name,iron,fuel) VALUES ($1,'fillerA',0,50)`, [fillerAId]);
    await pool.query(`INSERT INTO players (id,name,iron,fuel) VALUES ($1,'fillerB',0,50)`, [fillerBId]);
    await pool.query(
      `INSERT INTO trade_orders (id,offerer_id,offerer_name,give_resource,give_amount,want_resource,want_amount,status,created_at)
       VALUES ($1,$2,'offerer','iron',100,'fuel',50,'open',$3)`,
      [orderId, offererId, Date.now()],
    );
  });

  async function bal(id: string): Promise<{ iron: number; fuel: number }> {
    const { rows } = await pool.query(`SELECT iron, fuel FROM players WHERE id=$1`, [id]);
    return { iron: Number(rows[0].iron), fuel: Number(rows[0].fuel) };
  }

  it("serial second fill is rejected; resources move exactly once", async () => {
    const first = await storage.fillTradeOrder(orderId, fillerAId);
    expect(first.success).toBe(true);

    const second = await storage.fillTradeOrder(orderId, fillerBId);
    expect(second.success).toBe(false);
    expect(second.error).toMatch(/no longer open/i);

    // Offerer debited 100 iron once, credited 50 fuel once.
    expect(await bal(offererId)).toEqual({ iron: 0, fuel: 50 });
    // Winner (A) got the iron and spent the fuel; loser (B) untouched.
    expect(await bal(fillerAId)).toEqual({ iron: 100, fuel: 0 });
    expect(await bal(fillerBId)).toEqual({ iron: 0, fuel: 50 });
  });

  it("is double-fill safe under CONCURRENCY (FOR UPDATE + conditional claim): exactly one fill", async () => {
    // Two different fillers race the same open order on separate pooled
    // connections. The FOR UPDATE lock serializes them; the loser re-reads
    // status='filled' (or the conditional claim matches 0 rows) and bails
    // BEFORE any transfer — so the offerer is debited exactly once.
    const [a, b] = await Promise.all([
      storage.fillTradeOrder(orderId, fillerAId),
      storage.fillTradeOrder(orderId, fillerBId),
    ]);

    const wins = [a, b].filter((r) => r.success);
    const losses = [a, b].filter((r) => !r.success);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0].error).toMatch(/no longer open/i);

    // The offerer must be debited exactly once (not 200 iron / not -100 fuel).
    expect(await bal(offererId)).toEqual({ iron: 0, fuel: 50 });

    // Exactly one filler was credited the 100 iron; the other is untouched.
    const a2 = await bal(fillerAId);
    const b2 = await bal(fillerBId);
    const credited = [a2, b2].filter((x) => x.iron === 100 && x.fuel === 0);
    const untouched = [a2, b2].filter((x) => x.iron === 0 && x.fuel === 50);
    expect(credited).toHaveLength(1);
    expect(untouched).toHaveLength(1);
  });
});
