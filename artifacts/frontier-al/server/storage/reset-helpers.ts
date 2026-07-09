/**
 * Pure helpers for the TestNet parcel reset script — testable without a live DB.
 */

import { TOTAL_PLOTS } from "@shared/schema";

export type Counts = {
  parcels: number;
  available: number;
  minted: number;
  plotNfts: number;
  mintIdempotency: number;
  plotMintRetryQueue: number;
  subParcels: number;
  tradeOrders: number;
  orbitalEvents: number;
  gameEvents: number;
  battles: number;
};

export function resetNetworkIsAllowed(network: string | undefined): boolean {
  const n = (network ?? "").toLowerCase();
  return n !== "mainnet";
}

export function hasResetMismatch(after: Counts): boolean {
  return (
    after.parcels !== TOTAL_PLOTS ||
    after.available !== TOTAL_PLOTS ||
    after.plotNfts !== 0 ||
    after.mintIdempotency !== 0 ||
    after.plotMintRetryQueue !== 0 ||
    after.subParcels !== 0 ||
    after.tradeOrders !== 0 ||
    after.orbitalEvents !== 0 ||
    after.gameEvents !== 0 ||
    after.battles !== 0
  );
}
