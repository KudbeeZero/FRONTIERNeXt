/**
 * NftClaimNotification.tsx
 *
 * Floating sci-fi notification cards that appear when Commander or Land NFTs
 * are ready to claim from escrow. Positioned bottom-left, dismissible,
 * with pulsing glow animations matching the Frontier AL / landing page theme.
 */

import { resolveApiUrl } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { Gift, X, ExternalLink, Shield, MapPin, Loader2 } from "lucide-react";
import { devSessionActive } from "@/lib/devSession";
import type { Player, LandParcel } from "@shared/schema";

type ClaimableItem = 
  | { key: string; type: "commander"; id: string; name: string; tier: string; assetId: number | null; mintStatus: "minted" | "failed" }
  | { key: string; type: "plot"; plotId: number; assetId: number | null; biome: string; mintStatus: "minted" | "failed" | "minting"; error?: string };

interface NftClaimNotificationProps {
  commanders: Player["commanders"];
  ownedParcels: LandParcel[];
  walletAddress: string | null;
  walletConnected: boolean;
  playerId?: string;
  onClaimCommander: (commanderId: string) => void;
  onRetryCommanderMint: (commanderId: string) => void;
  onDeliverPlotNft?: (plotId: number, assetId: number) => void;
  onRetryPlotMint?: (plotId: number) => void;
  isClaimingCommander?: boolean;
  isRetryingCommanderMint?: string | null;
  isDeliveringPlotId?: number | null;
  isRetryingPlotMint?: number | null;
}

export function NftClaimNotification({
  commanders = [],
  ownedParcels = [],
  walletAddress,
  walletConnected,
  playerId,
  onClaimCommander,
  onRetryCommanderMint,
  onDeliverPlotNft,
  onRetryPlotMint,
  isClaimingCommander,
  isRetryingCommanderMint,
  isDeliveringPlotId,
  isRetryingPlotMint,
}: NftClaimNotificationProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Poll commander NFT statuses
  const commanderNftQueries = useQueries({
    queries: commanders.slice(0, 10).map(cmd => ({
      queryKey: ["/api/nft/commander", cmd.id],
      queryFn: async () => {
        const res = await fetch(resolveApiUrl(`/api/nft/commander/${cmd.id}`));
        if (!res.ok) return null;
        return res.json() as Promise<{ exists: boolean; status?: string; assetId?: number | null }>;
      },
      staleTime: 5_000,
      refetchInterval: (query: any) => {
        const d = query.state.data;
        // Keep polling while minting or failed (user may trigger retry)
        if (!d?.exists || d?.status === "minting" || d?.status === "failed") return 5_000;
        return false;
      },
    })),
  });

  // Poll plot NFT statuses (first 15 owned parcels)
  const plotNftQueries = useQueries({
    queries: ownedParcels.slice(0, 15).map(parcel => ({
      queryKey: ["nft-plot-notification", parcel.plotId],
      queryFn: async () => {
        const res = await fetch(resolveApiUrl(`/api/nft/plot/${parcel.plotId}`));
        if (res.status === 404) return null;
        if (!res.ok) return null;
        return res.json() as Promise<{ plotId: number; assetId: number | null; mintedToAddress: string | null; status?: string; error?: string } | null>;
      },
      staleTime: 30_000,
      refetchInterval: (query: any) => {
        const d = query.state.data;
        // Keep polling while minting or failed (user may trigger retry)
        if (d?.status === "minting" || d?.status === "failed") return 5_000;
        return 30_000;
      },
    })),
  });

  // Commander NFTs: show when minted (in escrow) or failed (retry available)
  const claimableCommanders: ClaimableItem[] = commanders.slice(0, 10).flatMap((cmd, idx) => {
    const d = commanderNftQueries[idx]?.data;
    if (!d?.exists) return [];
    // Show "minted" badges (claimable) and "failed" badges (retryable)
    if (d.status !== "minted" && d.status !== "failed") return [];
    const key = `cmd-${cmd.id}`;
    if (dismissed.has(key)) return [];
    return { key, type: "commander" as const, id: cmd.id, name: cmd.name, tier: cmd.tier, assetId: d.assetId ?? null, mintStatus: d.status as "minted" | "failed" };
  });

  // Plot NFTs in escrow (minted but mintedToAddress !== wallet) or failed mints
  const claimablePlots: ClaimableItem[] = ownedParcels.slice(0, 15).flatMap((parcel, idx) => {
    const d = plotNftQueries[idx]?.data;
    if (!d) return [];
    
    const key = `plot-${parcel.plotId}`;
    if (dismissed.has(key)) return [];
    
    // Show failed mints (retryable)
    if (d.status === "failed") {
      return { key, type: "plot" as const, plotId: parcel.plotId, assetId: null, biome: parcel.biome as string, mintStatus: "failed" as const, error: d.error };
    }
    
    // Show minting status
    if (d.status === "minting") {
      return { key, type: "plot" as const, plotId: parcel.plotId, assetId: null, biome: parcel.biome as string, mintStatus: "minting" as const };
    }
    
    if (!d?.assetId) return [];
    const inCustody = !!d.mintedToAddress && d.mintedToAddress !== walletAddress;
    if (!inCustody) return [];
    return { key, type: "plot" as const, plotId: parcel.plotId, assetId: d.assetId, biome: parcel.biome as string, mintStatus: "minted" as const };
  });

  const all: ClaimableItem[] = [...claimableCommanders, ...claimablePlots];
  // The dev/test player can never claim — never nag it with claim cards.
  if (devSessionActive() || all.length === 0) return null;

  return (
    <div
      className="absolute bottom-24 left-3 z-50 flex flex-col gap-2.5 pointer-events-none"
      style={{ maxWidth: 260 }}
      aria-label="NFT claim notifications"
    >
      {all.map(item => (
        <div
          key={item.key}
          className={`pointer-events-auto rounded-xl overflow-hidden ${item.type === "commander" ? "nft-commander-card" : "nft-land-card"}`}
          style={{
            background: "linear-gradient(135deg, rgba(0,0,30,0.96) 0%, rgba(8,4,22,0.98) 100%)",
            border: item.type === "commander"
              ? "1px solid rgba(168,85,247,0.55)"
              : "1px solid rgba(255,180,0,0.55)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Header bar */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{
              background: item.type === "commander"
                ? "linear-gradient(90deg, rgba(168,85,247,0.15) 0%, transparent 100%)"
                : "linear-gradient(90deg, rgba(255,180,0,0.12) 0%, transparent 100%)",
              borderBottom: item.type === "commander"
                ? "1px solid rgba(168,85,247,0.2)"
                : "1px solid rgba(255,180,0,0.2)",
            }}
          >
            <div className="flex items-center gap-1.5">
              {item.type === "commander"
                ? <Shield className="w-3 h-3" style={{ color: "#a855f7" }} />
                : <MapPin className="w-3 h-3" style={{ color: "#f0b429" }} />
              }
              <span
                className="text-[9px] font-display font-bold uppercase tracking-widest"
                style={{ color: item.type === "commander" ? "#c084fc" : "#fbbf24", letterSpacing: "0.18em" }}
              >
                {item.type === "commander" ? "Commander NFT" : "Land NFT"}
              </span>
            </div>
            <button
              onClick={() => setDismissed(s => new Set([...s, item.key]))}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-3 py-2.5">
            {item.type === "commander" ? (
              <>
                <p className="text-[11px] font-bold text-white mb-0.5 truncate">{item.name}</p>
                <p className="text-[9px] capitalize mb-2" style={{ color: "rgba(192,132,252,0.75)" }}>
                  {item.tier} {item.mintStatus === "failed" ? "· Mint failed — tap Retry" : item.assetId ? `· ASA ${item.assetId}` : "· Minting…"}
                </p>
                <div className="flex gap-2">
                  {walletConnected ? (
                    item.mintStatus === "failed" ? (
                      <button
                        onClick={() => onRetryCommanderMint(item.id)}
                        disabled={isRetryingCommanderMint === item.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-display font-bold uppercase tracking-wide transition-colors"
                        style={{
                          background: "rgba(239,68,68,0.2)",
                          border: "1px solid rgba(239,68,68,0.6)",
                          color: "#f87171",
                        }}
                      >
                        {isRetryingCommanderMint === item.id
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Retrying…</>
                          : <>↻ Retry Mint</>
                        }
                      </button>
                    ) : (
                      <button
                        onClick={() => onClaimCommander(item.id)}
                        disabled={!!isClaimingCommander}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-display font-bold uppercase tracking-wide transition-colors"
                        style={{
                          background: "rgba(168,85,247,0.25)",
                          border: "1px solid rgba(168,85,247,0.6)",
                          color: "#c084fc",
                        }}
                      >
                        {isClaimingCommander
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Claiming…</>
                          : <><Gift className="w-3 h-3" />Claim NFT</>
                        }
                      </button>
                    )
                  ) : (
                    <p className="text-[9px] text-white/35">Connect wallet to claim</p>
                  )}
                  {item.assetId && (
                    <a
                      href={`https://explorer.perawallet.app/assets/${item.assetId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[9px] text-white/40 hover:text-white/70 transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold text-white mb-0.5">Plot #{item.plotId}</p>
                <p className="text-[9px] capitalize mb-2" style={{ color: "rgba(251,191,36,0.75)" }}>
                  {item.biome}
                  {item.mintStatus === "failed" ? " · Mint failed — tap Retry" :
                   item.mintStatus === "minting" ? " · Minting…" :
                   item.assetId ? ` · ASA ${item.assetId}` : ""}
                </p>
                <div className="flex gap-2">
                  {walletConnected ? (
                    item.mintStatus === "failed" ? (
                      <button
                        onClick={() => onRetryPlotMint?.(item.plotId)}
                        disabled={isRetryingPlotMint === item.plotId}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-display font-bold uppercase tracking-wide transition-colors"
                        style={{
                          background: "rgba(239,68,68,0.2)",
                          border: "1px solid rgba(239,68,68,0.6)",
                          color: "#f87171",
                        }}
                      >
                        {isRetryingPlotMint === item.plotId
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Retrying…</>
                          : <>↻ Retry Mint</>
                        }
                      </button>
                    ) : item.mintStatus === "minting" ? (
                      <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-display font-bold uppercase tracking-wide"
                        style={{
                          background: "rgba(251,191,36,0.1)",
                          border: "1px solid rgba(251,191,36,0.3)",
                          color: "rgba(251,191,36,0.6)",
                        }}
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />Minting…
                      </div>
                    ) : (
                      <button
                        onClick={() => onDeliverPlotNft?.(item.plotId, item.assetId!)}
                        disabled={isDeliveringPlotId === item.plotId}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-display font-bold uppercase tracking-wide transition-colors"
                        style={{
                          background: "rgba(251,191,36,0.15)",
                          border: "1px solid rgba(251,191,36,0.55)",
                          color: "#fbbf24",
                        }}
                      >
                        {isDeliveringPlotId === item.plotId
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Delivering…</>
                          : <><Gift className="w-3 h-3" />Claim NFT</>
                        }
                      </button>
                    )
                  ) : (
                    <p className="text-[9px] text-white/35">Connect wallet to claim</p>
                  )}
                  {item.assetId && (
                    <a
                      href={`https://explorer.perawallet.app/assets/${item.assetId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[9px] text-white/40 hover:text-white/70 transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Scanline accent */}
          <div
            className="h-px w-full"
            style={{
              background: item.type === "commander"
                ? "linear-gradient(90deg, transparent, rgba(168,85,247,0.4), transparent)"
                : "linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)",
            }}
          />
        </div>
      ))}

      {/* COMMS label */}
      <div
        className="text-[8px] font-mono text-center pointer-events-none"
        style={{ color: "rgba(100,160,255,0.35)", letterSpacing: "0.2em" }}
      >
        FRONTIER NFT RELAY — {all.length} PENDING
      </div>
    </div>
  );
}
