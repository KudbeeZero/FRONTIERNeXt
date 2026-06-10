/**
 * server/services/payment-dedup.ts
 *
 * Replay guard for ALGO payments (HARD RULE #3: the payment txid is the
 * idempotency key — a single payment must never fund more than one purchase).
 *
 * One confirmed payment txid is consumed AT MOST once across the whole economy;
 * plot purchases and commander mints share the `consumed_payment_txids` ledger.
 * No chain RPC here — this is the DB claim only. Call it AFTER verifying the
 * payment on-chain, so an unconfirmed/invalid payment is never consumed.
 */

import { db } from "../db";
import { consumedPaymentTxids } from "../db-schema";

export type PaymentPurpose = "plot" | "commander";

export interface ConsumePaymentTxidArgs {
  txId:            string;
  purpose:         PaymentPurpose;
  refId:           string; // plotId / parcelId / commanderId — audit trail only
  playerId:        string;
  amountMicroAlgo: number; // the verified amount actually paid
}

/**
 * Atomically claim a verified payment txid. Returns `true` if THIS caller won
 * the claim (proceed with the grant), `false` if the txid was already consumed
 * (the caller MUST reject the request as a replay, e.g. HTTP 409).
 *
 * Consumption is PERMANENT and fail-closed: callers must never release a won
 * claim, even if the grant later fails — a released txid is a double-spend
 * vector. A verified-but-ungranted payment is a recoverable, admin-reconcilable
 * case; a double-spend is not.
 *
 * When the database is unavailable (dev/test without DATABASE_URL) this returns
 * `true` with a warning — replay protection requires a database, mirroring the
 * codebase's other db-optional guards.
 */
export async function consumePaymentTxid(args: ConsumePaymentTxidArgs): Promise<boolean> {
  if (!db) {
    console.warn(`[payment-dedup] DB unavailable — replay protection SKIPPED for txId=${args.txId}`);
    return true;
  }

  const inserted = await db
    .insert(consumedPaymentTxids)
    .values({
      txId:            args.txId,
      purpose:         args.purpose,
      refId:           args.refId,
      playerId:        args.playerId,
      amountMicroAlgo: args.amountMicroAlgo,
      consumedAt:      Date.now(),
    })
    .onConflictDoNothing()
    .returning({ txId: consumedPaymentTxids.txId });

  return inserted.length > 0;
}
