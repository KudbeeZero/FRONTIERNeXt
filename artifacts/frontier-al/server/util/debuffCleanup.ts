/**
 * server/util/debuffCleanup.ts
 *
 * Single bounded UPDATE that clears BOTH expired EMP and expired sabotage
 * debuffs in one pass. Previously this ran as two unconditional
 * `UPDATE parcels ... WHERE ... < now` statements every 5 seconds (17,280
 * scans/day even with no debuffs active). It is now moved to its own
 * configurable cadence (DEBUFF_CLEANUP_INTERVAL_MS, default 60s) and the
 * two statements are combined into one UPDATE with conditional field
 * clearing, so a parcel that has only an expired EMP does NOT lose its
 * active sabotage timer (and vice versa).
 *
 * The WHERE clause covers EITHER expired debuff; the SET uses CASE so each
 * field is only mutated when its own debuff is the expired one.
 */
import { sql } from "drizzle-orm";
import { parcels as parcelsTable } from "../db-schema";

/**
 * The combined WHERE for the debuff cleanup UPDATE. Exported so it can be
 * unit-tested structurally without a live database.
 */
export function buildDebuffCleanupWhere() {
  return sql`(
    ${parcelsTable.empDebuffUntil} IS NOT NULL
    AND ${parcelsTable.empDebuffUntil} < ${Date.now()}
  ) OR (
    ${parcelsTable.sabotageDebuffUntil} IS NOT NULL
    AND ${parcelsTable.sabotageDebuffUntil} < ${Date.now()}
  )`;
}

/**
 * The combined SET clause for the debuff cleanup UPDATE. Each field uses a
 * CASE that only mutates it when its own debuff is the expired one.
 */
export function buildDebuffCleanupSet() {
  const now = Date.now();
  return {
    defenseLevel: sql`CASE
      WHEN ${parcelsTable.empDebuffUntil} IS NOT NULL
       AND ${parcelsTable.empDebuffUntil} < ${now}
      THEN LEAST(${parcelsTable.defenseLevel} + 2, 10)
      ELSE ${parcelsTable.defenseLevel}
    END`,
    empDebuffUntil: sql`CASE
      WHEN ${parcelsTable.empDebuffUntil} IS NOT NULL
       AND ${parcelsTable.empDebuffUntil} < ${now}
      THEN NULL
      ELSE ${parcelsTable.empDebuffUntil}
    END`,
    yieldMultiplier: sql`CASE
      WHEN ${parcelsTable.sabotageDebuffUntil} IS NOT NULL
       AND ${parcelsTable.sabotageDebuffUntil} < ${now}
      THEN LEAST(${parcelsTable.yieldMultiplier} * 2, 2.0)
      ELSE ${parcelsTable.yieldMultiplier}
    END`,
    sabotageDebuffUntil: sql`CASE
      WHEN ${parcelsTable.sabotageDebuffUntil} IS NOT NULL
       AND ${parcelsTable.sabotageDebuffUntil} < ${now}
      THEN NULL
      ELSE ${parcelsTable.sabotageDebuffUntil}
    END`,
  } as const;
}

/** Structural DB type so this module can be unit-tested without a real pg pool. */
type AnyDb = {
  update(table: unknown): {
    set(values: Record<string, unknown>): {
      where(cond: ReturnType<typeof sql>): Promise<unknown>;
    };
  };
};

/**
 * Issue the combined debuff-cleanup UPDATE. Returns the promise from the
 * underlying driver (or the mock in tests).
 */
export async function runDebuffCleanup(db: AnyDb): Promise<void> {
  await db
    .update(parcelsTable)
    .set(buildDebuffCleanupSet() as unknown as Record<string, unknown>)
    .where(buildDebuffCleanupWhere());
}
