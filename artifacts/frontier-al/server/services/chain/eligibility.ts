// ── Sybil / anti-bot gating for the welcome bonus ─────────────────────────────
//
// Wallet-signature auth proves a caller *controls* an address, but Algorand
// addresses are free to generate — so a bot can mint unlimited wallets, each
// passing auth, and farm the 500 ASCEND welcome bonus. This module gates the
// bonus behind a cheap on-chain heuristic: the wallet must hold a minimum ALGO
// balance. Funding thousands of addresses with real ALGO has a real cost
// (especially on mainnet), which is what raises the Sybil bar.
//
// Important: this gates the BONUS, not login/account creation. An ineligible
// wallet can still connect and play; the bonus stays claimable and is granted
// on the first login where the wallet qualifies (welcomeBonusReceived is only
// set once the grant actually happens).

import { getAlgodClient } from "./client";

const MICRO_ALGO = 1_000_000;

export interface Eligibility {
  eligible: boolean;
  reason?: string;
  algo?: number;
}

/** Whether the Sybil check is active (default ON; set WELCOME_BONUS_SYBIL_CHECK=false to disable). */
export function isSybilCheckEnabled(): boolean {
  return process.env.WELCOME_BONUS_SYBIL_CHECK !== "false";
}

/** Minimum ALGO balance (in microAlgos) required to claim the bonus. Default 1 ALGO. */
export function minAlgoMicros(): number {
  const v = Number(process.env.WELCOME_BONUS_MIN_ALGO);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v * MICRO_ALGO) : 1 * MICRO_ALGO;
}

/**
 * Pure decision given a wallet's microAlgo balance. Separated from the network
 * call so it can be unit-tested deterministically.
 */
export function evaluateBalanceEligibility(amountMicros: number): Eligibility {
  if (!isSybilCheckEnabled()) return { eligible: true };
  const min = minAlgoMicros();
  if (min <= 0) return { eligible: true };
  const algo = amountMicros / MICRO_ALGO;
  if (amountMicros < min) {
    return {
      eligible: false,
      algo,
      reason: `Wallet must hold at least ${min / MICRO_ALGO} ALGO to claim the welcome bonus.`,
    };
  }
  return { eligible: true, algo };
}

/**
 * Assess whether `address` qualifies for the welcome bonus by reading its
 * on-chain ALGO balance. Fails CLOSED on a genuine outage (denies the bonus,
 * which stays claimable on a later login) so the check can't be bypassed by
 * knocking algod offline.
 */
export async function assessWelcomeBonusEligibility(address: string): Promise<Eligibility> {
  if (!isSybilCheckEnabled()) return { eligible: true };
  try {
    const algod = getAlgodClient();
    const info = await algod.accountInformation(address).do();
    return evaluateBalanceEligibility(Number((info as { amount?: number | bigint }).amount ?? 0));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Unknown/never-funded account → simply ineligible (not an outage).
    if (/no accounts found|account does not exist|not found|404/i.test(msg)) {
      return { eligible: false, algo: 0, reason: "Wallet has no on-chain ALGO balance yet." };
    }
    // Genuine error → fail closed; the bonus remains claimable on a later login.
    console.warn("[eligibility] balance check failed, denying bonus (retryable):", msg);
    return { eligible: false, reason: "Eligibility check temporarily unavailable — try again shortly." };
  }
}
