// ---------------------------------------------------------------------------
// On-chain claim (Algorand TESTNET).
//
// At the end of the prologue the player can commit the run's ledger to
// Algorand: each recorded action becomes a 0-ALGO self-payment transaction
// carrying the event in its note field, all signed in one Pera Wallet popup as
// a single atomic group. This proves the "your actions live on-chain" promise
// with zero real-funds risk — it is testnet-only and never moves value.
//
// Network is testnet by default and overridable at build time:
//   VITE_ALGORAND_NETWORK (label only) · VITE_ALGOD_URL · VITE_ALGOD_TOKEN
// ---------------------------------------------------------------------------

import algosdk from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";
import type { OnchainEvent } from "../../store/types";
import type { JourneyCard } from "../journeyCard";
import { journeyAssetParams } from "./journeyAsset";

export { explorerAssetUrl } from "./journeyAsset";

// Algorand TestNet chain id (genesis "testnet-v1.0"). Pera scopes its session
// to this network so the wallet signs against testnet, not mainnet.
const TESTNET_CHAIN_ID = 416002;

const ALGOD_URL =
  (import.meta.env.VITE_ALGOD_URL as string | undefined) ??
  "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = (import.meta.env.VITE_ALGOD_TOKEN as string | undefined) ?? "";

/** Human-readable network label for the UI (e.g. "testnet"). */
export const NETWORK_LABEL =
  (import.meta.env.VITE_ALGORAND_NETWORK as string | undefined) ?? "testnet";

export const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "");

// Algorand caps an atomic group at 16 transactions; the prologue ledger is far
// smaller (≤ ~8), but guard anyway so a longer run still signs cleanly.
const MAX_GROUP = 16;

// One Pera connector for the app. Pera scopes the WalletConnect session to
// testnet via chainId so signatures can never land on mainnet from here.
let pera: PeraWalletConnect | null = null;

function getPera(): PeraWalletConnect {
  if (!pera) pera = new PeraWalletConnect({ chainId: TESTNET_CHAIN_ID });
  return pera;
}

export interface ClaimResult {
  /** Confirmed transaction ids, in ledger order. */
  txIds: string[];
  /** Round the first transaction confirmed in. */
  confirmedRound: number | null;
}

/** A friendlier error so the UI can explain *why* a claim failed. */
export class ClaimError extends Error {
  constructor(
    message: string,
    /** True when the user dismissed the wallet — not a real failure. */
    readonly cancelled = false,
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

function looksCancelled(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("cancel") ||
    m.includes("reject") ||
    m.includes("denied") ||
    m.includes("closed") ||
    m.includes("dismiss")
  );
}

/**
 * Connect Pera Wallet (testnet), returning the chosen address. Reuses an
 * existing session when one is present so reloads don't re-prompt.
 */
export async function connectWallet(): Promise<string> {
  const p = getPera();
  try {
    // Reuse a live session first; fall back to a fresh connect.
    let accounts: string[] = [];
    try {
      accounts = await p.reconnectSession();
    } catch {
      accounts = [];
    }
    if (!accounts || accounts.length === 0) {
      accounts = await p.connect();
    }
    const address = accounts[0];
    if (!address) throw new ClaimError("No account returned from the wallet.");
    return address;
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    throw new ClaimError(
      looksCancelled(msg) ? "Wallet connection cancelled." : msg,
      looksCancelled(msg),
    );
  }
}

/** Tear down the Pera session (used by "disconnect"). */
export async function disconnectWallet(): Promise<void> {
  try {
    await getPera().disconnect();
  } catch {
    /* best-effort */
  }
}

/** Re-attach a `disconnect` listener so UI state can reset if Pera drops. */
export function onWalletDisconnect(handler: () => void): void {
  const p = getPera();
  p.connector?.on("disconnect", handler);
}

/** TestNet ALGO balance for an address (whole ALGO), best-effort. */
export async function getBalanceAlgo(address: string): Promise<number> {
  try {
    const info = await algod.accountInformation(address).do();
    return Number(info.amount) / 1_000_000;
  } catch {
    return 0;
  }
}

/** Compact, 1KB-safe note payload for a single ledger event. */
function encodeNote(ev: OnchainEvent): Uint8Array {
  const data = JSON.stringify({
    app: "AETHER",
    v: 1,
    seq: ev.seq,
    kind: ev.kind,
    label: ev.label,
    ts: ev.ts,
    net: NETWORK_LABEL,
  });
  // Stay comfortably under Algorand's 1024-byte note cap.
  return new TextEncoder().encode(`AETHER:${data}`.slice(0, 1000));
}

/**
 * Commit the run's ledger to Algorand testnet. Builds one 0-ALGO self-payment
 * per event, groups them atomically, signs the whole group in a single Pera
 * popup, submits, and waits for confirmation.
 *
 * @throws ClaimError (with `cancelled` set when the user dismissed the wallet).
 */
export async function claimLedgerOnChain(
  address: string,
  events: OnchainEvent[],
): Promise<ClaimResult> {
  if (events.length === 0) throw new ClaimError("Nothing to commit.");

  const p = getPera();
  const suggestedParams = await algod.getTransactionParams().do();

  // One self-payment (sender === receiver, amount 0) per ledger event. These
  // never move value; they only stamp the action's note onto the chain.
  const txns = events
    .slice(0, MAX_GROUP)
    .map((ev) =>
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: address,
        receiver: address,
        amount: 0,
        note: encodeNote(ev),
        suggestedParams,
      }),
    );

  if (txns.length > 1) algosdk.assignGroupID(txns);

  let signed: Uint8Array[];
  try {
    // Pera takes an array of groups; we sign exactly one group.
    signed = await p.signTransaction([txns.map((txn) => ({ txn }))]);
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    throw new ClaimError(
      looksCancelled(msg) ? "Signature cancelled in the wallet." : msg,
      looksCancelled(msg),
    );
  }

  let confirmedRound: number | null = null;
  try {
    const { txid } = await algod.sendRawTransaction(signed).do();
    const status = await algosdk.waitForConfirmation(algod, txid, 6);
    // algosdk v3 exposes `confirmedRound` (bigint); guard the legacy key too.
    const s = status as unknown as {
      confirmedRound?: bigint | number;
      "confirmed-round"?: number;
    };
    const round = s.confirmedRound ?? s["confirmed-round"];
    confirmedRound = round != null ? Number(round) : null;
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    // The most common real-world cause on a fresh wallet: no testnet ALGO for fees.
    const hint = /overspend|balance|insufficient|below min/i.test(msg)
      ? " — this wallet may need testnet ALGO (fund it from the Algorand testnet dispenser) to cover transaction fees."
      : "";
    throw new ClaimError(`Submission failed: ${msg}${hint}`);
  }

  // txID() is deterministic from the (now group-stamped) txn objects.
  const txIds = txns.map((t) => t.txID());
  return { txIds, confirmedRound };
}

export interface MintResult {
  assetId: number;
  txId: string;
  confirmedRound: number | null;
}

/**
 * Mint the player's finished run as an ARC-69 NFT (ASA) on Algorand TestNet,
 * created and owned by the connected wallet — a real, self-custodial NFT of their
 * journey. total=1, decimals=0; the card identity rides in the ARC-69 note. The
 * player signs in Pera and pays the trivial TestNet fee; no server key involved.
 *
 * @throws ClaimError (with `cancelled` set when the user dismissed the wallet).
 */
export async function mintJourneyNft(address: string, card: JourneyCard): Promise<MintResult> {
  const p = getPera();
  const suggestedParams = await algod.getTransactionParams().do();
  const { assetName, unitName, url, note } = journeyAssetParams(card);

  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: address,
    total: 1,
    decimals: 0,
    defaultFrozen: false,
    assetName,
    unitName,
    assetURL: url,
    manager: address,
    reserve: address,
    note: new TextEncoder().encode(note),
    suggestedParams,
  });

  let signed: Uint8Array[];
  try {
    signed = await p.signTransaction([[{ txn }]]);
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    throw new ClaimError(
      looksCancelled(msg) ? "Mint cancelled in the wallet." : msg,
      looksCancelled(msg),
    );
  }

  try {
    const { txid } = await algod.sendRawTransaction(signed).do();
    const status = await algosdk.waitForConfirmation(algod, txid, 6);
    const s = status as unknown as {
      assetIndex?: bigint | number;
      "asset-index"?: number;
      confirmedRound?: bigint | number;
      "confirmed-round"?: number;
    };
    const assetId = Number(s.assetIndex ?? s["asset-index"] ?? 0);
    if (!assetId) throw new ClaimError("Mint confirmed but no asset id was returned.");
    const round = s.confirmedRound ?? s["confirmed-round"];
    return { assetId, txId: txn.txID(), confirmedRound: round != null ? Number(round) : null };
  } catch (err) {
    if (err instanceof ClaimError) throw err;
    const msg = (err as Error)?.message || String(err);
    const hint = /overspend|balance|insufficient|below min/i.test(msg)
      ? " — this wallet needs a little testnet ALGO (≈0.2) to mint. Fund it free from the Algorand testnet dispenser."
      : "";
    throw new ClaimError(`Mint failed: ${msg}${hint}`);
  }
}
