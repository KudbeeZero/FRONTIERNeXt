/**
 * server/services/chain/delivery.ts
 *
 * Shared "attempt delivery of a custody-held NFT" flow used by the land,
 * commander, and weapon services. Each asset type keeps its own thin wrapper
 * (attemptDelivery / attemptCommanderDelivery / attemptWeaponDelivery) so
 * callers and specs are unchanged; the opt-in check → transfer → error
 * classification sequence lives here once.
 *
 * Returns success/failure without throwing. Called on background retry loops —
 * safe to call multiple times.
 *
 * No UI imports. No route logic. No game state.
 */

import { isAddressOptedIn } from "./asa";
import type { AssetId } from "./types";

export async function attemptNftDelivery(
  assetId: AssetId,
  toAddress: string,
  opts: {
    /** Performs the actual on-chain transfer once the opt-in check passes. */
    transfer: () => Promise<unknown>;
    /** Error-log prefix, e.g. "[chain/land] attemptDelivery failed plotId=42". */
    label: string;
  }
): Promise<{ delivered: boolean; reason?: string }> {
  try {
    const optedIn = await isAddressOptedIn(toAddress, assetId);
    if (!optedIn) return { delivered: false, reason: "not_opted_in" };
    await opts.transfer();
    return { delivered: true };
  } catch (err) {
    console.error(`${opts.label}:`, err);
    return { delivered: false, reason: "transfer_failed" };
  }
}
