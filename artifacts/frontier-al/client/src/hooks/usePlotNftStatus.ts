// usePlotNftStatus — per-plot NFT delivery state for the "Mint NFT" UX.
//
// A plot is "not_delivered" (still in admin custody) when its ASA exists but is
// held by someone other than the buyer's wallet. Until it's delivered, the plot
// shows grayed-out with a "Mint NFT" button instead of "Mine".
//
// Query key uses the "/api/nft/plot" prefix so the existing invalidation in
// GameLayout (queryKey: ["/api/nft/plot"]) un-grays the plot the moment a
// delivery succeeds.

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { LandParcel } from "@shared/schema";

export type PlotNftStatus = { status: "delivered" | "not_delivered"; assetId?: number };

interface PlotNftRow {
  plotId: number;
  assetId: number | null;
  mintedToAddress: string | null;
}

const MAX_TRACKED = 25; // bound the per-plot fan-out

export function usePlotNftStatus(
  ownedParcels: LandParcel[],
  walletAddress: string | null | undefined,
): Record<number, PlotNftStatus> {
  const tracked = ownedParcels.slice(0, MAX_TRACKED);

  const queries = useQueries({
    queries: tracked.map((parcel) => ({
      queryKey: ["/api/nft/plot", parcel.plotId],
      queryFn: async (): Promise<PlotNftRow | null> => {
        const res = await fetch(`/api/nft/plot/${parcel.plotId}`);
        if (!res.ok) return null; // 404 = not minted yet → treat as deliverable/mining-allowed
        return (await res.json()) as PlotNftRow;
      },
      staleTime: 30_000,
    })),
  });

  return useMemo(() => {
    const map: Record<number, PlotNftStatus> = {};
    tracked.forEach((parcel, i) => {
      const d = queries[i]?.data;
      // No ASA yet (or fetch failed) → allow mining (default delivered).
      if (!d?.assetId) {
        map[parcel.plotId] = { status: "delivered" };
        return;
      }
      const inCustody = !!d.mintedToAddress && d.mintedToAddress !== walletAddress;
      map[parcel.plotId] = { status: inCustody ? "not_delivered" : "delivered", assetId: d.assetId };
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries.map((q) => q.dataUpdatedAt).join(","), walletAddress, tracked.map((p) => p.plotId).join(",")]);
}
