/**
 * server/services/delivery-worker.ts
 *
 * Phased plot-delivery fulfillment worker — the guarantor behind the
 * "worker backbone + instant when it can" delivery model.
 *
 *   PAID ──▶ OPTED_IN ──▶ DELIVERED ──▶ STAMPED
 *
 * Each phase is verified ON-CHAIN (green) before advancing. The worker is
 * idempotent and retries with backoff, so indexer lag / slow confirmation never
 * produces a false failure (this is the fix for the audit's false-"funds not
 * taken" 402 and the recovery-window gap).
 *
 * SAFE CORE (this file, no funds moved): the read/verify loop that advances
 * PAID → OPTED_IN. The DELIVERED (admin→buyer transfer) and STAMPED (on-chain
 * completion note) phases move/sign funds and are added behind the algo-auditor
 * gate — the worker intentionally STOPS at OPTED_IN here.
 */

import { eq, and, sql, lte } from "drizzle-orm";
import { db } from "../db";
import { plotPurchases as plotPurchasesTable, players as playersTable } from "../db-schema";
import { getIndexerClient } from "./chain/client";
import { isAddressOptedIn } from "./chain/asa";

const TICK_MS = 15_000;      // how often the worker wakes
const BACKOFF_MS = 30_000;   // re-check a not-yet-green row after this delay
const BATCH = 25;            // max rows processed per tick

let _timer: ReturnType<typeof setInterval> | null = null;
let _running = false;        // prevent overlapping ticks

/** Is a txid confirmed on-chain? Read-only (indexer). Returns false on lag/404. */
async function isTxnConfirmed(txId: string): Promise<boolean> {
  try {
    const res: any = await getIndexerClient().lookupTransactionByID(txId).do();
    const txn = res?.transaction;
    const round = Number(txn?.confirmedRound ?? txn?.["confirmed-round"] ?? 0);
    return round > 0;
  } catch {
    return false; // not yet indexed / not found — the worker will retry
  }
}

/**
 * Advance ONE purchase row through the SAFE phases (no funds): PAID → OPTED_IN.
 * Always either advances the phase or reschedules with backoff — never throws.
 */
async function advanceRow(row: typeof plotPurchasesTable.$inferSelect): Promise<void> {
  if (!db) return;
  const now = Date.now();

  const reschedule = (lastError: string) =>
    db!.update(plotPurchasesTable)
      .set({ attempts: (row.attempts ?? 0) + 1, nextRunAt: now + BACKOFF_MS, lastError, updatedAt: now })
      .where(eq(plotPurchasesTable.paymentTxId, row.paymentTxId));

  if (row.phase === "paid") {
    // Phase gate 1: the buyer's payment must be confirmed on-chain.
    if (!(await isTxnConfirmed(row.paymentTxId))) return void reschedule("payment not yet confirmed");

    // Need the minted ASA to check opt-in.
    if (!row.assetId) return void reschedule("assetId not set (mint pending)");

    // Resolve the buyer's address to check their opt-in.
    const [player] = await db
      .select({ address: playersTable.address })
      .from(playersTable)
      .where(eq(playersTable.id, row.playerId));
    if (!player?.address) return void reschedule("buyer address unavailable");

    // Phase gate 2: the buyer must have opted into the plot ASA.
    if (!(await isAddressOptedIn(player.address, Number(row.assetId)))) {
      return void reschedule("awaiting buyer opt-in");
    }

    // Both gates green → advance. Run again immediately (DELIVERED is next).
    await db
      .update(plotPurchasesTable)
      .set({ phase: "opted_in", attempts: 0, nextRunAt: now, lastError: null, updatedAt: now })
      .where(eq(plotPurchasesTable.paymentTxId, row.paymentTxId));
    console.log(`[delivery-worker] ${row.paymentTxId.slice(0, 8)}… plot=${row.plotId} → OPTED_IN (ready to deliver)`);
    return;
  }

  if (row.phase === "opted_in") {
    // DELIVERED = admin→buyer transfer (FUNDS). Deferred behind the algo-auditor
    // gate; the safe core does not move assets. Just keep the row warm.
    return void reschedule("ready to deliver — awaiting funds-gated transfer step");
  }
}

/** One worker tick: process due, non-terminal rows. Read-only except phase bumps. */
export async function runDeliveryWorkerOnce(): Promise<void> {
  if (!db || _running) return;
  _running = true;
  try {
    const now = Date.now();
    const rows = await db
      .select()
      .from(plotPurchasesTable)
      .where(
        and(
          sql`${plotPurchasesTable.phase} NOT IN ('delivered', 'stamped', 'failed')`,
          lte(plotPurchasesTable.nextRunAt, now),
        ),
      )
      .limit(BATCH);

    for (const row of rows) {
      try {
        await advanceRow(row);
      } catch (err) {
        console.error(`[delivery-worker] row ${row.paymentTxId.slice(0, 8)}… error:`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    _running = false;
  }
}

/** Start the phased delivery worker (safe core). Idempotent. */
export function startDeliveryWorker(): void {
  if (_timer) return;
  _timer = setInterval(() => void runDeliveryWorkerOnce(), TICK_MS);
  console.log("[delivery-worker] phased plot-delivery worker started (safe core: PAID → OPTED_IN)");
}
