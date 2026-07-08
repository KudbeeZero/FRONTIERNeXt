/**
 * server/services/chain/refund.ts
 *
 * ALGO refund primitive for failed Plot NFT mints (M1-5).
 *
 * When a mint fails after the buyer's ALGO payment has been claimed,
 * this module issues a refund from the admin account back to the buyer.
 *
 * Constraints:
 *  - Never import algosdk directly — use the chain service layer.
 *  - Only called by mintRetryQueue after MAX_ATTEMPTS mint failures.
 *  - Admin account must hold sufficient ALGO for the refund.
 */

import { getAlgodClient, getAdminAccount } from "./client";
import algosdk from "algosdk";

export interface RefundParams {
  toAddress: string;
  amountMicroAlgos: number;
  note?: string;
}

/**
 * Issue an ALGO refund from the admin account to the buyer.
 * Returns the refund transaction ID on success.
 *
 * Throws if the admin account has insufficient balance or the transaction fails.
 */
export async function refundAlgoPayment(params: RefundParams): Promise<string> {
  const { toAddress, amountMicroAlgos, note } = params;
  const algod = getAlgodClient();
  const adminAccount = getAdminAccount();

  const suggestedParams = await algod.getTransactionParams().do();

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: adminAccount.addr.toString(),
    receiver: toAddress,
    amount: BigInt(amountMicroAlgos),
    suggestedParams,
    note: note ? new TextEncoder().encode(note) : undefined,
  });

  const signedTxn = txn.signTxn(adminAccount.sk);
  const response = await algod.sendRawTransaction(signedTxn).do();
  const txId = response.txid || txn.txID();

  await algosdk.waitForConfirmation(algod, txId, 4);

  console.log(
    `[chain/refund] refunded ${amountMicroAlgos} microAlgos to ${toAddress} txId=${txId}`
  );

  return txId;
}
