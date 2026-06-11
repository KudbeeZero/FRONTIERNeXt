/**
 * server/veritas/wallet.ts
 *
 * Test-wallet manager for VERITAS. Owns a persistent testnet account that the flow
 * runners act through — the way a real player's wallet would — so the harness can
 * opt-in to ASAs, pay ALGO for purchases, and read its own on-chain balances.
 *
 * TESTNET ONLY. Funding model (per the LUT): reuse a persistent funded account via
 * VERITAS_TEST_MNEMONIC, optionally topped up from a funder account
 * (VERITAS_FUNDER_MNEMONIC). The pure helpers are unit-tested offline; the chain
 * methods are thin wrappers over algosdk.
 */

import algosdk from "algosdk";

const DEFAULT_ALGOD = "https://testnet-api.algonode.cloud";

// ── Pure helpers (unit-tested, no I/O) ────────────────────────────────────────

export function microToAlgo(micro: bigint): number {
  return Number(micro) / 1_000_000;
}

export function algoToMicro(algo: number): bigint {
  return BigInt(Math.round(algo * 1_000_000));
}

/** True when balance is below the required minimum (so a top-up is needed). */
export function needsTopUp(balanceMicro: bigint, minMicro: bigint): boolean {
  return balanceMicro < minMicro;
}

/** Shape-tolerant asset holding (algosdk v3 model fields vs raw REST keys). */
interface AssetHoldingLike {
  assetId?: number | bigint;
  assetIndex?: number | bigint;
  "asset-id"?: number | bigint;
  amount?: number | bigint;
}
interface AccountInfoLike {
  amount?: number | bigint;
  assets?: AssetHoldingLike[];
}

/** Find an ASA holding amount in account info, tolerant of field naming. Null if not held. */
export function findAssetAmount(info: AccountInfoLike, assetId: number | bigint): bigint | null {
  const target = BigInt(assetId);
  for (const a of info.assets ?? []) {
    const id = a.assetId ?? a["asset-id"] ?? a.assetIndex;
    if (id != null && BigInt(id) === target) return BigInt(a.amount ?? 0);
  }
  return null;
}

// ── TestWallet ────────────────────────────────────────────────────────────────

export interface TestWalletOptions {
  mnemonic?: string;      // reuse a persistent (ideally funded) account
  funderMnemonic?: string; // optional account used to top up the test wallet
  algodUrl?: string;
  algodToken?: string;
}

export class TestWallet {
  readonly account: algosdk.Account;
  private readonly funder?: algosdk.Account;
  private readonly algod: algosdk.Algodv2;

  constructor(opts: TestWalletOptions = {}) {
    this.account = opts.mnemonic
      ? algosdk.mnemonicToSecretKey(opts.mnemonic)
      : algosdk.generateAccount();
    this.funder = opts.funderMnemonic ? algosdk.mnemonicToSecretKey(opts.funderMnemonic) : undefined;
    this.algod = new algosdk.Algodv2(opts.algodToken ?? "", opts.algodUrl ?? DEFAULT_ALGOD, "");
  }

  /** Build from VERITAS_* env, or return null if no test mnemonic is configured. */
  static fromEnv(): TestWallet | null {
    const mnemonic = process.env.VERITAS_TEST_MNEMONIC;
    if (!mnemonic) return null;
    return new TestWallet({
      mnemonic,
      funderMnemonic: process.env.VERITAS_FUNDER_MNEMONIC,
      algodUrl: process.env.VERITAS_ALGOD_URL ?? DEFAULT_ALGOD,
      algodToken: process.env.VERITAS_ALGOD_TOKEN,
    });
  }

  get address(): string {
    return this.account.addr.toString();
  }

  /** Export the mnemonic — log once when a wallet is generated so it can be persisted+funded. */
  exportMnemonic(): string {
    return algosdk.secretKeyToMnemonic(this.account.sk);
  }

  async getAlgoBalanceMicro(): Promise<bigint> {
    const info = await this.algod.accountInformation(this.account.addr).do();
    return BigInt((info as AccountInfoLike).amount ?? 0);
  }

  async getAsaBalance(assetId: number | bigint): Promise<bigint | null> {
    const info = await this.algod.accountInformation(this.account.addr).do();
    return findAssetAmount(info as AccountInfoLike, assetId);
  }

  async isOptedIn(assetId: number | bigint): Promise<boolean> {
    return (await this.getAsaBalance(assetId)) !== null;
  }

  /**
   * Ensure the wallet holds at least minMicro ALGO. If short and a funder is set,
   * transfer the shortfall (plus a small buffer) from the funder. Returns the final
   * balance and whether a top-up happened. Without a funder it only reports status.
   */
  async ensureFunded(minMicro: bigint): Promise<{ funded: boolean; balanceMicro: bigint; toppedUp: boolean }> {
    let balanceMicro = await this.getAlgoBalanceMicro();
    if (!needsTopUp(balanceMicro, minMicro)) return { funded: true, balanceMicro, toppedUp: false };
    if (!this.funder) return { funded: false, balanceMicro, toppedUp: false };

    const shortfall = minMicro - balanceMicro + 100_000n; // + 0.1 ALGO buffer for fees
    const sp = await this.algod.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: this.funder.addr,
      receiver: this.account.addr,
      amount: shortfall,
      suggestedParams: sp,
    });
    const signed = txn.signTxn(this.funder.sk);
    const { txid } = await this.algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(this.algod, txid, 5);
    balanceMicro = await this.getAlgoBalanceMicro();
    return { funded: !needsTopUp(balanceMicro, minMicro), balanceMicro, toppedUp: true };
  }

  /** Opt the wallet into an ASA. Idempotent — no-op (returns null txId) if already opted in. */
  async optIn(assetId: number | bigint): Promise<{ txId: string | null; alreadyOptedIn: boolean }> {
    if (await this.isOptedIn(assetId)) return { txId: null, alreadyOptedIn: true };
    const sp = await this.algod.getTransactionParams().do();
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: this.account.addr,
      receiver: this.account.addr,
      amount: 0,
      assetIndex: Number(assetId),
      suggestedParams: sp,
    });
    const signed = txn.signTxn(this.account.sk);
    const { txid } = await this.algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(this.algod, txid, 5);
    return { txId: txid, alreadyOptedIn: false };
  }

  /** Send ALGO from the test wallet. Returns the confirmed txId. */
  async pay(to: string, microAlgo: bigint, note?: string): Promise<string> {
    const sp = await this.algod.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: this.account.addr,
      receiver: to,
      amount: microAlgo,
      suggestedParams: sp,
      note: note ? new TextEncoder().encode(note) : undefined,
    });
    const signed = txn.signTxn(this.account.sk);
    const { txid } = await this.algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(this.algod, txid, 5);
    return txid;
  }
}
