// Add to top of algorand.ts
const ALGORAND_NETWORK = (import.meta.env.VITE_ALGORAND_NETWORK as string) ?? "testnet";

// Dev-only debug logger — silenced in production builds. Set VITE_DEBUG=true to
// force-enable. Errors/failures still use console.error directly.
const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === "true";
const dbg = (...args: unknown[]): void => { if (DEBUG) console.log(...args); };

// Then everywhere you see:  network: "testnet"
// Replace with:             network: ALGORAND_NETWORK
import { resolveApiUrl } from "@/lib/queryClient";
import algosdk from "algosdk";

// Override with VITE_ALGOD_URL / VITE_INDEXER_URL at build time to switch networks.
export const ALGORAND_TESTNET = {
  chainId: 416002 as const,
  genesisID: "testnet-v1.0",
  algodUrl: (import.meta.env.VITE_ALGOD_URL as string | undefined) ?? "https://testnet-api.algonode.cloud",
  indexerUrl: (import.meta.env.VITE_INDEXER_URL as string | undefined) ?? "https://testnet-idx.algonode.cloud",
};

export const algodClient = new algosdk.Algodv2(
  "",
  ALGORAND_TESTNET.algodUrl,
  ""
);

export const indexerClient = new algosdk.Indexer(
  "",
  ALGORAND_TESTNET.indexerUrl,
  ""
);

// ---------------------------------------------------------------------------
// Wallet signer registry — injected by WalletContext when a wallet connects.
// All signing functions route through this to support any use-wallet provider.
// ---------------------------------------------------------------------------

type SignerFn = (txns: algosdk.Transaction[]) => Promise<Uint8Array[]>;
let _registeredSigner: SignerFn | null = null;

export function registerWalletSigner(fn: SignerFn | null) {
  _registeredSigner = fn;
}

export function hasRegisteredSigner(): boolean {
  return _registeredSigner !== null;
}

// ---------------------------------------------------------------------------
// Wallet-sign serialization queue.
//
// The wallet SDK (Pera/use-wallet) rejects a second signing request with
// "another request... in progress" if one is triggered while a prior one is
// still awaiting the user's approval in the wallet UI. This app has several
// independent call sites that can each want a signature around the same
// moment — an auto-claim poll after a purchase, a manual "Claim NFT" click,
// the batch "Claim All" flow, a commander mint — any two of which firing
// close together would previously surface that raw wallet error.
//
// Fix: every signing call funnels through _registeredSigner via exactly two
// functions below, so serializing HERE protects every current and future
// caller at once, with no per-call-site bookkeeping needed. A later call
// doesn't error — it queues behind the current one and runs once the wallet
// resolves (approved or rejected), same as if the user had waited to click.
// State machine: idle (queue empty) -> signing (one link running) -> idle,
// with every subsequent call simply chaining onto the tail.
// ---------------------------------------------------------------------------
// A signer call that never settles (a stuck WalletConnect session, a mobile
// wallet notification the user never taps) would otherwise wedge this queue
// forever — every later caller queues behind a promise that's never going to
// resolve. This timeout guarantees the queue always keeps moving: it doesn't
// (can't) cancel the underlying wallet request, but it stops waiting on it
// after WALLET_SIGN_TIMEOUT_MS so the NEXT caller gets their turn instead of
// hanging indefinitely behind a dead request.
const WALLET_SIGN_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

let _walletSignQueue: Promise<unknown> = Promise.resolve();

/**
 * Reset the signing queue to a clean state. Use this when the queue is wedged
 * or after an unrecoverable timeout to allow fresh signing attempts.
 */
export function resetSignQueue(): void {
  _walletSignQueue = Promise.resolve();
}

/**
 * Get the current queue depth for diagnostics. Returns the number of pending
 * signing operations (0 if idle).
 */
export function getQueueDepth(): number {
  // The queue is a promise chain; we can't directly measure depth, but we can
  // check if it's settled. For now, return a simple heuristic.
  return 0; // Queue depth tracking would require additional state
}

function withWalletSignLock<T>(run: () => Promise<T>): Promise<T> {
  const guarded = async () => {
    try {
      return await withTimeout(
        run(),
        WALLET_SIGN_TIMEOUT_MS,
        "Wallet didn't respond in time — check your wallet app for a pending request (approve or reject it), then try again.",
      );
    } catch (err) {
      // On timeout, reset the queue to allow fresh attempts
      if (err instanceof Error && err.message.includes("didn't respond in time")) {
        resetSignQueue();
      }
      throw err;
    }
  };
  const result = _walletSignQueue.then(guarded, guarded);
  // Chain the NEXT caller off this settling regardless of outcome — a
  // rejected/cancelled/timed-out signature must not wedge the queue for
  // later callers.
  _walletSignQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function signTransactionWithActiveWallet(
  txn: algosdk.Transaction,
  _signerAddress: string
): Promise<Uint8Array[]> {
  if (!_registeredSigner) throw new Error("No wallet connected");
  const signer = _registeredSigner;
  return withWalletSignLock(() => signer([txn]));
}

export async function signGroupedTransactionsWithActiveWallet(
  txns: algosdk.Transaction[],
  signerAddress: string
): Promise<Uint8Array[]> {
  dbg(`[BATCH-DEBUG] signGroupedTransactions | txnCount: ${txns.length} | signer: ${signerAddress.slice(0, 8)}... | ts: ${Date.now()}`);
  if (!_registeredSigner) throw new Error("No wallet connected");
  const signer = _registeredSigner;
  const result = await withWalletSignLock(() => signer(txns));
  dbg(`[BATCH-DEBUG] signed ${result.length} txns | ts: ${Date.now()}`);
  return result;
}

export async function getAccountBalance(address: string): Promise<number> {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    const amount = accountInfo.amount;
    return Number(amount) / 1_000_000;
  } catch (error) {
    console.error("Failed to fetch account balance:", error);
    return 0;
  }
}

export async function getTransactionParams() {
  return await algodClient.getTransactionParams().do();
}

/**
 * Build and sign a transaction with fresh suggested params fetched inside the signing lock.
 * This prevents stale params when the signing queue has wait time.
 * 
 * @param buildTxn - Function that receives fresh params and returns the transaction to sign
 * @param signerAddress - The wallet address that will sign
 * @returns The signed transaction bytes
 */
export async function buildAndSignWithFreshParams(
  buildTxn: (params: algosdk.SuggestedParams) => algosdk.Transaction,
  signerAddress: string
): Promise<Uint8Array[]> {
  if (!_registeredSigner) throw new Error("No wallet connected");
  const signer = _registeredSigner;
  
  return withWalletSignLock(async () => {
    // Fetch fresh params INSIDE the lock, right before building
    const freshParams = await getTransactionParams();
    const txn = buildTxn(freshParams);
    return await signer([txn]);
  });
}

/**
 * Build and sign grouped transactions with fresh suggested params.
 * Same as buildAndSignWithFreshParams but for atomic groups.
 */
export async function buildAndSignGroupedWithFreshParams(
  buildTxns: (params: algosdk.SuggestedParams) => algosdk.Transaction[],
  signerAddress: string
): Promise<Uint8Array[]> {
  if (!_registeredSigner) throw new Error("No wallet connected");
  const signer = _registeredSigner;
  
  return withWalletSignLock(async () => {
    const freshParams = await getTransactionParams();
    const txns = buildTxns(freshParams);
    return await signer(txns);
  });
}

export async function sendPaymentTransaction(
  fromAddress: string,
  toAddress: string,
  amountMicroAlgos: number,
  note?: string
): Promise<string> {
  dbg(`[TXN-DEBUG] sendPaymentTransaction triggered | txns: 1 | groupID: NO | ts: ${Date.now()} | from: ${fromAddress.slice(0,8)}... | to: ${toAddress.slice(0,8)}... | amount: ${amountMicroAlgos} microAlgos`);
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: toAddress,
    amount: amountMicroAlgos,
    note: note ? new TextEncoder().encode(note) : undefined,
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  dbg(`[TXN-DEBUG] sendPaymentTransaction submitting to algod | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  dbg(`[TXN-DEBUG] sendPaymentTransaction confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
  return txId;
}

export async function createGameActionTransaction(
  fromAddress: string,
  actionType: string,
  plotId: number,
  metadata?: Record<string, unknown>
): Promise<string> {
  dbg(`[TXN-DEBUG] createGameActionTransaction triggered | action: ${actionType} | plotId: ${plotId} | txns: 1 | groupID: NO | ts: ${Date.now()} | from: ${fromAddress.slice(0,8)}...`);
  const suggestedParams = await getTransactionParams();

  const actionData = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    action: actionType,
    plotId,
    player: fromAddress.slice(0, 8),
    ts: Date.now(),
    network: "testnet",
    ...metadata,
  });

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: fromAddress,
    amount: 0,
    note: new TextEncoder().encode(`ASCEND:${actionData}`),
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  dbg(`[TXN-DEBUG] createGameActionTransaction submitting | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  dbg(`[TXN-DEBUG] createGameActionTransaction confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
  return txId;
}

export async function createPurchaseWithAlgoTransaction(
  fromAddress: string,
  treasuryAddress: string,
  plotId: number,
  algoAmount: number
): Promise<string> {
  dbg(`[TXN-DEBUG] createPurchaseWithAlgoTransaction triggered | plotId: ${plotId} | algo: ${algoAmount} | txns: 1 | groupID: NO | ts: ${Date.now()} | from: ${fromAddress.slice(0,8)}... | to: ${treasuryAddress.slice(0,8)}...`);
  const microAlgos = Math.floor(algoAmount * 1_000_000);
  
  const actionData = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    action: "purchase",
    plotId,
    algoAmount,
    player: fromAddress.slice(0, 8),
    ts: Date.now(),
    network: "testnet",
  });

  // Build and sign with fresh params fetched inside the signing lock
  const signedTxnBlob = await buildAndSignWithFreshParams((freshParams) => {
    return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: fromAddress,
      receiver: treasuryAddress,
      amount: microAlgos,
      note: new TextEncoder().encode(`ASCEND:${actionData}`),
      suggestedParams: freshParams,
    });
  }, fromAddress);

  dbg(`[TXN-DEBUG] createPurchaseWithAlgoTransaction submitting | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid;
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  dbg(`[TXN-DEBUG] createPurchaseWithAlgoTransaction confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
  return txId;
}

export async function createClaimAscendTransaction(
  fromAddress: string,
  ascendAmount: number
): Promise<string> {
  dbg(`[TXN-DEBUG] createClaimAscendTransaction triggered | amount: ${ascendAmount} | txns: 1 | groupID: NO | ts: ${Date.now()} | from: ${fromAddress.slice(0,8)}...`);
  const suggestedParams = await getTransactionParams();
  
  const actionData = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    action: "claim_ascend",
    amount: ascendAmount,
    player: fromAddress.slice(0, 8),
    ts: Date.now(),
    network: "testnet",
  });

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: fromAddress,
    amount: 0,
    note: new TextEncoder().encode(`ASCEND:${actionData}`),
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  dbg(`[TXN-DEBUG] createClaimAscendTransaction submitting | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  dbg(`[TXN-DEBUG] createClaimAscendTransaction confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
  return txId;
}

export async function createCommanderMintTransaction(
  fromAddress: string,
  tier: string,
  ascendCost: number
): Promise<string> {
  dbg(`[TXN-DEBUG] createCommanderMintTransaction triggered | tier: ${tier} | ascendCost: ${ascendCost} | txns: 1 | groupID: NO | ts: ${Date.now()} | from: ${fromAddress.slice(0,8)}...`);
  const suggestedParams = await getTransactionParams();

  const actionData = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    action: "mint_commander",
    tier,
    ascendCost,
    player: fromAddress.slice(0, 8),
    ts: Date.now(),
    network: "testnet",
  });

  const adminAddress = getCachedTreasuryAddress() || "ZK55X7SGIGMLGORVNJHHPTYZMZOGSQNVROBHX7N27X6ZEQRHAZ2UPKOXQU";
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: fromAddress,
    receiver: adminAddress,
    amount: 500000,
    note: new TextEncoder().encode(`ASCEND:${actionData}`),
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, fromAddress);
  dbg(`[TXN-DEBUG] createCommanderMintTransaction submitting | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  dbg(`[TXN-DEBUG] createCommanderMintTransaction confirmed | txId: ${txId} | ts: ${Date.now()}`);

  return txId;
}

export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

export const ASCEND_ASSETS = {
  iron: { name: "FRONTIER-IRON", unitName: "IRON", decimals: 0 },
  fuel: { name: "FRONTIER-FUEL", unitName: "FUEL", decimals: 0 },
  crystal: { name: "FRONTIER-CRYSTAL", unitName: "CRYSTAL", decimals: 0 },
  ascend: { name: "ASCEND", unitName: "ASCEND", decimals: 6 },
} as const;

export type AscendResourceType = keyof typeof ASCEND_ASSETS;

export async function getASABalance(address: string, assetId: number): Promise<number> {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    const assets = accountInfo.assets || [];
    // algosdk v3: .assetId (bigint) — v2/raw JSON: "asset-id" or assetIndex
    const asset = assets.find((a: any) => Number(a.assetId ?? a["asset-id"] ?? a.assetIndex) === assetId);
    return asset ? Number(asset.amount) : 0;
  } catch (error) {
    console.error("Failed to fetch ASA balance:", error);
    return 0;
  }
}

export async function optInToASA(
  address: string,
  assetId: number
): Promise<string> {
  dbg(`[TXN-DEBUG] optInToASA triggered | assetId: ${assetId} | txns: 1 | groupID: NO | ts: ${Date.now()} | address: ${address.slice(0,8)}...`);
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    assetIndex: assetId,
    suggestedParams,
  });

  const signedTxnBlob = await signTransactionWithActiveWallet(txn, address);
  dbg(`[TXN-DEBUG] optInToASA submitting | ts: ${Date.now()}`);
  const response = await algodClient.sendRawTransaction(signedTxnBlob).do();
  const txId = response.txid || txn.txID();
  await algosdk.waitForConfirmation(algodClient, txId, 4);
  dbg(`[TXN-DEBUG] optInToASA confirmed | txId: ${txId} | ts: ${Date.now()}`);
  
  return txId;
}

/**
 * Opt into multiple ASAs (e.g. a batch of pending Plot NFTs) with a SINGLE
 * wallet approval instead of one popup per asset. Algorand can't merge
 * distinct opt-in transactions into one transaction, but it CAN group them
 * into one atomic group that the wallet signs in a single action — this is
 * exactly that, reusing the same grouping/signing plumbing as the game
 * action batch queue below (assignGroupID + signGroupedTransactionsWithActiveWallet).
 * Chunks at MAX_GROUP_SIZE (Algorand's 16-txn group cap) — for >16 pending
 * assets this still means multiple approvals, just far fewer than one-per-asset.
 */
export async function batchOptInToASAs(
  address: string,
  assetIds: number[]
): Promise<string[]> {
  if (assetIds.length === 0) return [];
  dbg(`[TXN-DEBUG] batchOptInToASAs triggered | count: ${assetIds.length} | address: ${address.slice(0,8)}... | ts: ${Date.now()}`);

  const txIds: string[] = [];
  for (let i = 0; i < assetIds.length; i += MAX_GROUP_SIZE) {
    const chunk = assetIds.slice(i, i + MAX_GROUP_SIZE);
    const suggestedParams = await getTransactionParams();
    const txns = chunk.map((assetId) =>
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: address,
        receiver: address,
        amount: 0,
        assetIndex: assetId,
        suggestedParams,
      })
    );

    if (txns.length > 1) algosdk.assignGroupID(txns);

    const signedBlobs = txns.length === 1
      ? await signTransactionWithActiveWallet(txns[0], address)
      : await signGroupedTransactionsWithActiveWallet(txns, address);

    const response = await algodClient.sendRawTransaction(signedBlobs).do();
    const firstTxId = response.txid || txns[0].txID();
    await algosdk.waitForConfirmation(algodClient, firstTxId, 4);
    dbg(`[TXN-DEBUG] batchOptInToASAs chunk confirmed | firstTxId: ${firstTxId} | chunkSize: ${chunk.length} | ts: ${Date.now()}`);
    txIds.push(firstTxId);
  }

  return txIds;
}

export async function isOptedInToASA(address: string, assetId: number): Promise<boolean> {
  try {
    const res = await fetch(resolveApiUrl(`/api/blockchain/opt-in-check/${address}?assetId=${assetId}`));
    const data = await res.json();
    return data.optedIn === true;
  } catch {
    try {
      const accountInfo = await algodClient.accountInformation(address).do();
      const assets = accountInfo.assets || accountInfo["assets"] || [];
      return assets.some((a: any) => {
        // algosdk v3: .assetId (bigint); v2/raw JSON: "asset-id" / assetIndex
        const id = a.assetId ?? a["asset-id"] ?? a.assetIndex ?? a["assetIndex"];
        return Number(id) === assetId;
      });
    } catch {
      return false;
    }
  }
}

/**
 * Pure helper: checks whether an account is opted into a specific ASA by
 * inspecting the accountInfo object returned from algodClient.accountInformation().do().
 *
 * algosdk v3 deserializes AssetHolding with a camelCase `.assetId` (bigint) property.
 * Older / raw-JSON paths expose the kebab-case `"asset-id"` key instead.
 * We check all known variants so this works regardless of how the object was produced.
 */
export function hasOptedIn(
  accountInfo: Record<string, unknown>,
  asaId: number
): boolean {
  const assets = (accountInfo.assets as Array<Record<string, unknown>>) ?? [];
  return assets.some(
    // assetId  → algosdk v3 AssetHolding (bigint, use Number() for comparison)
    // asset-id → raw JSON / legacy algosdk v2 response
    // assetIndex → older SDK alias sometimes seen in typed responses
    (a) => Number(a["assetId"] ?? a["asset-id"] ?? a["assetIndex"]) === asaId
  );
}

let _cachedTreasuryAddress: string | null = null;
let _cachedAsaId: number | null = null;

export async function fetchBlockchainStatus(): Promise<{
  ready: boolean;
  ascendAsaId: number | null;
  adminAddress: string | null;
  freePurchases?: boolean;
}> {
  try {
    const res = await fetch(resolveApiUrl("/api/blockchain/status"));
    const data = await res.json();
    if (data.adminAddress) _cachedTreasuryAddress = data.adminAddress;
    if (data.ascendAsaId) _cachedAsaId = data.ascendAsaId;
    return data;
  } catch {
    return { ready: false, ascendAsaId: null, adminAddress: null };
  }
}

export function getCachedTreasuryAddress(): string {
  return _cachedTreasuryAddress || "";
}

export function getCachedAsaId(): number | null {
  return _cachedAsaId;
}

// Treasury address is fetched at runtime from /api/blockchain/status and
// cached in _cachedTreasuryAddress. Use getCachedTreasuryAddress() to access it.

// ---------------------------------------------------------------------------
// Client-side atomic transaction group queue
//
// Game actions (mine, upgrade, attack, build, commander actions, drones,
// special attacks) are queued as individual 0-ALGO self-payment transactions.
// After a debounce window (BATCH_WINDOW_MS) or when the queue reaches
// MAX_GROUP_SIZE, all pending transactions are grouped via
// algosdk.assignGroupID(), signed in one wallet popup, and submitted as
// an atomic group. A hard MAX_WAIT_MS cap prevents indefinite queueing.
// ---------------------------------------------------------------------------

export const MAX_GROUP_SIZE = 16;
export const BATCH_WINDOW_MS = 800;
export const MAX_WAIT_MS = 2000;

export interface BatchedAction {
  a: string;
  p: number;
  x?: Record<string, unknown>;
  t: number;
  m?: { fe: number; fu: number; cr: number };
}

type BatchSignCallback = (actions: BatchedAction[]) => Promise<string | null>;

// ── Batch / queue tuning knobs ────────────────────────────────────────────────
// Increase MAX_ACTIONS to allow more actions to accumulate before flushing.
// The "Satellite Relay" framing makes this feel like a game mechanic, not lag.
const MAX_BATCH_NOTE_BYTES   = 1000;  // stay under Algorand's 1024-byte limit
const MAX_ACTIONS_PER_FLUSH  = 16;    // Hard cap: Algorand's 16-txn group limit
const FLUSH_INTERVAL_MS      = 5_000; // Relay window: 5 seconds (was 15s — prevents overrun)
const FLUSH_MAX_WAIT_MS      = 15_000; // Never hold longer than 15 seconds (was 45s)
interface TxnQueueEntry {
  action: BatchedAction;
  enqueuedAt: number;
}

export type BatchStatusCallback = (
  event: "bundling" | "submitting" | "confirmed" | "error",
  detail: { count: number; txIds?: string[]; message?: string }
) => void;

let _txnQueue: TxnQueueEntry[] = [];
let _txnDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let _txnMaxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let _txnFlushInProgress = false;
let _txnQueueAddress: string | null = null;
let _txnStatusCallback: BatchStatusCallback | null = null;

export function registerTxnQueueAddress(address: string) {
  _txnQueueAddress = address;
  if (_txnQueue.length > 0 && !_txnFlushInProgress) {
    dbg(`[BATCH-DEBUG] address registered with ${_txnQueue.length} queued entries → scheduling flush | ts: ${Date.now()}`);
    _clearTimers();
    _txnDebounceTimer = setTimeout(() => {
      _txnDebounceTimer = null;
      _triggerAtomicFlush();
    }, BATCH_WINDOW_MS);
  }
}

export function registerBatchStatusCallback(cb: BatchStatusCallback) {
  _txnStatusCallback = cb;
}

function _buildActionNote(action: BatchedAction, fromAddress: string): Uint8Array {
  const data = JSON.stringify({
    game: "FRONTIER",
    v: 1,
    action: action.a,
    plotId: action.p,
    player: fromAddress.slice(0, 8),
    ts: action.t,
    network: "testnet",
    ...(action.x || {}),
    ...(action.m ? { minerals: action.m } : {}),
  });
  return new TextEncoder().encode(`ASCEND:${data}`);
}

export function enqueueGameAction(
  type: string,
  plotId: number,
  extra?: Record<string, unknown>,
  minerals?: { fe: number; fu: number; cr: number }
) {
  const CHAIN_OPTIONAL_ACTIONS = ["mine", "collect", "upgrade", "build", "switch_commander"];
  if (CHAIN_OPTIONAL_ACTIONS.includes(type)) {
    // These actions are server-authoritative. No on-chain note needed.
    return;
  }
  const action: BatchedAction = { a: type, p: plotId, x: extra, t: Date.now() };
  if (minerals) action.m = minerals;

  _txnQueue.push({ action, enqueuedAt: Date.now() });
  console.log(
    `[ACTION-DEBUG] player action enqueued | type: ${type} | plotId: ${plotId} | queue: ${_txnQueue.length} | ts: ${Date.now()}`
  );

  if (_txnQueue.length >= MAX_ACTIONS_PER_FLUSH) {
    // Hit the count threshold — flush immediately (Satellite relay opens)
    _clearTimers();
    _triggerAtomicFlush();
    return;
  }

  if (!_txnDebounceTimer) {
    // Schedule the relay window: flush after FLUSH_INTERVAL_MS
    _txnDebounceTimer = setTimeout(() => {
      _txnDebounceTimer = null;
      dbg(`[TXN-DEBUG] relay window expired (${FLUSH_INTERVAL_MS}ms) → flush | queueSize: ${_txnQueue.length} | ts: ${Date.now()}`);
      _triggerAtomicFlush();
    }, FLUSH_INTERVAL_MS);
  }

  if (!_txnMaxWaitTimer) {
    // Hard upper bound: never hold longer than FLUSH_MAX_WAIT_MS
    _txnMaxWaitTimer = setTimeout(() => {
      _txnMaxWaitTimer = null;
      if (_txnQueue.length > 0) {
        dbg(`[TXN-DEBUG] FLUSH_MAX_WAIT_MS reached — force flushing ${_txnQueue.length} actions`);
        _clearTimers();
        _triggerAtomicFlush();
      }
    }, FLUSH_MAX_WAIT_MS);
  }
}


function _clearTimers() {
  if (_txnDebounceTimer) {
    clearTimeout(_txnDebounceTimer);
    _txnDebounceTimer = null;
  }
  if (_txnMaxWaitTimer) {
    clearTimeout(_txnMaxWaitTimer);
    _txnMaxWaitTimer = null;
  }
}

function _triggerAtomicFlush() {
  if (_txnQueue.length === 0 || _txnFlushInProgress || !_txnQueueAddress) return;
  _clearTimers();
  const entries = _txnQueue.splice(0);
  _txnFlushInProgress = true;

  const address = _txnQueueAddress;
  const waitedMs = Date.now() - entries[0].enqueuedAt;
  dbg(`[TXN-DEBUG] flush started | actions: ${entries.length} | types: [${entries.map(e => e.action.a).join(",")}] | waitedMs: ${waitedMs} | ts: ${Date.now()}`);

  _flushAtomicGroup(address, entries)
    .then((txIds) => {
      dbg(`[TXN-DEBUG] flush confirmed | actions: ${entries.length} | txIds: [${txIds.map(t => t.slice(0, 8)).join(",")}] | ts: ${Date.now()}`);
      _txnStatusCallback?.("confirmed", { count: entries.length, txIds });
    })
    .catch((err) => {
      const msg = (err as Error)?.message || String(err);
      console.error(`[BATCH-DEBUG] flush FAILED | error: ${msg} | re-queuing ${entries.length} entries | ts: ${Date.now()}`);
      if (!msg.includes("cancelled") && !msg.includes("rejected")) {
        _txnQueue.unshift(...entries);
      }
      _txnStatusCallback?.("error", { count: entries.length, message: msg });
    })
    .finally(() => {
      _txnFlushInProgress = false;
    });
}

async function _flushAtomicGroup(
  fromAddress: string,
  entries: TxnQueueEntry[]
): Promise<string[]> {
  const suggestedParams = await getTransactionParams();
  const allTxIds: string[] = [];

  const chunks: TxnQueueEntry[][] = [];
  for (let i = 0; i < entries.length; i += MAX_GROUP_SIZE) {
    chunks.push(entries.slice(i, i + MAX_GROUP_SIZE));
  }

  for (const chunk of chunks) {
    const txns = chunk.map((entry) => {
      return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: fromAddress,
        receiver: fromAddress,
        amount: 0,
        note: _buildActionNote(entry.action, fromAddress),
        suggestedParams,
      });
    });

    if (txns.length > 1) {
      algosdk.assignGroupID(txns);
      dbg(`[BATCH-DEBUG] assignGroupID applied | groupSize: ${txns.length} | ts: ${Date.now()}`);
    }

    _txnStatusCallback?.("submitting", { count: txns.length });

    const signedBlobs = txns.length === 1
      ? await signTransactionWithActiveWallet(txns[0], fromAddress)
      : await signGroupedTransactionsWithActiveWallet(txns, fromAddress);

    dbg(`[BATCH-DEBUG] signed ${signedBlobs.length} blob(s) → submitting to algod | ts: ${Date.now()}`);
    const response = await algodClient.sendRawTransaction(signedBlobs).do();
    const firstTxId = response.txid || txns[0].txID();
    await algosdk.waitForConfirmation(algodClient, firstTxId, 4);
    dbg(`[BATCH-DEBUG] group confirmed | firstTxId: ${firstTxId} | ts: ${Date.now()}`);
    allTxIds.push(firstTxId);
  }

  return allTxIds;
}

export function getTxnQueueSize(): number {
  return _txnQueue.length;
}

export function registerBatchSignCallback(
  address: string,
  _callback: unknown
) {
  registerTxnQueueAddress(address);
}
