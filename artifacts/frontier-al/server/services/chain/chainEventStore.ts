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
  PURCHASE_STATE_ORDER,
} from "./chainEventLog";
export type { PurchaseState, ChainHealth } from "./chainEventLog";

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
