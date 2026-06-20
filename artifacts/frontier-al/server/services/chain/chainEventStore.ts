/**
 * server/services/chain/chainEventStore.ts
 *
 * DB I/O for the on-chain purchase audit trail (chain_events + purchase_intents,
 * migration 0009). Imports `db`; builds on the pure logic in `chainEventLog.ts`.
 *
 * The write path (`recordPurchaseTransition`) is fire-and-forget and NEVER
 * throws — it is pure instrumentation wired into the live purchase handler and
 * must never break a purchase. It no-ops when the DB is unavailable (dev/mem
 * mode, or before migration 0009 is applied). Read helpers return [] without a DB.
 */
import { db } from "../../db";
import { chainEvents, purchaseIntents } from "../../db-schema";
import { desc } from "drizzle-orm";
import {
  buildTransitionRows,
  identifyStaleIntents,
  resolveTimeoutMs,
  type TransitionInput,
  type ChainEventRow,
  type PurchaseIntentRow,
} from "./chainEventLog";

// Re-export the pure surface so callers (routes) can import everything here.
export {
  newIntentId,
  currentNetwork,
  summarizePurchaseFunnel,
  summarizeChainHealth,
  identifyStaleIntents,
  resolveTimeoutMs,
  PURCHASE_STATE_ORDER,
  PURCHASE_INTENT_TTL_FLOOR_MS,
} from "./chainEventLog";
export type { PurchaseState, ChainHealth } from "./chainEventLog";

/**
 * Reaper config (env-overridable, floor-clamped). A pending purchase_intent
 * older than the timeout is flipped to `timeout`; the reaper runs on an
 * interval. Defaults are conservative — `inventory_syncing` can legitimately
 * wait on a buyer's NFT opt-in, so the default is generous (7d).
 */
export const PURCHASE_INTENT_TIMEOUT_MS = resolveTimeoutMs(
  process.env.PURCHASE_INTENT_TIMEOUT_MS,
  7 * 24 * 60 * 60 * 1000, // 7 days
);
export const PURCHASE_INTENT_REAP_INTERVAL_MS = resolveTimeoutMs(
  process.env.PURCHASE_INTENT_REAP_INTERVAL_MS,
  60 * 60 * 1000, // hourly
);

/**
 * Fire-and-forget: append a chain_event and upsert the purchase_intent.
 * Never throws; no-ops without a DB. Call as `void recordPurchaseTransition(...)`.
 */
export async function recordPurchaseTransition(input: TransitionInput): Promise<void> {
  if (!db) return;
  try {
    const { event, intent } = buildTransitionRows(input);
    await db
      .insert(purchaseIntents)
      .values(intent)
      .onConflictDoUpdate({
        target: purchaseIntents.id,
        set: {
          state: intent.state,
          txId: intent.txId,
          amount: intent.amount,
          lastError: intent.lastError,
          updatedAt: intent.updatedAt,
        },
      });
    await db.insert(chainEvents).values(event);
  } catch (err) {
    // Audit logging must never break the purchase path.
    console.warn(`[chain-event] record failed: ${(err as Error).message}`);
  }
}

/** db-guarded: most recent chain_events (newest first). Returns [] without a DB. */
export async function queryRecentChainEvents(limit = 50): Promise<ChainEventRow[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(chainEvents)
    .orderBy(desc(chainEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows as ChainEventRow[];
}

/** db-guarded: all purchase_intents (small table; bounded by attempts). */
export async function queryPurchaseIntents(): Promise<PurchaseIntentRow[]> {
  if (!db) return [];
  const rows = await db.select().from(purchaseIntents);
  return rows as PurchaseIntentRow[];
}

/**
 * Reaper: flip every STALE pending purchase_intent (age > ttl) to `timeout`.
 * Returns the number reaped. Best-effort: db-guarded and never throws (mirrors
 * `recordPurchaseTransition`), so a failed run can never crash the interval or
 * the server. Idempotent — once a row is `timeout` it is terminal and a later
 * run will not re-select it. Pure off-chain telemetry: no payment/chain effect.
 *
 * Each timed-out row reuses `recordPurchaseTransition`, preserving the original
 * `playerId`/`kind`/`refId`/`txId`/`createdAt` (the upsert's conflict-set never
 * overwrites those) and appending an accurate `purchase_timeout` chain_event.
 */
export async function timeoutStalePurchaseIntents(opts?: {
  now?: number;
  ttlMs?: number;
}): Promise<number> {
  if (!db) return 0;
  const now = opts?.now ?? Date.now();
  const ttlMs = opts?.ttlMs ?? PURCHASE_INTENT_TIMEOUT_MS;
  try {
    const intents = await queryPurchaseIntents();
    const staleIds = new Set(identifyStaleIntents(intents, now, ttlMs));
    if (staleIds.size === 0) return 0;
    let reaped = 0;
    for (const row of intents) {
      if (!staleIds.has(row.id)) continue;
      await recordPurchaseTransition({
        intentId: row.id,
        playerId: row.playerId,
        kind: row.kind === "commander" ? "commander" : "plot",
        refId: row.refId,
        txId: row.txId,
        amount: row.amount,
        state: "timeout",
        event: "purchase_timeout",
        lastError: `auto-timeout: pending > ${ttlMs}ms`,
        now,
      });
      reaped += 1;
    }
    return reaped;
  } catch (err) {
    console.warn(`[chain-event] timeout reaper failed: ${(err as Error).message}`);
    return 0;
  }
}
