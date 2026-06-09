/**
 * server/services/chain/plot-purchase-group.ts
 *
 * FRONTIER atomic plot-purchase transaction group (one-signature delivery).
 *
 * The plot ASA must already be PRE-MINTED and held in admin custody (you cannot
 * create an ASA and opt-in/transfer it in the same group — assetIndex must be
 * concrete at sign time). This module builds and submits the 3-txn atomic group
 * that swaps the buyer's payment for the NFT with no paid-but-undelivered seam:
 *
 *   [0] payment       buyer  →  admin (treasury)   priceMicroAlgo   ← buyer signs
 *   [1] asset opt-in  buyer  →  buyer (0 units)     assetId          ← buyer signs
 *   [2] asset xfer    admin  →  buyer (1 unit)      assetId          ← admin signs (server-held)
 *
 * assignGroupID binds the three together: all-or-nothing. The buyer signs idx
 * [0,1] in ONE wallet approval; the admin signature for idx 2 is produced and
 * held SERVER-SIDE only — the client never sees or supplies it, so "never trust
 * the client's txn2" is automatic.
 *
 * Pure chain logic — NO DB, NO route logic. Callers (routes) own persistence.
 */

import algosdk from "algosdk";
import { getAlgodClient, getAdminAccount, getAdminAddress } from "./client";

/** Note prefix for purchase payments — distinct from auth's FRONTIER-AUTH:v1: flow. */
const PURCHASE_NOTE_PREFIX = "FRNTR:PLOT:";

const b64 = (u8: Uint8Array): string => Buffer.from(u8).toString("base64");
const fromB64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

/**
 * Defensive guard: none of the group txns may carry rekeyTo / closeRemainderTo /
 * assetCloseTo. We build them without those fields, and the submit-side txID
 * match re-proves it, but assert here too so a future edit can't silently add one.
 */
export function assertNoRekeyOrClose(txn: algosdk.Transaction): void {
  const t = txn as any;
  if (t.rekeyTo) throw new Error("[plot-group] rekeyTo must not be set");
  if (t.payment?.closeRemainderTo) throw new Error("[plot-group] closeRemainderTo must not be set");
  if (t.assetTransfer?.closeRemainderTo) throw new Error("[plot-group] assetCloseTo must not be set");
}

export interface BuiltPlotPurchaseGroup {
  /** txn0 (payment) id — the C1 idempotency key / plot_purchases PRIMARY KEY. */
  paymentTxId:     string;
  /** txn1 (opt-in) id — used to validate the client signed exactly our txn. */
  optInTxId:       string;
  /** txn2 (admin transfer) id — recorded as the delivery_tx_id. */
  deliveryTxId:    string;
  /** Unsigned txns (base64) returned to the client; it signs [0,1] of all three. */
  txn0Unsigned:    string;
  txn1Unsigned:    string;
  txn2Unsigned:    string;
  /** Admin signature for txn2 — held SERVER-SIDE, never sent to the client. */
  txn2AdminSigned: string;
  firstValid:      number;
  lastValid:       number;
}

/**
 * Build the 3-txn atomic purchase group for a pre-minted plot ASA.
 * Admin pre-signs txn2; the buyer will sign txn0 + txn1.
 */
export async function buildPlotPurchaseGroup(params: {
  plotId:         number;
  assetId:        number;
  buyerAddress:   string;
  priceMicroAlgo: number;
}): Promise<BuiltPlotPurchaseGroup> {
  const { plotId, assetId, buyerAddress, priceMicroAlgo } = params;

  if (!algosdk.isValidAddress(buyerAddress)) {
    throw new Error(`[plot-group] invalid buyer address: ${buyerAddress}`);
  }
  if (!Number.isInteger(assetId) || assetId <= 0) {
    throw new Error(`[plot-group] invalid assetId: ${assetId}`);
  }
  if (!Number.isInteger(priceMicroAlgo) || priceMicroAlgo <= 0) {
    throw new Error(`[plot-group] invalid priceMicroAlgo: ${priceMicroAlgo}`);
  }

  const algod     = getAlgodClient();
  const admin     = getAdminAccount();
  const adminAddr = getAdminAddress();
  const sp        = await algod.getTransactionParams().do();

  // [0] buyer pays the treasury (admin) the server-derived price.
  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender:          buyerAddress,
    receiver:        adminAddr,
    amount:          priceMicroAlgo,
    suggestedParams: sp,
    note:            new TextEncoder().encode(`${PURCHASE_NOTE_PREFIX}${plotId}`),
  });

  // [1] buyer opts into the plot ASA (0-amount self transfer). Intra-group this
  // executes before txn2, so the buyer need not be pre-opted-in.
  const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender:          buyerAddress,
    receiver:        buyerAddress,
    amount:          0,
    assetIndex:      assetId,
    suggestedParams: sp,
  });

  // [2] admin transfers the 1-of-1 plot NFT to the buyer.
  const xferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender:          adminAddr,
    receiver:        buyerAddress,
    amount:          1,
    assetIndex:      assetId,
    suggestedParams: sp,
  });

  algosdk.assignGroupID([payTxn, optInTxn, xferTxn]);
  [payTxn, optInTxn, xferTxn].forEach(assertNoRekeyOrClose);

  // Admin signs ONLY txn2; its signature stays server-side.
  const txn2Signed = xferTxn.signTxn(admin.sk);

  return {
    paymentTxId:     payTxn.txID(),
    optInTxId:       optInTxn.txID(),
    deliveryTxId:    xferTxn.txID(),
    txn0Unsigned:    b64(algosdk.encodeUnsignedTransaction(payTxn)),
    txn1Unsigned:    b64(algosdk.encodeUnsignedTransaction(optInTxn)),
    txn2Unsigned:    b64(algosdk.encodeUnsignedTransaction(xferTxn)),
    txn2AdminSigned: b64(txn2Signed),
    firstValid:      Number(sp.firstValid),
    lastValid:       Number(sp.lastValid),
  };
}

export interface SubmitResult {
  paymentTxId:    string;
  confirmedRound: number | null;
  alreadyInLedger: boolean;
}

/** Match algod errors that mean "this group/txn is already committed or pooled". */
function isAlreadyInLedger(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("already in ledger") ||
    msg.includes("transaction already in pool") ||
    msg.includes("transactionpool.remember")
  );
}

/**
 * Validate the client-signed txn0/txn1 against the exact txns the server built
 * (by txID — a hash over every field, so a match proves no tampering, no
 * rekey/close), splice in the server-held admin signature for txn2, submit the
 * group, and wait for confirmation.
 *
 * Idempotent: a resubmission of an already-committed group maps to success
 * rather than throwing, so a retry never double-charges.
 */
export async function submitPlotPurchaseGroup(params: {
  signedTxn0:        string; // base64, from the client
  signedTxn1:        string; // base64, from the client
  txn2AdminSigned:   string; // base64, server-held
  expectedPaymentTxId: string;
  expectedOptInTxId:   string;
}): Promise<SubmitResult> {
  const { signedTxn0, signedTxn1, txn2AdminSigned, expectedPaymentTxId, expectedOptInTxId } = params;
  const algod = getAlgodClient();

  // ── Never trust the client: the signed txns must be EXACTLY the ones we built.
  const s0 = fromB64(signedTxn0);
  const s1 = fromB64(signedTxn1);
  let d0: ReturnType<typeof algosdk.decodeSignedTransaction>;
  let d1: ReturnType<typeof algosdk.decodeSignedTransaction>;
  try {
    d0 = algosdk.decodeSignedTransaction(s0);
    d1 = algosdk.decodeSignedTransaction(s1);
  } catch (e) {
    throw new Error(`[plot-group] could not decode client-signed txns: ${(e as Error).message}`);
  }
  if (d0.txn.txID() !== expectedPaymentTxId) {
    throw new Error("[plot-group] signed txn0 does not match the prepared payment txn");
  }
  if (d1.txn.txID() !== expectedOptInTxId) {
    throw new Error("[plot-group] signed txn1 does not match the prepared opt-in txn");
  }
  if (!d0.sig || !d1.sig) {
    throw new Error("[plot-group] client txns are not signed");
  }

  // Group order is load-bearing: [pay, opt-in, admin-transfer].
  const group = [s0, s1, fromB64(txn2AdminSigned)];

  let alreadyInLedger = false;
  try {
    await algod.sendRawTransaction(group).do();
  } catch (err) {
    if (isAlreadyInLedger(err)) {
      alreadyInLedger = true; // a prior submit already landed — fall through to confirm.
    } else {
      throw err;
    }
  }

  // waitForConfirmation works whether we just submitted or it was already there.
  const confirmed = await algosdk.waitForConfirmation(algod, expectedPaymentTxId, 4);
  const confirmedRound = Number(
    (confirmed as any).confirmedRound ?? (confirmed as any)["confirmed-round"] ?? 0,
  ) || null;

  return {
    paymentTxId:  expectedPaymentTxId,
    confirmedRound,
    alreadyInLedger,
  };
}
