/**
 * NftClaimNotification.tsx
 *
 * Grouped claim/mint queue UI. Replaces individual floating cards with one
 * unified box when multiple commander/plot NFTs need attention.
 */

import { resolveApiUrl } from "@/lib/queryClient";
import { useState, useEffect, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Gift, X, ExternalLink, Shield, MapPin, Loader2, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { devSessionActive } from "@/lib/devSession";
import type { Player, LandParcel } from "@shared/schema";

type QueueStatus = "pending" | "needs_signature" | "signing" | "submitting" | "confirmed" | "failed" | "stale";

type QueueItem = {
  id: string;
  kind: "commander_claim" | "commander_retry" | "plot_claim" | "plot_retry";
  label: string;
  assetId?: number | null;
  status: QueueStatus;
  error?: string;
  commanderId?: string;
  plotId?: number;
};

interface NftClaimNotificationProps {
  commanders: Player["commanders"];
  ownedParcels: LandParcel[];
  walletAddress: string | null;
  walletConnected: boolean;
  playerId?: string;
  onClaimCommander: (commanderId: string) => Promise<void> | void;
  onRetryCommanderMint: (commanderId: string) => Promise<void> | void;
  onDeliverPlotNft?: (plotId: number, assetId: number) => Promise<void> | void;
  onRetryPlotMint?: (plotId: number) => Promise<void> | void;
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
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
        if (!d?.exists || d?.status === "minting" || d?.status === "failed") return 5_000;
        return false;
      },
    })),
  });

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
        if (d?.status === "minting" || d?.status === "failed") return 5_000;
        return 30_000;
      },
    })),
  });

  const claimableCommanders = useMemo(() => {
    return commanders.slice(0, 10).flatMap((cmd, idx) => {
      const d = commanderNftQueries[idx]?.data;
      if (!d?.exists) return [];
      if (d.status !== "minted" && d.status !== "failed") return [];
      const key = `cmd-${cmd.id}`;
      return { key, type: "commander" as const, id: cmd.id, name: cmd.name, tier: cmd.tier, assetId: d.assetId ?? null, status: d.status as "minted" | "failed" };
    });
  }, [commanders, commanderNftQueries]);

  const claimablePlots = useMemo(() => {
    return ownedParcels.slice(0, 15).flatMap((parcel, idx) => {
      const d = plotNftQueries[idx]?.data;
      if (!d) return [];
      const key = `plot-${parcel.plotId}`;
      if (d.status === "failed") {
        return { key, type: "plot" as const, plotId: parcel.plotId, assetId: null, biome: parcel.biome as string, status: "failed" as const, error: d.error };
      }
      if (d.status === "minting") {
        return { key, type: "plot" as const, plotId: parcel.plotId, assetId: null, biome: parcel.biome as string, status: "minting" as const };
      }
      if (!d?.assetId) return [];
      const inCustody = !!d.mintedToAddress && d.mintedToAddress !== walletAddress;
      if (!inCustody) return [];
      return { key, type: "plot" as const, plotId: parcel.plotId, assetId: d.assetId, biome: parcel.biome as string, status: "minted" as const };
    });
  }, [ownedParcels, plotNftQueries, walletAddress]);

  const allItems = useMemo(() => {
    const items: { key: string; type: "commander" | "plot"; id: string; assetId: number | null; label: string }[] = [];
    for (const c of claimableCommanders) {
      if (dismissed.has(c.key)) continue;
      items.push({ key: c.key, type: "commander", id: c.id, assetId: c.assetId, label: c.name });
    }
    for (const p of claimablePlots) {
      if (dismissed.has(p.key)) continue;
      items.push({ key: p.key, type: "plot", id: String(p.plotId), assetId: p.assetId, label: `Plot #${p.plotId}` });
    }
    return items;
  }, [claimableCommanders, claimablePlots, dismissed]);

  useEffect(() => {
    if (devSessionActive() || allItems.length === 0) {
      setQueue([]);
      return;
    }
    setQueue(prev => {
      const existing = new Map(prev.map(q => [q.id, q]));
      const next: QueueItem[] = [];
      for (const item of allItems) {
        const existingItem = existing.get(item.key);
        if (existingItem) {
          next.push(existingItem);
        } else {
          const kind: QueueItem["kind"] = item.type === "commander"
            ? claimableCommanders.find(c => `cmd-${c.id}` === item.key)?.status === "failed"
              ? "commander_retry"
              : "commander_claim"
            : claimablePlots.find(p => `plot-${p.plotId}` === item.key)?.status === "failed"
              ? "plot_retry"
              : "plot_claim";
          next.push({ id: item.key, kind, label: item.label, assetId: item.assetId, status: "pending", ...(item.type === "commander" ? { commanderId: item.id } : { plotId: Number(item.id) }) });
        }
      }
      return next;
    });
  }, [allItems, claimableCommanders, claimablePlots]);

  const activeCount = queue.filter(q => q.status !== "confirmed" && q.status !== "stale").length;

  if (devSessionActive() || activeCount === 0) return null;

  const processQueue = async () => {
    if (processing) return;
    setProcessing(true);
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === "confirmed" || item.status === "stale") continue;

      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "needs_signature" } : q));
      try {
        if (item.kind === "commander_claim" && item.commanderId) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "signing" } : q));
          await onClaimCommander(item.commanderId);
        } else if (item.kind === "commander_retry" && item.commanderId) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "signing" } : q));
          await onRetryCommanderMint(item.commanderId);
        } else if (item.kind === "plot_claim" && item.plotId && item.assetId != null && onDeliverPlotNft) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "signing" } : q));
          await onDeliverPlotNft(item.plotId, item.assetId);
        } else if (item.kind === "plot_retry" && item.plotId && onRetryPlotMint) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "signing" } : q));
          await onRetryPlotMint(item.plotId);
        }
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "confirmed" } : q));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "failed", error: msg } : q));
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setProcessing(false);
  };

  const dismissAll = () => {
    setQueue(prev => prev.map(q => ({ ...q, status: q.status === "confirmed" || q.status === "failed" ? q.status : "stale" as QueueStatus })));
    setDismissed(prev => {
      const next = new Set(prev);
      for (const item of allItems) next.add(item.key);
      return next;
    });
  };

  const pendingCount = queue.filter(q => q.status === "pending" || q.status === "needs_signature" || q.status === "signing" || q.status === "submitting").length;
  const confirmedCount = queue.filter(q => q.status === "confirmed").length;
  const failedCount = queue.filter(q => q.status === "failed").length;

  const statusLabel = pendingCount > 0
    ? `Processing ${pendingCount} item${pendingCount === 1 ? "" : "s"}…`
    : failedCount > 0
      ? `${confirmedCount} succeeded, ${failedCount} failed — tap Retry or dismiss`
      : `${confirmedCount} claim${confirmedCount === 1 ? "" : "s"} confirmed`;

  return (
    <div
      className="absolute bottom-24 left-3 z-50 flex flex-col gap-2.5 pointer-events-none"
      style={{ maxWidth: 260 }}
      aria-label="NFT claim queue"
    >
      <div
        className="pointer-events-auto rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(0,0,30,0.96) 0%, rgba(8,4,22,0.98) 100%)",
          border: "1px solid rgba(255,180,0,0.55)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          style={{
            background: "linear-gradient(90deg, rgba(255,180,0,0.12) 0%, transparent 100%)",
            borderBottom: "1px solid rgba(255,180,0,0.2)",
          }}
          onClick={() => setExpanded(o => !o)}
        >
          <div className="flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
            <span
              className="text-[9px] font-display font-bold uppercase tracking-widest"
              style={{ color: "#fbbf24", letterSpacing: "0.18em" }}
            >
              {expanded ? "Claim Queue" : `${queue.length} Item${queue.length === 1 ? "" : "s"} Ready`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {processing && <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />}
            {expanded ? <ChevronDown className="w-3 h-3 text-white/60" /> : <ChevronRight className="w-3 h-3 text-white/60" />}
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(false); setQueue([]); }}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="px-3 py-2.5 space-y-2">
            <p className="text-[10px] text-white/70 font-mono">{statusLabel}</p>

            <div className="flex flex-wrap gap-2">
              {pendingCount > 0 && (walletConnected || !walletAddress) && (
                <button
                  onClick={processQueue}
                  disabled={processing}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-display font-bold uppercase tracking-wide transition-colors"
                  style={{
                    background: "rgba(251,191,36,0.15)",
                    border: "1px solid rgba(251,191,36,0.55)",
                    color: "#fbbf24",
                    opacity: processing ? 0.6 : 1,
                  }}
                >
                  {processing ? <><Loader2 className="w-3 h-3 animate-spin" />Claiming…</> : "Claim All"}
                </button>
              )}
              {!walletConnected && pendingCount > 0 && (
                <span className="text-[9px] text-white/40 px-2 py-1.5 rounded-md" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                  Connect wallet to claim
                </span>
              )}
              {failedCount > 0 && (
                <button
                  onClick={processQueue}
                  disabled={processing}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-display font-bold uppercase tracking-wide transition-colors"
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.5)",
                    color: "#f87171",
                    opacity: processing ? 0.6 : 1,
                  }}
                >
                  Retry Failed
                </button>
              )}
              <button
                onClick={dismissAll}
                disabled={processing}
                className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-display font-bold uppercase tracking-wide transition-colors text-white/50 hover:text-white/80"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Dismiss
              </button>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {queue.map((item) => {
                const claimed = claimableCommanders.find(c => `cmd-${c.id}` === item.id);
                const plotted = claimablePlots.find(p => `plot-${p.plotId}` === item.id);
                const icon = item.kind.includes("commander") ? <Shield className="w-3 h-3" style={{ color: "#a855f7" }} /> : <MapPin className="w-3 h-3" style={{ color: "#f0b429" }} />;
                const statusColor = item.status === "confirmed" ? "#4ade80" : item.status === "failed" ? "#f87171" : "rgba(255,255,255,0.6)";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 py-1 px-2 rounded-md"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {icon}
                      <span className="text-[10px] text-white/80 truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.status === "confirmed" ? (
                        <CheckCircle2 className="w-3 h-3" style={{ color: statusColor }} />
                      ) : item.status === "failed" ? (
                        <AlertTriangle className="w-3 h-3" style={{ color: statusColor }} />
                      ) : (
                        item.status !== "pending" && item.status !== "stale" && (
                          <Loader2 className="w-3 h-3 animate-spin" style={{ color: statusColor }} />
                        )
                      )}
                      <span className="text-[9px] font-mono" style={{ color: statusColor }}>{item.status.replace("_", " ")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        className="text-[8px] font-mono text-center pointer-events-none px-2"
        style={{ color: "rgba(100,160,255,0.35)", letterSpacing: "0.2em" }}
      >
        FRONTIER NFT RELAY — {queue.length} TOTAL
      </div>
    </div>
  );
}
