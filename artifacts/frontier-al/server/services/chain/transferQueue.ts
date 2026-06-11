/**
 * server/services/chain/transferQueue.ts
 *
 * Persistent retry queue for on-chain FRONTIER (ASCEND) ASA transfers.
 *
 * Design:
 *  - `enqueueAscendTransfer` inserts a row into `pending_frontier_transfers`.
 *  - `drainAscendTransfers`  picks all `pending` rows and attempts each.
 *    The ASA ID is resolved lazily at drain time (fixes SEV2 #6 race condition).
 *    If the recipient is not opted-in, `last_error` is set to "not_opted_in"
 *    and the row stays `pending` for the next drain cycle.
 *  - `startAscendTransferWorker` schedules `drainAscendTransfers` on a
 *    fixed interval. `.unref()` ensures it does not keep the process alive.
 *
 * Constraints:
 *  - No Redis, no BullMQ — plain Postgres + setInterval.
 *  - Never import algosdk directly — use the chain service layer.
 */

import { randomUUID } from "crypto";
import { db } from "../../db";
import { pendingAscendTransfers } from "../../db-schema";
import { eq } from "drizzle-orm";
import { getAscendAsaId, isAddressOptedIn, transferAsa } from "./asa";

const MAX_ATTEMPTS = 20;

// ── Public API ────────────────────────────────────────────────────────────────

export interface EnqueueParams {
  recipientAddress:  string;
  recipientPlayerId?: string;
  /** Whole ASCEND tokens (not micro-units). */
  amount:            number;
  /** Descriptive tag, e.g. "welcome_bonus" | "claim_ascend" | "mining_yield" */
  reason:            string;
}

/**
 * Insert a pending FRONTIER transfer row.
 * The transfer is NOT sent immediately — `drainAscendTransfers` will pick it up.
 */
export async function enqueueAscendTransfer(params: EnqueueParams): Promise<void> {
  const now = Date.now();
  await db.insert(pendingAscendTransfers).values({
    id:                randomUUID(),
    recipientAddress:  params.recipientAddress,
    recipientPlayerId: params.recipientPlayerId ?? null,
    amount:            params.amount,
    reason:            params.reason,
    status:            "pending",
    attempts:          0,
    lastError:         null,
    txId:              null,
    createdAt:         now,
    updatedAt:         now,
  });
  console.log(
    `[transferQueue] enqueued ${params.amount} ASCEND → ${params.recipientAddress} (${params.reason})`
  );
}

/**
 * Drain all `pending` rows in one pass.
 * Called by the background worker interval.
 *
 * Each row is attempted independently:
 *  - If the ASA ID is not yet available, the entire drain is skipped
 *    (all rows stay pending for the next cycle).
 *  - If the recipient is not opted-in, `last_error` is set and the row
 *    stays `pending` for a future retry.
 *  - On success, `status` is set to `sent` and `tx_id` is recorded.
 *  - After MAX_ATTEMPTS failures, `status` is set to `failed`.
 */
export async function drainAscendTransfers(): Promise<void> {
  // Lazily resolve ASA ID at drain time — this is the SEV2 #6 fix.
  const asaId = getAscendAsaId();
  if (!asaId) {
    // ASA not yet bootstrapped; try again next cycle.
    return;
  }

  let rows: typeof pendingAscendTransfers.$inferSelect[];
  try {
    rows = await db
      .select()
      .from(pendingAscendTransfers)
      .where(eq(pendingAscendTransfers.status, "pending"));
  } catch (err) {
    console.error("[transferQueue] Failed to query pending transfers:", err);
    return;
  }

  if (rows.length === 0) return;
  console.log(`[transferQueue] draining ${rows.length} pending transfer(s)`);

  for (const row of rows) {
    const now      = Date.now();
    const attempts = row.attempts + 1;

    try {
      // Check opt-in state — if not opted in, leave pending for retry.
      const optedIn = await isAddressOptedIn(row.recipientAddress, asaId);
      if (!optedIn) {
        await db
          .update(pendingAscendTransfers)
          .set({
            attempts,
            lastError: "not_opted_in",
            updatedAt: now,
            // Escalate to failed only after MAX_ATTEMPTS
            ...(attempts >= MAX_ATTEMPTS ? { status: "failed" } : {}),
          })
          .where(eq(pendingAscendTransfers.id, row.id));

        if (attempts >= MAX_ATTEMPTS) {
          console.warn(
            `[transferQueue] Transfer ${row.id} failed permanently after ${attempts} attempts ` +
            `(${row.reason} → ${row.recipientAddress}): not opted-in`
          );
        }
        continue;
      }

      // Attempt the on-chain transfer.
      const txId = await transferAsa(row.recipientAddress, row.amount, {
        assetId: asaId,
        note:    JSON.stringify({
          game: "FRONTIER", v: 1, type: row.reason,
          amt: row.amount, to: row.recipientAddress, ts: now,
          queueId: row.id,
        }),
      });

      await db
        .update(pendingAscendTransfers)
        .set({ status: "sent", txId, attempts, lastError: null, updatedAt: now })
        .where(eq(pendingAscendTransfers.id, row.id));

      console.log(
        `[transferQueue] sent ${row.amount} ASCEND → ${row.recipientAddress} ` +
        `(${row.reason}) txId=${txId}`
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[transferQueue] Transfer ${row.id} attempt ${attempts} failed ` +
        `(${row.reason} → ${row.recipientAddress}):`,
        errMsg
      );

      await db
        .update(pendingAscendTransfers)
        .set({
          attempts,
          lastError: errMsg.slice(0, 500),
          updatedAt: now,
          ...(attempts >= MAX_ATTEMPTS ? { status: "failed" } : {}),
        })
        .where(eq(pendingAscendTransfers.id, row.id));

      if (attempts >= MAX_ATTEMPTS) {
        console.warn(
          `[transferQueue] Transfer ${row.id} failed permanently after ${attempts} attempts ` +
          `(${row.reason} → ${row.recipientAddress}): ${errMsg}`
        );
      }
    }
  }
}

/**
 * Start the background worker.
 * @param intervalMs  Poll interval in ms (default 30 s).
 * @returns The interval handle (already `.unref()`-ed).
 */
export function startAscendTransferWorker(intervalMs = 30_000): ReturnType<typeof setInterval> {
  console.log(`[transferQueue] worker started (interval=${intervalMs}ms)`);
  // Run one immediate drain so any queued transfers from startup are sent quickly.
  drainAscendTransfers().catch((err) =>
    console.error("[transferQueue] Initial drain failed:", err)
  );

  const handle = setInterval(() => {
    drainAscendTransfers().catch((err) =>
      console.error("[transferQueue] Drain failed:", err)
    );
  }, intervalMs);

  handle.unref();
  return handle;
}
