/**
 * server/services/chain/weapon.ts
 *
 * FRONTIER Weapon NFT (ASA) mint + transfer service. Mirrors commander.ts exactly:
 * custodian model (admin holds the 1-of-1 ASA after minting; buyer opts in then
 * calls deliver). On mainnet freeze/clawback are unset → freely tradeable.
 *
 * No UI imports, no route logic, no game state. Idempotency is the caller's
 * responsibility (check the DB / weapon profile before minting).
 */

import algosdk from "algosdk";
import { getAlgodClient, getAdminAccount, getNetwork } from "./client";
import { attemptNftDelivery } from "./delivery";
import type { AssetId, MintResult } from "./types";
import { getWeapon } from "@shared/weapons";

export interface MintWeaponParams {
  /** OwnedWeapon.id (instance id). */
  ownedWeaponId: string;
  /** Catalog spec id (e.g. "msl_ballistic_2"). */
  specId: string;
  receiverAddress: string;
  /** PUBLIC_BASE_URL — baked permanently into the on-chain ASA. */
  metadataBaseUrl: string;
}

export interface TransferWeaponParams {
  assetId: AssetId;
  toAddress: string;
  note?: string;
}

/** Mint a FRONTIER Weapon NFT (1-of-1 Algorand ASA), held in admin custody. */
export async function mintWeaponNft(params: MintWeaponParams): Promise<MintResult> {
  const { ownedWeaponId, specId, receiverAddress, metadataBaseUrl } = params;
  const spec = getWeapon(specId);
  if (!spec) throw new Error(`[chain/weapon] unknown weapon spec ${specId}`);

  const algod = getAlgodClient();
  const account = getAdminAccount();
  const network = getNetwork();

  const baseUrl = metadataBaseUrl.replace(/\/+$/, "");
  const shortId = ownedWeaponId.slice(0, 8);
  // Algorand ASA name limit is 32 bytes. Keep the category token short + uppercase.
  const catToken = spec.category.replace(/_/g, "").slice(0, 10).toUpperCase();
  const assetName = `FRONTIER ${catToken} #${shortId}`.slice(0, 32);

  const createSp = await algod.getTransactionParams().do();
  const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: account.addr.toString(),
    total: BigInt(1),
    decimals: 0,
    defaultFrozen: false,
    unitName: "WPN",
    assetName,
    assetURL: `${baseUrl}/nft/metadata/weapon/${ownedWeaponId}#arc3`,
    manager: account.addr.toString(),
    reserve: account.addr.toString(),
    freeze: network === "mainnet" ? undefined : account.addr.toString(),
    clawback: network === "mainnet" ? undefined : account.addr.toString(),
    suggestedParams: createSp,
    note: new TextEncoder().encode(`FRONTIER Weapon NFT ${specId} #${shortId} - ${network}`),
  });

  const signedCreate = createTxn.signTxn(account.sk);
  const createResponse = await algod.sendRawTransaction(signedCreate).do();
  const createTxId = createResponse.txid || createTxn.txID();

  const confirmedCreate = await algosdk.waitForConfirmation(algod, createTxId, 2);
  const assetId: AssetId = Number(
    (confirmedCreate as any).assetIndex ?? (confirmedCreate as any)["asset-index"],
  );
  if (!assetId) {
    throw new Error(
      `[chain/weapon] mintWeaponNft: no assetIndex in confirmed create tx ${createTxId} for ownedWeaponId=${ownedWeaponId}`,
    );
  }

  console.log(
    `[chain/weapon] ownedWeaponId=${ownedWeaponId} spec=${specId} ASA created assetId=${assetId} txId=${createTxId}` +
      ` | custody: admin holds until buyer opts in (receiverAddress=${receiverAddress})`,
  );

  return {
    assetId,
    createTxId,
    transferTxId: undefined,
    custodyHeld: true,
    mintedToAddress: account.addr.toString(),
  };
}

/** Transfer an already-minted Weapon NFT from admin to a receiver (must be opted in). */
export async function transferWeaponNft(params: TransferWeaponParams): Promise<{ txId: string }> {
  const { assetId, toAddress, note } = params;
  const algod = getAlgodClient();
  const account = getAdminAccount();
  const sp = await algod.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr.toString(),
    receiver: toAddress,
    amount: 1,
    assetIndex: assetId,
    suggestedParams: sp,
    note: new TextEncoder().encode(note ?? `FRONTIER Weapon NFT transfer to ${toAddress}`),
  });

  const signed = txn.signTxn(account.sk);
  const response = await algod.sendRawTransaction(signed).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algod, txId, 2);

  console.log(`[chain/weapon] Transferred assetId=${assetId} to ${toAddress} txId=${txId}`);
  return { txId };
}

/** Attempt delivery of a custody-held Weapon NFT (checks opt-in first; idempotent). */
export async function attemptWeaponDelivery(
  assetId: AssetId,
  toAddress: string,
  ownedWeaponId: string,
): Promise<{ delivered: boolean; reason?: string }> {
  return attemptNftDelivery(assetId, toAddress, {
    transfer: () => transferWeaponNft({ assetId, toAddress, note: `FRONTIER Weapon NFT ${ownedWeaponId} delivery` }),
    label: `[chain/weapon] attemptWeaponDelivery failed ownedWeaponId=${ownedWeaponId}`,
  });
}
