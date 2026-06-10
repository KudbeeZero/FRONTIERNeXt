/**
 * server/services/chain/commander.ts
 *
 * FRONTIER Commander NFT (ASA) mint and transfer service.
 *
 * Mirrors land.ts pattern exactly. Custodian model: NFT is held by admin
 * after minting; buyer calls POST /api/nft/deliver-commander/:commanderId
 * after opting in to receive it.
 *
 * On mainnet: freeze/clawback are unset → freely tradeable on secondary markets.
 *
 * No UI imports. No route logic. No game state.
 */

import algosdk from "algosdk";
import { getAlgodClient, getAdminAccount, getAdminAddress, getNetwork, getIndexerClient } from "./client";
import { isAddressOptedIn } from "./asa";
import { assertMintBaseUrlSafe } from "../../lib/public-base-url";
import type { AssetId, MintResult } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MintCommanderParams {
  commanderId:     string; // UUID from CommanderAvatar.id
  tier:            "sentinel" | "phantom" | "reaper";
  receiverAddress: string; // buyer's Algorand wallet (held in custody until opt-in)
  metadataBaseUrl: string; // PUBLIC_BASE_URL — baked permanently into on-chain ASA
}

export interface TransferCommanderParams {
  assetId:   AssetId;
  toAddress: string;
  note?:     string;
}

// ── Mint ──────────────────────────────────────────────────────────────────────

/**
 * Mint a FRONTIER Commander NFT (1-of-1 Algorand ASA).
 *
 * NFT is held in admin custody after creation — buyer opts in then calls deliver.
 * Idempotency: caller must check the DB before calling this function.
 */
export async function mintCommanderNft(params: MintCommanderParams): Promise<MintResult> {
  const { commanderId, tier, receiverAddress, metadataBaseUrl } = params;
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const network = getNetwork();

  const baseUrl = metadataBaseUrl.replace(/\/+$/, "");
  // assetURL is IMMUTABLE once minted — never bake a localhost/non-public URL on
  // mainnet (throws); warns on testnet/localnet (throwaway assets).
  assertMintBaseUrlSafe(baseUrl, network);
  const shortId = commanderId.slice(0, 8);

  // Algorand ASA name limit is 32 bytes. Keep well under the limit.
  // "FRONTIER SENTINEL #aa4a26e8" = 27 chars (longest tier "sentinel" = 8 chars)
  const tierUpper = tier.toUpperCase(); // SENTINEL / PHANTOM / REAPER (7–8 chars)
  const assetName = `FRONTIER ${tierUpper} #${shortId}`; // max 27 chars

  const createSp = await algod.getTransactionParams().do();

  const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender:         account.addr.toString(),
    total:          BigInt(1),
    decimals:       0,
    defaultFrozen:  false,
    unitName:       "CMDR",
    assetName,
    assetURL:       `${baseUrl}/nft/metadata/commander/${commanderId}#arc3`,
    manager:        account.addr.toString(),
    reserve:        account.addr.toString(),
    // Mainnet: no freeze/clawback → freely tradeable on secondary markets.
    // Testnet: keep all roles for recovery during development.
    freeze:         network === "mainnet" ? undefined : account.addr.toString(),
    clawback:       network === "mainnet" ? undefined : account.addr.toString(),
    suggestedParams: createSp,
    note:           new TextEncoder().encode(`FRONTIER Commander NFT ${tier} #${shortId} - ${network}`),
  });

  const signedCreate   = createTxn.signTxn(account.sk);
  const createResponse = await algod.sendRawTransaction(signedCreate).do();
  const createTxId     = createResponse.txid || createTxn.txID();

  const confirmedCreate = await algosdk.waitForConfirmation(algod, createTxId, 2);
  const assetId: AssetId = Number(
    (confirmedCreate as any).assetIndex ?? (confirmedCreate as any)["asset-index"]
  );

  if (!assetId) {
    throw new Error(
      `[chain/commander] mintCommanderNft: no assetIndex in confirmed create tx ${createTxId} for commanderId=${commanderId}`
    );
  }

  console.log(
    `[chain/commander] commanderId=${commanderId} tier=${tier} ASA created assetId=${assetId} txId=${createTxId}` +
    ` | custody: admin holds until buyer opts in (receiverAddress=${receiverAddress})`
  );

  return {
    assetId,
    createTxId,
    transferTxId:    undefined,
    custodyHeld:     true,
    mintedToAddress: account.addr.toString(),
  };
}

// ── Transfer ──────────────────────────────────────────────────────────────────

/**
 * Transfer an already-minted Commander NFT from admin to a receiver.
 * Caller must verify the receiver has opted into the ASA before calling this.
 */
export async function transferCommanderNft(params: TransferCommanderParams): Promise<{ txId: string }> {
  const { assetId, toAddress, note } = params;
  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const sp      = await algod.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender:          account.addr.toString(),
    receiver:        toAddress,
    amount:          1,
    assetIndex:      assetId,
    suggestedParams: sp,
    note:            new TextEncoder().encode(note ?? `FRONTIER Commander NFT transfer to ${toAddress}`),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();

  await algosdk.waitForConfirmation(algod, txId, 2);

  console.log(`[chain/commander] Transferred assetId=${assetId} to ${toAddress} txId=${txId}`);
  return { txId };
}

// ── Liquidity Split ───────────────────────────────────────────────────────────

/**
 * Forward `microAlgo` to the LIQUIDITY_WALLET (env var).
 * Fire-and-forget — caller should not await or block on this.
 */
export async function forwardLiquiditySplit(microAlgo: number, note: string): Promise<void> {
  const liquidityWallet = process.env.LIQUIDITY_WALLET;
  if (!liquidityWallet || !algosdk.isValidAddress(liquidityWallet)) {
    console.warn("[chain/commander] LIQUIDITY_WALLET not set or invalid — skipping liquidity split");
    return;
  }

  const algod   = getAlgodClient();
  const account = getAdminAccount();
  const sp      = await algod.getTransactionParams().do();

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender:          account.addr.toString(),
    receiver:        liquidityWallet,
    amount:          BigInt(microAlgo),
    suggestedParams: sp,
    note:            new TextEncoder().encode(note),
  });

  const signed   = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId     = response.txid || txn.txID();

  await algosdk.waitForConfirmation(algod, txId, 2);
  console.log(`[chain/commander] Liquidity split ${microAlgo} microAlgo → ${liquidityWallet} txId=${txId}`);
}

// ── Delivery ──────────────────────────────────────────────────────────────────

/**
 * Attempt delivery of a custody-held Commander NFT.
 * Checks opt-in status first; safe to call multiple times.
 */
export async function attemptCommanderDelivery(
  assetId: AssetId,
  toAddress: string,
  commanderId: string
): Promise<{ delivered: boolean; reason?: string }> {
  try {
    const optedIn = await isAddressOptedIn(toAddress, assetId);
    if (!optedIn) return { delivered: false, reason: "not_opted_in" };
    await transferCommanderNft({ assetId, toAddress, note: `FRONTIER Commander NFT ${commanderId} delivery` });
    return { delivered: true };
  } catch (err) {
    console.error(`[chain/commander] attemptCommanderDelivery failed commanderId=${commanderId}:`, err);
    return { delivered: false, reason: "transfer_failed" };
  }
}

// ── Payment Verification ──────────────────────────────────────────────────────

/** Normalized view of a confirmed payment, read from algod OR the indexer. */
interface ConfirmedPaymentFields {
  type:             string;            // "pay" for a payment txn
  sender:           string;            // payer address
  receiver:         string | undefined;
  amountMicroAlgo:  number;
  closeRemainderTo: string | undefined;
  rekeyTo:          string | undefined;
}

/** Stringify an algod `Address` object | plain string | undefined uniformly. */
function addrToString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof (value as { toString?: () => string }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return undefined;
}

/**
 * Read a CONFIRMED payment straight from algod (HARD RULE #2 — finality via
 * algod, never the indexer, which lags and caused false paid-but-no-land 402s).
 * algod retains a just-confirmed txn for a short window; returns `null` when the
 * txn is no longer in that window (the caller then falls back to the indexer for
 * older txns, where lag can no longer matter). Throws if the txn exists in the
 * pool but is not yet confirmed ("posted too early").
 *
 * algod's pending-txn shape differs from the indexer: nested under `txn.txn`,
 * with `Address` OBJECTS for sender/receiver (not strings) — see the
 * algosdk-v3-indexer-shape auditor note.
 */
async function readConfirmedPaymentFromAlgod(txId: string): Promise<ConfirmedPaymentFields | null> {
  const algod = getAlgodClient();

  let pending: any;
  try {
    pending = await algod.pendingTransactionInformation(txId).do();
  } catch {
    return null; // flushed from algod's window (404) — defer to the indexer fallback
  }

  const confirmedRound = Number(pending?.confirmedRound ?? 0);
  if (!confirmedRound || confirmedRound <= 0) {
    // In the pool but not yet committed. The indexer cannot help (it only holds
    // confirmed txns), so this is terminal for this attempt — the client retries.
    throw new Error(`[chain/commander] Payment txn ${txId} is not yet confirmed on-chain`);
  }

  const t = pending?.txn?.txn;
  if (!t) throw new Error(`[chain/commander] Malformed algod pending-txn response for txId=${txId}`);

  return {
    type:             String(t.type ?? ""),
    sender:           addrToString(t.sender) ?? "",
    receiver:         addrToString(t.payment?.receiver),
    amountMicroAlgo:  Number(t.payment?.amount ?? 0),
    closeRemainderTo: addrToString(t.payment?.closeRemainderTo),
    rekeyTo:          addrToString(t.rekeyTo),
  };
}

/**
 * Indexer fallback for txns already flushed from algod's window. Only reached
 * for OLD txns, so indexer lag is a non-issue here. Indexer `.do()` returns
 * typed camelCase instances with STRING sender/receiver (algosdk-v3-indexer-shape).
 */
async function readConfirmedPaymentFromIndexer(txId: string): Promise<ConfirmedPaymentFields> {
  const indexer = getIndexerClient();

  let info: any;
  try {
    info = await indexer.lookupTransactionByID(txId).do();
  } catch {
    throw new Error(`[chain/commander] Payment txn not found (algod + indexer): ${txId}`);
  }

  const txn = info?.transaction ?? info;
  if (!txn) throw new Error(`[chain/commander] Empty txn response for txId=${txId}`);

  const confirmedRound = Number(txn.confirmedRound ?? 0);
  if (!confirmedRound || confirmedRound <= 0) {
    throw new Error(`[chain/commander] Payment txn ${txId} is not yet confirmed on-chain`);
  }

  const pay = txn.paymentTransaction ?? {};
  return {
    type:             String(txn.txType ?? ""),
    sender:           addrToString(txn.sender) ?? "",
    receiver:         addrToString(pay.receiver),
    amountMicroAlgo:  Number(pay.amount ?? 0),
    closeRemainderTo: addrToString(pay.closeRemainderTo),
    rekeyTo:          addrToString(txn.rekeyTo),
  };
}

/**
 * Verify an ALGO payment is final, addressed to the admin wallet, and ≥ the
 * server-derived price. Returns the amount (microAlgo) if valid, throws otherwise.
 *
 * Finality is confirmed via ALGOD (HARD RULE #2); the indexer is only a fallback
 * for older txns. Does NOT enforce single-use — callers consume the txid via
 * payment-dedup (HARD RULE #3) after this returns.
 *
 * Checks: confirmed on-chain · type === "pay" · sender === expectedSender ·
 * receiver === admin · no closeRemainderTo/rekeyTo rider · amount >= minMicroAlgo.
 */
export async function verifyAlgoPayment(params: {
  txId:            string;
  expectedSender:  string;
  minMicroAlgo:    number;
}): Promise<{ amountMicroAlgo: number }> {
  const { txId, expectedSender, minMicroAlgo } = params;
  const adminAddr = getAdminAddress();

  const fields =
    (await readConfirmedPaymentFromAlgod(txId)) ?? (await readConfirmedPaymentFromIndexer(txId));

  if (fields.type !== "pay") {
    throw new Error(`[chain/commander] txn ${txId} is not a payment txn (type=${fields.type})`);
  }
  if (fields.sender !== expectedSender) {
    throw new Error(`[chain/commander] Payment sender mismatch: got ${fields.sender}, expected ${expectedSender}`);
  }
  if (fields.receiver !== adminAddr) {
    throw new Error(`[chain/commander] Payment receiver mismatch: got ${fields.receiver}, expected admin ${adminAddr}`);
  }
  // Reject balance-draining / account-hijack riders on the inbound payment.
  if (fields.closeRemainderTo) {
    throw new Error(`[chain/commander] Payment txn ${txId} carries a closeRemainderTo — rejected`);
  }
  if (fields.rekeyTo) {
    throw new Error(`[chain/commander] Payment txn ${txId} carries a rekeyTo — rejected`);
  }
  if (fields.amountMicroAlgo < minMicroAlgo) {
    throw new Error(
      `[chain/commander] Insufficient payment: got ${fields.amountMicroAlgo} microAlgo, required ${minMicroAlgo}`
    );
  }

  return { amountMicroAlgo: fields.amountMicroAlgo };
}
