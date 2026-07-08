/**
 * server/services/chain/mintRetryQueue.ts
 *
 * Persistent retry queue for Plot NFT mints that fail AFTER the buyer's ALGO
 * payment has already been claimed (redeemed_payments) and land ownership
 * committed. Without this queue a failed mint left the buyer with land, no
 * NFT, no refund, and no automated recovery.
 *
 * Design:
 *  - `enqueuePlotMintRetry` inserts a row into `plot_mint_retry_queue`.
 *  - `drainPlotMintRetries` picks all `pending` rows and attempts each.
 *    If the mint succeeds, attempts delivery; if delivery succeeds or the
 *    buyer hasn't opted in yet, marks `delivered` or leaves `pending` for
 *    the next cycle. After MAX_ATTEMPTS mint failures, escalates to
 *    `refund_needed` and calls `refundAlgoPayment`.
 *  - `startPlotMintRetryWorker` schedules `drainPlotMintRetries` on a
 *    fixed interval. `.unref()` ensures it does not keep the process alive.
 *
 * Constraints:
 *  - No Redis, no BullMQ — plain Postgres + setInterval.
 *  - Never import algosdk directly — use the chain service layer.
 */

import { randomUUID } from "crypto";
import { db } from "../../db";
import { plotMintRetryQueue, plotNfts, mintIdempotency } from "../../db-schema";
import { eq, and } from "drizzle-orm";
import { mintLandNft } from "./land";
import { attemptDelivery } from "./land";
import { refundAlgoPayment } from "./refund";

const MAX_ATTEMPTS = 5;

// ── Public API ────────────────────────────────────────────────────────────────

export interface EnqueuePlotMintRetryParams {
  plotId: number;
  playerId: string;
  buyerAddress: string;
  algoPaymentTxId?: string;
  amountMicroAlgos?: number;
}

/**
 * Insert a pending plot mint retry row.
 * If a row already exists for this plot_id, update it to pending with reset attempts.
 * The mint is NOT attempted immediately — `drainPlotMintRetries` will pick it up.
 */
export async function enqueuePlotMintRetry(params: EnqueuePlotMintRetryParams): Promise<void> {
  const now = Date.now();

  // Check if a row already exists for this plot_id (handles duplicate enqueues)
  const [existing] = await db
    .select()
    .from(plotMintRetryQueue)
    .where(eq(plotMintRetryQueue.plotId, params.plotId))
    .limit(1);

  if (existing) {
    // Update existing row to pending with reset attempts
    await db
      .update(plotMintRetryQueue)
      .set({
        status: "pending",
        attempts: 0,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(plotMintRetryQueue.id, existing.id));
    console.log(
      `[mintRetryQueue] re-enqueued plotId=${params.plotId} buyer=${params.buyerAddress} (existing row reset)`
    );
  } else {
    // Insert new row
    await db.insert(plotMintRetryQueue).values({
      id: randomUUID(),
      plotId: params.plotId,
      playerId: params.playerId,
      buyerAddress: params.buyerAddress,
      algoPaymentTxId: params.algoPaymentTxId ?? null,
      amountMicroAlgos: params.amountMicroAlgos ?? null,
      status: "pending",
      attempts: 0,
      lastError: null,
      refundTxId: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(
      `[mintRetryQueue] enqueued plotId=${params.plotId} buyer=${params.buyerAddress}`
    );
  }
}

/**
 * Drain all `pending` rows in one pass.
 * Called by the background worker interval.
 *
 * Each row is attempted independently:
 *  - If the mint succeeds, attempts delivery.
 *  - If delivery succeeds, marks `delivered`.
 *  - If delivery fails with `not_opted_in`, leaves `pending` for retry.
 *  - If delivery fails with `transfer_failed`, leaves `pending` for retry.
 *  - After MAX_ATTEMPTS mint failures, escalates to `refund_needed` and
 *    calls `refundAlgoPayment`.
 */
export async function drainPlotMintRetries(): Promise<void> {
  let rows: typeof plotMintRetryQueue.$inferSelect[];
  try {
    rows = await db
      .select()
      .from(plotMintRetryQueue)
      .where(eq(plotMintRetryQueue.status, "pending"));
  } catch (err) {
    console.error("[mintRetryQueue] Failed to query pending retries:", err);
    return;
  }

  if (rows.length === 0) return;
  console.log(`[mintRetryQueue] draining ${rows.length} pending retry(ies)`);

  for (const row of rows) {
    const now = Date.now();
    const attempts = row.attempts + 1;

    try {
      // Check if already minted (idempotency or plot_nfts)
      const [existingIdempotency] = await db
        .select()
        .from(mintIdempotency)
        .where(eq(mintIdempotency.key, `mint:${row.playerId}:${row.plotId}`))
        .limit(1);

      if (existingIdempotency?.status === "confirmed" && existingIdempotency.assetId) {
        // Already minted — attempt delivery
        const assetId = Number(existingIdempotency.assetId);
        const delivery = await attemptDelivery(assetId, row.buyerAddress, row.plotId);
        if (delivery.delivered) {
          await db
            .update(plotMintRetryQueue)
            .set({ status: "delivered", attempts, lastError: null, updatedAt: now })
            .where(eq(plotMintRetryQueue.id, row.id));
          await db
            .update(plotNfts)
            .set({ mintedToAddress: row.buyerAddress })
            .where(eq(plotNfts.plotId, row.plotId));
          console.log(`[mintRetryQueue] plotId=${row.plotId} delivered (idempotency hit)`);
          continue;
        } else if (delivery.reason === "not_opted_in") {
          await db
            .update(plotMintRetryQueue)
            .set({ attempts, lastError: "not_opted_in", updatedAt: now })
            .where(eq(plotMintRetryQueue.id, row.id));
          continue;
        } else {
          await db
            .update(plotMintRetryQueue)
            .set({ attempts, lastError: "transfer_failed", updatedAt: now })
            .where(eq(plotMintRetryQueue.id, row.id));
          continue;
        }
      }

      // Check plot_nfts directly
      const [existingPlotNft] = await db
        .select()
        .from(plotNfts)
        .where(eq(plotNfts.plotId, row.plotId))
        .limit(1);

      if (existingPlotNft?.assetId) {
        // Already minted — attempt delivery
        const assetId = Number(existingPlotNft.assetId);
        const delivery = await attemptDelivery(assetId, row.buyerAddress, row.plotId);
        if (delivery.delivered) {
          await db
            .update(plotMintRetryQueue)
            .set({ status: "delivered", attempts, lastError: null, updatedAt: now })
            .where(eq(plotMintRetryQueue.id, row.id));
          await db
            .update(plotNfts)
            .set({ mintedToAddress: row.buyerAddress })
            .where(eq(plotNfts.plotId, row.plotId));
          console.log(`[mintRetryQueue] plotId=${row.plotId} delivered (plot_nfts hit)`);
          continue;
        } else if (delivery.reason === "not_opted_in") {
          await db
            .update(plotMintRetryQueue)
            .set({ attempts, lastError: "not_opted_in", updatedAt: now })
            .where(eq(plotMintRetryQueue.id, row.id));
          continue;
        } else {
          await db
            .update(plotMintRetryQueue)
            .set({ attempts, lastError: "transfer_failed", updatedAt: now })
            .where(eq(plotMintRetryQueue.id, row.id));
          continue;
        }
      }

      // Attempt the mint
      const rawBase =
        process.env.PUBLIC_BASE_URL ||
        (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
      const PUBLIC_BASE_URL = rawBase.replace(/\/+$/, "");

      if (!PUBLIC_BASE_URL) {
        await db
          .update(plotMintRetryQueue)
          .set({
            attempts,
            lastError: "PUBLIC_BASE_URL not set",
            updatedAt: now,
            ...(attempts >= MAX_ATTEMPTS ? { status: "refund_needed" } : {}),
          })
          .where(eq(plotMintRetryQueue.id, row.id));
        if (attempts >= MAX_ATTEMPTS) {
          await handleRefund(row);
        }
        continue;
      }

      const result = await mintLandNft({
        plotId: row.plotId,
        receiverAddress: row.buyerAddress,
        metadataBaseUrl: PUBLIC_BASE_URL,
      });

      // Persist to plot_nfts (upsert)
      await db
        .insert(plotNfts)
        .values({
          plotId: row.plotId,
          assetId: result.assetId,
          mintedToAddress: result.mintedToAddress,
          mintedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: plotNfts.plotId,
          set: { assetId: result.assetId, mintedToAddress: result.mintedToAddress, mintedAt: Date.now() },
        });

      // Mark idempotency confirmed
      const idempotencyKey = `mint:${row.playerId}:${row.plotId}`;
      await db
        .insert(mintIdempotency)
        .values({
          key: idempotencyKey,
          status: "confirmed",
          assetId: result.assetId,
          txId: result.createTxId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: mintIdempotency.key,
          set: { status: "confirmed", assetId: result.assetId, txId: result.createTxId, updatedAt: Date.now() },
        });

      console.log(`[mintRetryQueue] plotId=${row.plotId} minted assetId=${result.assetId}`);

      // Attempt delivery
      const delivery = await attemptDelivery(result.assetId, row.buyerAddress, row.plotId);
      if (delivery.delivered) {
        await db
          .update(plotMintRetryQueue)
          .set({ status: "delivered", attempts, lastError: null, updatedAt: now })
          .where(eq(plotMintRetryQueue.id, row.id));
        await db
          .update(plotNfts)
          .set({ mintedToAddress: row.buyerAddress })
          .where(eq(plotNfts.plotId, row.plotId));
        console.log(`[mintRetryQueue] plotId=${row.plotId} delivered`);
      } else if (delivery.reason === "not_opted_in") {
        await db
          .update(plotMintRetryQueue)
          .set({ attempts, lastError: "not_opted_in", updatedAt: now })
          .where(eq(plotMintRetryQueue.id, row.id));
        console.log(`[mintRetryQueue] plotId=${row.plotId} awaiting opt-in`);
      } else {
        await db
          .update(plotMintRetryQueue)
          .set({ attempts, lastError: "transfer_failed", updatedAt: now })
          .where(eq(plotMintRetryQueue.id, row.id));
        console.log(`[mintRetryQueue] plotId=${row.plotId} transfer failed, will retry`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[mintRetryQueue] Retry ${row.id} attempt ${attempts} failed (plotId=${row.plotId}):`,
        errMsg
      );

      await db
        .update(plotMintRetryQueue)
        .set({
          attempts,
          lastError: errMsg.slice(0, 500),
          updatedAt: now,
          ...(attempts >= MAX_ATTEMPTS ? { status: "refund_needed" } : {}),
        })
        .where(eq(plotMintRetryQueue.id, row.id));

      if (attempts >= MAX_ATTEMPTS) {
        await handleRefund(row);
      }
    }
  }
}

async function handleRefund(row: typeof plotMintRetryQueue.$inferSelect): Promise<void> {
  if (!row.algoPaymentTxId || !row.amountMicroAlgos) {
    console.warn(
      `[mintRetryQueue] plotId=${row.plotId} cannot refund — missing payment txId or amount`
    );
    return;
  }

  try {
    const refundTxId = await refundAlgoPayment({
      toAddress: row.buyerAddress,
      amountMicroAlgos: row.amountMicroAlgos,
      note: `FRONTIER plot mint refund plotId=${row.plotId}`,
    });

    await db
      .update(plotMintRetryQueue)
      .set({ status: "refunded", refundTxId, updatedAt: Date.now() })
      .where(eq(plotMintRetryQueue.id, row.id));

    console.log(
      `[mintRetryQueue] plotId=${row.plotId} refunded ${row.amountMicroAlgos} microAlgos to ${row.buyerAddress} txId=${refundTxId}`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[mintRetryQueue] Refund failed for plotId=${row.plotId}:`,
      errMsg
    );
    await db
      .update(plotMintRetryQueue)
      .set({ status: "refund_failed", lastError: errMsg.slice(0, 500), updatedAt: Date.now() })
      .where(eq(plotMintRetryQueue.id, row.id));
  }
}

/**
 * Start the background worker.
 * @param intervalMs  Poll interval in ms (default 60 s).
 * @returns The interval handle (already `.unref()`-ed).
 */
export function startPlotMintRetryWorker(intervalMs = 60_000): ReturnType<typeof setInterval> {
  console.log(`[mintRetryQueue] worker started (interval=${intervalMs}ms)`);
  // Run one immediate drain so any queued retries from startup are processed quickly.
  drainPlotMintRetries().catch((err) =>
    console.error("[mintRetryQueue] Initial drain failed:", err)
  );

  const handle = setInterval(() => {
    drainPlotMintRetries().catch((err) =>
      console.error("[mintRetryQueue] Drain failed:", err)
    );
  }, intervalMs);

  handle.unref();
  return handle;
}