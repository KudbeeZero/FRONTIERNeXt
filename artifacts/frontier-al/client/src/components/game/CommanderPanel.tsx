import { resolveApiUrl } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import {
  Shield, Swords, Zap, Target, Radio, Radar, Clock,
  Satellite, Gift, Loader2, ChevronDown, ChevronUp, Pickaxe, Fuel,
  AlertTriangle, MapPin, CheckCircle2, ChevronsRight, PackageCheck, ExternalLink,
  ChevronLeft, ChevronRight, Activity, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ATTACK_ICONS } from "@/lib/attackIcons";
import { serverNow } from "@/lib/serverClock";
import { devSessionActive, effectiveInCustody } from "@/lib/devSession";
import { CommanderCombatRecord } from "./CommanderCombatRecord";
import { SatelliteCard } from "./commander/SatelliteCard";
import { DroneCard } from "./commander/DroneCard";
import { AvatarCard } from "./commander/AvatarCard";
import { SubParcelGridPicker } from "./commander/SubParcelGridPicker";
import { BattleResultCard, type BattleResult } from "./commander/BattleResultCard";
import { GameTerminal } from "./GameTerminal";
import { BattleTargetSelector } from "./BattleTargetSelector";
import { BattlePlanner } from "./BattlePlanner";
import type { TerminalCommand } from "@/lib/terminalCommands";
import { COMPANION, COMMANDER_IMAGES, TIER_COLORS, formatCountdown } from "./commander/shared";
import type { Player, CommanderTier, SpecialAttackType, LandParcel, Battle } from "@shared/schema";
import {
  COMMANDER_INFO, SPECIAL_ATTACK_INFO, DRONE_MINT_COST_ASCEND, MAX_DRONES,
  DRONE_SCOUT_DURATION_MS, SATELLITE_DEPLOY_COST_ASCEND, MAX_SATELLITES,
  SATELLITE_YIELD_BONUS, ATTACK_BASE_COST, biomeBonuses,
  BATTLE_DURATION_MS,
} from "@shared/schema";
import type { SubParcel } from "@shared/schema";
import droneImg from "@assets/image_1771570514563.png";

const TIER_BORDER: Record<CommanderTier, string> = {
  sentinel: "border-blue-500/60 bg-blue-500/5",
  phantom:  "border-purple-500/60 bg-purple-500/5",
  reaper:   "border-orange-500/60 bg-orange-500/5",
};
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ── Main CommanderPanel ───────────────────────────────────────────────────────

export interface CommanderPanelProps {
  player: Player | null;
  onMintAvatar: (tier: CommanderTier) => void;
  onDeployDrone: (targetParcelId?: string) => void;
  onDeploySatellite: () => void;
  onSwitchCommander?: (index: number) => void;
  onClaimCommanderNft?: (commanderId: string) => void;
  onAttack?: (troops: number, iron: number, fuel: number, crystal: number, commanderId?: string, sourceParcelId?: string) => void;
  isMinting: boolean;
  isDeployingDrone: boolean;
  isDeployingSatellite: boolean;
  isClaimingCommanderNft?: boolean;
  isAttacking?: boolean;
  /** Bumped by the parent when the player taps "Attack" elsewhere — opens the Battlefront. */
  openBattlefrontSignal?: number;
  selectedParcel?: LandParcel | null;
  ownedParcels?: LandParcel[];
  allParcels?: LandParcel[];
  wallet?: { isConnected: boolean; address: string | null };
  className?: string;
  onDeliverPlotNft?: (plotId: number, assetId: number) => void;
  isDeliveringPlotNftId?: number | null;
  onClaimAllPlotNfts?: (plots: { plotId: number; assetId: number }[]) => void;
  isClaimingAllPlotNfts?: boolean;
  battles?: Battle[];
  onSelectTarget?: (parcelId: string) => void;
  onSourceParcelChange?: (parcelId: string | null) => void;
  onOpenMap?: () => void;
}

export function CommanderPanel({
  player, onMintAvatar, onDeployDrone, onDeploySatellite, onSwitchCommander,
  onClaimCommanderNft, onAttack, isMinting, isDeployingDrone, isDeployingSatellite,
  isClaimingCommanderNft, isAttacking, openBattlefrontSignal, selectedParcel, ownedParcels = [],
  allParcels = [], wallet, className, onDeliverPlotNft, isDeliveringPlotNftId,
  onClaimAllPlotNfts, isClaimingAllPlotNfts,   battles = [],
  onSelectTarget,
  onSourceParcelChange,
  onOpenMap,
}: CommanderPanelProps) {
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<CommanderTier>("sentinel");
  const [showMintSection, setShowMintSection] = useState(false);
  const [rosterPage, setRosterPage] = useState(0);
  const ROSTER_PER_PAGE = 4;

  // Battlefront state
  const [battlefrontOpen, setBattlefrontOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [attackMode, setAttackMode] = useState<"plot" | "sub-parcel">("plot");
  const [targetParcelId, setTargetParcelId] = useState<string>("");
  const [targetPlotId, setTargetPlotId] = useState<string>("");
  const [selectedSubParcelId, setSelectedSubParcelId] = useState<string | null>(null);
  const [selectedSubIdx, setSelectedSubIdx] = useState<number | null>(null);
  const [troops, setTroops] = useState(1);
  const [extraIron, setExtraIron] = useState(0);
  const [extraFuel, setExtraFuel] = useState(0);
  const [extraCrystal, setExtraCrystal] = useState(0);
  const [lastBattleResult, setLastBattleResult] = useState<BattleResult | null>(null);
  const [sourceParcelId, setSourceParcelId] = useState<string | null>(ownedParcels[0]?.id ?? null);

  // Sync target from selected parcel
  useEffect(() => {
    if (selectedParcel) {
      setTargetParcelId(selectedParcel.id);
      setTargetPlotId(String(selectedParcel.plotId));
    }
  }, [selectedParcel?.id]);

  // Sync source parcel
  useEffect(() => {
    if (ownedParcels.length > 0 && !sourceParcelId) setSourceParcelId(ownedParcels[0].id);
  }, [ownedParcels]);

  // Notify parent when source parcel changes (for globe attack path preview)
  useEffect(() => {
    onSourceParcelChange?.(sourceParcelId);
  }, [sourceParcelId, onSourceParcelChange]);

  // Open the Battlefront when the parent signals an attack request (e.g. the
  // player tapped "Attack" on a plot/map). Ignores the initial 0 value.
  const attackSignalRef = useRef(openBattlefrontSignal);
  useEffect(() => {
    if (openBattlefrontSignal === undefined) return;
    if (openBattlefrontSignal !== attackSignalRef.current) {
      attackSignalRef.current = openBattlefrontSignal;
      if (openBattlefrontSignal > 0) {
        setBattlefrontOpen(true);
        setAttackMode("plot");
      }
    }
  }, [openBattlefrontSignal]);

  const { data: selectedTierPrice } = useQuery<{ ascendCost: number; algoNetworkFee: number; adminAddress: string; economyMode: string; currency: string }>({
    queryKey: ["/api/nft/commander-price", selectedTier],
    queryFn: async () => { const r = await fetch(resolveApiUrl(`/api/nft/commander-price/${selectedTier}`)); if (!r.ok) throw new Error(); return r.json(); },
    staleTime: 60_000, retry: false,
  });

  // Sub-parcel list for grid picker
  const { data: subParcelsData } = useQuery<{ subParcels: SubParcel[] }>({
    queryKey: ["/api/plots", targetPlotId, "sub-parcels"],
    queryFn: async () => {
      if (!targetPlotId) return { subParcels: [] };
      const r = await fetch(resolveApiUrl(`/api/plots/${targetPlotId}/sub-parcels`));
      if (!r.ok) return { subParcels: [] };
      return r.json();
    },
    enabled: attackMode === "sub-parcel" && !!targetPlotId,
    staleTime: 10_000,
  });

  // Fetch NFT status for all owned parcels (lazy — only when user opens Commander tab)
  const plotNftQueries = useQueries({
    queries: ownedParcels.slice(0, 25).map(parcel => ({
      queryKey: ["nft-plot", parcel.plotId],
      queryFn: async () => {
        const res = await fetch(resolveApiUrl(`/api/nft/plot/${parcel.plotId}`));
        if (res.status === 404) return null;
        if (!res.ok) return null;
        return res.json() as Promise<{ plotId: number; assetId: number | null; mintedToAddress: string | null } | null>;
      },
      staleTime: 30_000,
    })),
  });

  // The dev/test player can never claim (sentinel wallet) — collapse custody to
  // false so the claim banner + rows never nag it.
  const isDevPlayer = devSessionActive();
  const pendingNftPlots = ownedParcels.slice(0, 25).flatMap((parcel, idx) => {
    const d = plotNftQueries[idx]?.data;
    if (!d?.assetId) return [];
    const inCustody = effectiveInCustody(!!d.mintedToAddress && d.mintedToAddress !== wallet?.address, isDevPlayer);
    if (!inCustody) return [];
    return [{ plotId: parcel.plotId, assetId: d.assetId, biome: parcel.biome as string }];
  });

  // Sub-parcel attack mutation
  const subParcelAttackMutation = useMutation({
    mutationFn: async (params: { subParcelId: string; attackerId: string; attackerParcelId: string; commanderId?: string; troops: number; iron: number; fuel: number; crystal: number }) => {
      const r = await fetch(resolveApiUrl(`/api/sub-parcels/${params.subParcelId}/attack`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Attack failed"); }
      return r.json();
    },
    onSuccess: (data, variables) => {
      const cmd = player?.commanders?.find(c => c.id === variables.commanderId);
      setLastBattleResult({
        outcome: data.outcome,
        attackerPower: data.attackerPower,
        defenderPower: data.defenderPower,
        log: data.log ?? [],
        commanderTier: cmd?.tier as CommanderTier | undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/plots", targetPlotId, "sub-parcels"] });
    },
  });

  if (!player) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground p-8", className)}>
        <Shield className="w-12 h-12 mb-4 opacity-30" />
        <p className="font-display uppercase tracking-wide text-center">Connect wallet to access Commander</p>
      </div>
    );
  }

  const commanders = player.commanders || [];
  const hasCommander = commanders.length > 0;
  const activeCommander = player.commander;
  const activeDrones = player.drones.filter(d => d.status !== "scouting" || serverNow() - d.deployedAt < DRONE_SCOUT_DURATION_MS + 300000);
  const activeSatellites = (player.satellites ?? []).filter(s => s.status === "active" && s.expiresAt > serverNow());
  const isRealWallet = wallet?.isConnected && !!wallet?.address;
  const selectedInfo = COMMANDER_INFO[selectedTier];

  // Battlefront calc
  const baseCostIron = ATTACK_BASE_COST.iron * troops;
  const baseCostFuel = ATTACK_BASE_COST.fuel * troops;
  const totalIron = baseCostIron + extraIron;
  const totalFuel = baseCostFuel + extraFuel;
  const cmdBonus = activeCommander?.attackBonus ?? 0;
  const attackerPower = troops * 10 + extraIron * 0.5 + extraFuel * 0.8 + extraCrystal * 1.2 + cmdBonus;
  const targetForCalc = selectedParcel?.id === targetParcelId ? selectedParcel : null;
  const defenderPower = targetForCalc ? targetForCalc.defenseLevel * 15 * (biomeBonuses[targetForCalc.biome]?.defenseMod ?? 1) : 0;
  const winChance = defenderPower > 0 ? Math.min(95, Math.max(5, (attackerPower / (attackerPower + defenderPower)) * 100)) : 75;
  const canAfford = player.iron >= totalIron && player.fuel >= totalFuel && player.crystal >= extraCrystal;
  const maxTroops = Math.min(10, Math.floor(player.iron / ATTACK_BASE_COST.iron), Math.floor(player.fuel / ATTACK_BASE_COST.fuel));
  const isOnCooldown = player.attackCooldownUntil && serverNow() < player.attackCooldownUntil;
  const allCommandersLocked = commanders.every(c => c.lockedUntil && serverNow() < c.lockedUntil);

  const pendingBattles = battles.filter(b => b.attackerId === player?.id && b.status === "pending");
  const activeBattleCount = pendingBattles.length;
  const maxConcurrent = activeCommander ? (COMMANDER_INFO[activeCommander.tier]?.maxConcurrentAttacks ?? 1) : 0;
  const atMaxCapacity = activeBattleCount >= maxConcurrent;
  const targetEngaged = selectedParcel?.activeBattleId != null;

  const handleTargetSelect = (parcel: LandParcel) => {
    setTargetParcelId(parcel.id);
    setTargetPlotId(String(parcel.plotId));
    onSelectTarget?.(parcel.id);
  };

  const handleLaunchSubParcelAttack = () => {
    if (!player || !selectedSubParcelId || !sourceParcelId) return;
    subParcelAttackMutation.mutate({
      subParcelId: selectedSubParcelId,
      attackerId: player.id,
      attackerParcelId: sourceParcelId,
      commanderId: activeCommander?.id,
      troops,
      iron: totalIron,
      fuel: totalFuel,
      crystal: extraCrystal,
    });
  };

  const totalBattles = (player.attacksWon ?? 0) + (player.attacksLost ?? 0);
  const winRate = totalBattles > 0 ? Math.round(((player.attacksWon ?? 0) / totalBattles) * 100) : 0;
  const rosterPageCount = Math.max(1, Math.ceil(commanders.length / ROSTER_PER_PAGE));
  const rosterSlice = commanders.slice(rosterPage * ROSTER_PER_PAGE, (rosterPage + 1) * ROSTER_PER_PAGE);

  return (
    <div className={cn("flex flex-col h-full", className)} data-testid="commander-panel">

      {/* ── Sci-Fi Stats Header ── */}
      <div
        className="shrink-0 px-3 pt-3 pb-2.5 relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,30,0.98) 0%, rgba(8,4,30,0.96) 100%)",
          borderBottom: "1px solid rgba(0,229,255,0.15)",
        }}
      >
        {/* Scanline bar */}
        <div
          className="absolute inset-x-0 h-8 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(0,229,255,0.03) 0%, transparent 100%)",
            animation: "hud-scan 4s linear infinite",
            top: 0,
          }}
        />

        {/* HUD label */}
        <p
          className="text-[10px] font-mono mb-1.5 tracking-[0.2em]"
          style={{ color: "rgba(0,229,255,0.4)" }}
        >
          ◈ FRONTIER AL · COMMANDER HUD
        </p>

        {/* Title */}
        <h2
          className="font-display text-sm font-bold uppercase tracking-wide mb-3"
          style={{
            background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 60%, #f472b6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          COMMANDERS
        </h2>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
          {[
            { icon: <Target className="w-3.5 h-3.5" />, value: totalBattles, label: "My Battles", color: "#4fc3f7" },
            { icon: <CheckCircle2 className="w-3.5 h-3.5" />, value: player.attacksWon ?? 0, label: "Victories", color: "#4ade80" },
            { icon: <Activity className="w-3.5 h-3.5" />, value: `${winRate}%`, label: "Win Rate", color: "#a78bfa" },
            { icon: <Star className="w-3.5 h-3.5" />, value: player.ascend.toFixed(0), label: "ASCEND Balance", color: "#fbbf24" },
            { icon: <Shield className="w-3.5 h-3.5" />, value: commanders.length, label: "Commanders", color: "#60a5fa" },
            { icon: <Clock className="w-3.5 h-3.5" />, value: player.totalAscendBurned.toFixed(0), label: "ASCEND Burned", color: "#f472b6" },
          ].map(({ icon, value, label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{
                  background: `rgba(${hexToRgb(color)},0.08)`,
                  border: `1px solid rgba(${hexToRgb(color)},0.25)`,
                  color,
                }}
              >
                {icon}
              </div>
              <div>
                <p className="text-xs font-bold leading-none" style={{ color: "rgba(255,255,255,0.9)" }}>{value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(100,160,255,0.5)" }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Per-commander combat record (derived from /api/players/:id/commander-stats) */}
        <CommanderCombatRecord playerId={player.id} commanders={commanders} />

        {/* Player row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-bold truncate font-mono"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {player.id.slice(0, 14)}…
            </p>
            {activeCommander && (
              <div
                className="mt-1 px-2 py-1 rounded-md text-[9px] font-display uppercase tracking-wide truncate"
                style={{
                  background: "linear-gradient(90deg, rgba(180,120,20,0.2) 0%, rgba(120,80,10,0.1) 100%)",
                  border: "1px solid rgba(251,191,36,0.35)",
                  color: "#fbbf24",
                  boxShadow: "0 0 8px rgba(251,191,36,0.1)",
                }}
              >
                {activeCommander.name} · {activeCommander.tier} · +{activeCommander.attackBonus} ATK
              </div>
            )}
          </div>
          {!isDevPlayer && (
            <button
              onClick={() => setShowMintSection(!showMintSection)}
              className="shrink-0 px-3 py-2 rounded-lg text-[10px] font-display font-bold uppercase tracking-wide leading-tight text-center transition-all"
              style={{
                background: showMintSection
                  ? "rgba(239,68,68,0.4)"
                  : "linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(185,28,28,0.95) 100%)",
                border: "1px solid rgba(239,68,68,0.6)",
                boxShadow: showMintSection ? "none" : "0 0 12px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                color: "white",
                minWidth: 76,
              }}
            >
              MINT<br />
              <span className="font-mono text-[9px] opacity-80">{COMMANDER_INFO[selectedTier]?.mintCostAscend ?? 10} ASCEND</span>
            </button>
          )}
        </div>

        {/* Bottom border glow */}
        <div
          className="absolute bottom-0 inset-x-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.3), rgba(100,100,255,0.2), transparent)" }}
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">

          {/* ── Pending NFT Claims (terminal console — type or click to claim) ── */}
          {pendingNftPlots.length > 0 && (() => {
            const claimCommands: TerminalCommand[] = [];
            if (pendingNftPlots.length > 1 && onClaimAllPlotNfts) {
              claimCommands.push({
                keyword: "claim all",
                aliases: ["claimall"],
                label: "claim all",
                run: () => onClaimAllPlotNfts(pendingNftPlots.map(p => ({ plotId: p.plotId, assetId: p.assetId }))),
                disabled: !!isClaimingAllPlotNfts,
              });
            }
            if (pendingNftPlots.length === 1) {
              const only = pendingNftPlots[0];
              claimCommands.push({
                keyword: "claim",
                label: "claim",
                run: () => onDeliverPlotNft?.(only.plotId, only.assetId),
                disabled: isDeliveringPlotNftId === only.plotId,
              });
            }
            pendingNftPlots.forEach(plot => {
              claimCommands.push({
                keyword: `claim ${plot.plotId}`,
                label: `claim ${plot.plotId}`,
                run: () => onDeliverPlotNft?.(plot.plotId, plot.assetId),
                disabled: isDeliveringPlotNftId === plot.plotId,
              });
            });

            return (
              <div className="animate-in fade-in-0 slide-in-from-top-1 duration-300">
                <GameTerminal
                  accent="amber"
                  title={`${pendingNftPlots.length} NFT${pendingNftPlots.length > 1 ? "s" : ""} Awaiting Claim`}
                  lines={[
                    "Sign to receive it in your Algorand wallet.",
                    pendingNftPlots.length > 1
                      ? "Type claim <plot#> or [claim all] to sign every pending NFT."
                      : "Type [claim] or click below to sign.",
                  ]}
                  commands={claimCommands}
                  testId="commander-nft-terminal"
                >
                  <div className="mt-2 -mx-3 max-h-40 overflow-y-auto divide-y divide-amber-500/10 border-t border-amber-500/10">
                    {pendingNftPlots.map(plot => (
                      <div
                        key={plot.plotId}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-amber-500/5 transition-colors animate-in fade-in-0 duration-300"
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-amber-300 shrink-0">#{plot.plotId}</span>
                          <Badge variant="outline" className="text-[7px] px-1 py-0 border-amber-500/40 text-amber-400 capitalize shrink-0">{plot.biome}</Badge>
                          <a
                            href={`https://explorer.perawallet.app/assets/${plot.assetId}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[8px] text-muted-foreground font-mono hover:text-amber-300 transition-colors truncate"
                          >
                            ASA {plot.assetId}
                          </a>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onDeliverPlotNft?.(plot.plotId, plot.assetId)}
                          disabled={isDeliveringPlotNftId === plot.plotId}
                          className="h-6 px-2 text-[9px] font-display uppercase tracking-wide bg-amber-500 hover:bg-amber-600 text-black border-0 shrink-0"
                        >
                          {isDeliveringPlotNftId === plot.plotId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Claim"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </GameTerminal>
              </div>
            );
          })()}

          {/* ── Avatar Gallery (2-column grid + pagination) ── */}
          {hasCommander ? (
            <div>
              {/* 2-col grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {rosterSlice.map((cmd, sliceIdx) => {
                  const globalIdx = rosterPage * ROSTER_PER_PAGE + sliceIdx;
                  return (
                    <AvatarCard
                      key={cmd.id}
                      cmd={cmd}
                      isActive={activeCommander?.id === cmd.id}
                      onDeploy={() => onSwitchCommander?.(globalIdx)}
                      onClaim={onClaimCommanderNft}
                      isClaiming={isClaimingCommanderNft}
                      walletConnected={isRealWallet}
                    />
                  );
                })}
                {/* Empty filler card so last row is always even */}
                {rosterSlice.length % 2 === 1 && (
                  <div className="rounded-md border border-white/5 bg-white/[0.02] aspect-square flex items-center justify-center">
                    <span className="text-[10px] text-white/20 font-display uppercase">Empty</span>
                  </div>
                )}
              </div>

              {/* Pagination bar */}
              {rosterPageCount > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <button
                    onClick={() => setRosterPage(p => Math.max(0, p - 1))}
                    disabled={rosterPage === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wide text-white/60 disabled:opacity-30 hover:text-white transition-colors"
                    style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <ChevronLeft className="w-3 h-3" /> Back
                  </button>

                  {Array.from({ length: rosterPageCount }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setRosterPage(i)}
                      className="w-7 h-7 rounded-md text-[10px] font-mono font-bold transition-colors"
                      style={{
                        background: i === rosterPage ? "rgba(239,68,68,0.85)" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${i === rosterPage ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.1)"}`,
                        color: i === rosterPage ? "white" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => setRosterPage(p => Math.min(rosterPageCount - 1, p + 1))}
                    disabled={rosterPage === rosterPageCount - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wide text-white/60 disabled:opacity-30 hover:text-white transition-colors"
                    style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Shield className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-[10px] text-white/40 font-display uppercase">No commanders yet</p>
              <p className="text-[9px] text-white/25 mt-1">Use the Mint button above to enlist your first Commander</p>
            </div>
          )}

          {/* ── Mint Section ── */}
          {(!hasCommander || showMintSection) && (
            <div data-testid="mint-section">
              <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Swords className="w-3 h-3" /> {hasCommander ? "Mint Another" : "Mint Your First Commander"}
              </h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(Object.entries(COMMANDER_INFO) as [CommanderTier, (typeof COMMANDER_INFO)[CommanderTier]][]).map(([tier, info]) => {
                  const isSelected = selectedTier === tier;
                  const comp = COMPANION[tier];
                  return (
                    <button
                      key={tier}
                      onClick={() => setSelectedTier(tier)}
                      className={cn("p-2 rounded-md border text-center transition-colors", isSelected ? "border-primary bg-primary/10" : "border-border hover-elevate")}
                    >
                      <div className="text-xl mb-0.5">{comp.emoji}</div>
                      <img src={COMMANDER_IMAGES[tier]} alt={info.name} className="w-12 h-12 mx-auto rounded-md object-cover mb-1" />
                      <span className="text-[9px] font-display uppercase font-bold block" style={{ color: TIER_COLORS[tier] }}>{info.name}</span>
                      <span className={cn("text-[9px] font-mono block", player.ascend >= info.mintCostAscend ? "text-muted-foreground" : "text-destructive")}>{info.mintCostAscend} ASCEND</span>
                    </button>
                  );
                })}
              </div>
              <Card className="p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{COMPANION[selectedTier].emoji}</span>
                  <img src={COMMANDER_IMAGES[selectedTier]} alt={selectedInfo.name} className="w-9 h-9 rounded-md object-cover" />
                  <div>
                    <span className="text-sm font-display uppercase font-bold block" style={{ color: TIER_COLORS[selectedTier] }}>{selectedInfo.name}</span>
                    <span className="text-[10px] text-muted-foreground">{COMPANION[selectedTier].name} · {selectedInfo.specialAbility}</span>
                  </div>
                </div>
                <p className="text-[9px] text-cyan-400/80 italic mb-2">{COMPANION[selectedTier].flavor}</p>
                {isRealWallet && selectedTierPrice && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-cyan-500/5 border border-cyan-500/20 mb-2">
                    <Gift className="w-3 h-3 text-cyan-400" />
                    <p className="text-[9px] text-cyan-300">NFT incl. — network fee ~{selectedTierPrice.algoNetworkFee} ALGO</p>
                  </div>
                )}
                <Button onClick={() => onMintAvatar(selectedTier)} disabled={isMinting || player.ascend < selectedInfo.mintCostAscend} className="w-full font-display uppercase tracking-wide text-xs" data-testid="button-mint-avatar">
                  <Zap className="w-3.5 h-3.5 mr-2" />
                  {isMinting ? "Minting…" : isRealWallet && selectedTierPrice ? `Mint · ${selectedInfo.mintCostAscend} ASCEND + ${selectedTierPrice.algoNetworkFee} ALGO fee` : `Mint for ${selectedInfo.mintCostAscend} ASCEND`}
                </Button>
              </Card>
            </div>
          )}
          {hasCommander && showMintSection && (
            <Button variant="outline" size="sm" onClick={() => setShowMintSection(false)} className="w-full font-display uppercase tracking-wide text-xs border-red-500/40 text-red-400 hover:bg-red-500/10" data-testid="button-toggle-mint">
              <ChevronUp className="w-3 h-3 mr-1.5" /> Hide Mint
            </Button>
          )}

          {/* ── Battlefront ── */}
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setBattlefrontOpen(!battlefrontOpen)}
              className="w-full flex items-center justify-between p-3 bg-destructive/5 hover:bg-destructive/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-destructive" />
                <span className="font-display uppercase tracking-wide text-sm font-bold text-destructive">Battlefront</span>
              </div>
              {battlefrontOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {battlefrontOpen && (
              <div className="p-3 space-y-3">
                {/* Attack mode toggle */}
                <div className="flex rounded-md border border-border overflow-hidden text-[10px] font-display uppercase">
                  <button
                    onClick={() => setAttackMode("plot")}
                    className={cn("flex-1 py-1.5 transition-colors", attackMode === "plot" ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:bg-muted/30")}
                  >Plot Attack</button>
                  <button
                    onClick={() => setAttackMode("sub-parcel")}
                    className={cn("flex-1 py-1.5 transition-colors border-l border-border", attackMode === "sub-parcel" ? "bg-orange-500/20 text-orange-400" : "text-muted-foreground hover:bg-muted/30")}
                  >Sub-Parcel</button>
                </div>

                {attackMode === "sub-parcel" ? (
                  <>
                    {/* Target selector (sub-parcel picks the parent plot) */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-display uppercase text-muted-foreground">Select Target</p>
                      <BattleTargetSelector
                        allParcels={allParcels}
                        ownedParcels={ownedParcels}
                        playerFactionId={player.playerFactionId}
                        selectedParcelId={targetParcelId}
                        onSelect={handleTargetSelect}
                        sourceParcelId={sourceParcelId}
                        currentCommanderName={activeCommander?.name}
                        currentTroops={troops}
                        baseCostIron={ATTACK_BASE_COST.iron}
                        baseCostFuel={ATTACK_BASE_COST.fuel}
                      />
                    </div>

                    {/* Sub-parcel grid picker */}
                    {targetPlotId && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-display uppercase text-muted-foreground">Pick Sub-Parcel (orange = enemy)</p>
                        {subParcelsData?.subParcels?.length ? (
                          <SubParcelGridPicker
                            subParcels={subParcelsData.subParcels}
                            selectedIdx={selectedSubIdx}
                            onSelect={(idx, id) => { setSelectedSubIdx(idx); setSelectedSubParcelId(id); }}
                            currentPlayerId={player.id}
                          />
                        ) : (
                          <p className="text-[9px] text-muted-foreground">No sub-parcels found for this plot.</p>
                        )}
                        {selectedSubIdx !== null && (
                          <p className="text-[9px] text-orange-400 font-mono">Selected: Cell #{selectedSubIdx + 1}</p>
                        )}
                      </div>
                    )}

                    {/* Source parcel */}
                    {ownedParcels.length > 1 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-display uppercase text-muted-foreground">Launch From</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {ownedParcels.slice(0, 6).map(p => (
                            <button key={p.id} onClick={() => setSourceParcelId(p.id)} className={cn(
                              "flex-shrink-0 w-14 h-12 rounded border flex flex-col items-center justify-center text-[8px] font-mono gap-0.5 transition-colors",
                              sourceParcelId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/10 hover:border-muted-foreground text-muted-foreground"
                            )}>
                              <MapPin className="w-2.5 h-2.5" />
                              <span>#{p.plotId}</span>
                              <span className="capitalize text-[7px]">{p.biome}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active commander display */}
                    {activeCommander && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40">
                        <span className="text-base">{COMPANION[activeCommander.tier as CommanderTier]?.emoji}</span>
                        <div className="text-[9px]">
                          <p className="font-display uppercase font-bold" style={{ color: TIER_COLORS[activeCommander.tier as CommanderTier] }}>{activeCommander.name}</p>
                          <p className="text-muted-foreground">+{activeCommander.attackBonus} ATK · {COMPANION[activeCommander.tier as CommanderTier]?.name}</p>
                        </div>
                        <ChevronsRight className="w-3 h-3 text-muted-foreground ml-auto" />
                      </div>
                    )}

                    {/* Resources — Troops always visible; extras tucked behind Advanced ▾ */}
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-display uppercase text-muted-foreground">Troops</span>
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => setTroops(Math.max(1, troops - 1))} disabled={troops <= 1}><ChevronDown className="w-2.5 h-2.5" /></Button>
                            <span className="font-mono text-sm w-5 text-center">{troops}</span>
                            <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => setTroops(Math.min(maxTroops, troops + 1))} disabled={troops >= maxTroops}><ChevronUp className="w-2.5 h-2.5" /></Button>
                          </div>
                        </div>
                        <Slider value={[troops]} onValueChange={([v]) => setTroops(v)} min={1} max={Math.max(1, maxTroops)} step={1} className="w-full" />
                      </div>

                      {/* Advanced ▾ — Extra Iron / Fuel / Crystal, hidden by default */}
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(v => !v)}
                        className="flex items-center gap-1 text-[10px] font-display uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-toggle-advanced-attack"
                      >
                        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Advanced
                        {!showAdvanced && (extraIron > 0 || extraFuel > 0 || extraCrystal > 0) && (
                          <span className="text-cyan-400 normal-case">· boosted</span>
                        )}
                      </button>

                      {showAdvanced && (
                        <div className="space-y-2 pl-2 border-l border-border/40">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-display uppercase flex items-center gap-1 text-muted-foreground"><Pickaxe className="w-2.5 h-2.5 text-iron" /> Extra Iron</span>
                              <span className="font-mono text-[10px]">{extraIron}</span>
                            </div>
                            <Slider value={[extraIron]} onValueChange={([v]) => setExtraIron(v)} min={0} max={Math.max(0, player.iron - baseCostIron)} step={10} className="w-full" />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-display uppercase flex items-center gap-1 text-muted-foreground"><Fuel className="w-2.5 h-2.5 text-fuel" /> Extra Fuel</span>
                              <span className="font-mono text-[10px]">{extraFuel}</span>
                            </div>
                            <Slider value={[extraFuel]} onValueChange={([v]) => setExtraFuel(v)} min={0} max={Math.max(0, player.fuel - baseCostFuel)} step={10} className="w-full" />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-display uppercase flex items-center gap-1 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Crystal</span>
                              <span className="font-mono text-[10px] text-cyan-400">{extraCrystal}</span>
                            </div>
                            <Slider value={[extraCrystal]} onValueChange={([v]) => setExtraCrystal(v)} min={0} max={Math.max(0, player.crystal)} step={1} className="w-full" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Power display */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-card border border-border rounded-md">
                      <div><p className="text-[9px] text-muted-foreground uppercase font-display">Your Power</p><p className="font-mono text-lg font-bold text-primary">{Math.round(attackerPower)}</p></div>
                      <div><p className="text-[9px] text-muted-foreground uppercase font-display">Defender</p><p className="font-mono text-lg font-bold text-destructive">{defenderPower > 0 ? Math.round(defenderPower) : "?"}</p></div>
                    </div>
                    {defenderPower > 0 && (
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="text-muted-foreground font-display uppercase">Win Chance</span>
                        <Badge variant={winChance > 60 ? "default" : winChance > 40 ? "secondary" : "destructive"} className="font-mono">{Math.round(winChance)}%</Badge>
                      </div>
                    )}

                    {/* Battle status */}
                    <div className="flex items-center justify-between text-[9px] font-mono px-1">
                      <span className="text-muted-foreground font-display uppercase">
                        Battles Active · {activeBattleCount}/{maxConcurrent}
                      </span>
                      {activeCommander && activeCommander.lockedUntil && serverNow() < activeCommander.lockedUntil && (
                        <span className="text-warning flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Commander Locked · {formatCountdown(activeCommander.lockedUntil - serverNow())}
                        </span>
                      )}
                    </div>

                    {/* Warnings */}
                    {(!canAfford || !hasCommander || allCommandersLocked || isOnCooldown || atMaxCapacity || targetEngaged) && (
                      <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md space-y-1 text-[9px] text-yellow-400">
                        {!canAfford && <p className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Insufficient resources</p>}
                        {!hasCommander && <p className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Mint a Commander to attack</p>}
                        {allCommandersLocked && hasCommander && <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> All commanders on cooldown</p>}
                        {isOnCooldown && <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> Attack cooldown active</p>}
                        {atMaxCapacity && <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> Maximum active battles reached</p>}
                        {targetEngaged && <p className="flex items-center gap-1"><Target className="w-3 h-3" /> Target already engaged</p>}
                      </div>
                    )}

                    {/* Combat warning */}
                    <p className="text-[9px] text-muted-foreground flex items-center gap-1.5" data-testid="commander-combat-warning">
                      <Clock className="w-3 h-3 shrink-0 text-destructive" />
                      Battle resolves in {Math.round(BATTLE_DURATION_MS / 60000)} min · resources spent now.
                    </p>

                    {/* Launch sub-parcel */}
                    <Button
                      variant="destructive"
                      className="w-full font-display uppercase tracking-wide bg-orange-600 hover:bg-orange-700 border-orange-500"
                      onClick={handleLaunchSubParcelAttack}
                      disabled={!canAfford || !hasCommander || allCommandersLocked || !selectedSubParcelId || subParcelAttackMutation.isPending}
                    >
                      <Target className="w-4 h-4 mr-2" />
                      {subParcelAttackMutation.isPending ? "Attacking…" : "Launch Sub-Parcel Strike"}
                    </Button>
                  </>
                ) : (
                  <BattlePlanner
                    player={player}
                    allParcels={allParcels}
                    ownedParcels={ownedParcels}
                    selectedParcel={selectedParcel}
                    onSelectTarget={onSelectTarget ?? (() => {})}
                    sourceParcelId={sourceParcelId}
                    onSourceParcelChange={(id) => setSourceParcelId(id)}
                    troops={troops}
                    onTroopsChange={setTroops}
                    extraIron={extraIron}
                    onExtraIronChange={setExtraIron}
                    extraFuel={extraFuel}
                    onExtraFuelChange={setExtraFuel}
                    extraCrystal={extraCrystal}
                    onExtraCrystalChange={setExtraCrystal}
                    battles={battles}
                    onAttack={onAttack ?? (() => {})}
                    isAttacking={isAttacking}
                    onOpenMap={onOpenMap}
                  />
                )}

                {/* Sub-parcel attack error */}
                {subParcelAttackMutation.isError && (
                  <p className="text-[9px] text-destructive">{(subParcelAttackMutation.error as Error)?.message}</p>
                )}

                {/* Battle result */}
                {lastBattleResult && <BattleResultCard result={lastBattleResult} />}
              </div>
            )}
          </div>

          {/* ── Special Attacks ── */}
          {activeCommander && (
            <div>
              <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Special Attacks
              </h3>
              <p className="text-[9px] text-muted-foreground mb-2">Select a target plot on the map, then use a special attack from LandSheet</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(SPECIAL_ATTACK_INFO) as [SpecialAttackType, (typeof SPECIAL_ATTACK_INFO)[SpecialAttackType]][]).map(([type, info]) => {
                  const Icon = ATTACK_ICONS[type];
                  const isAvailable = info.requiredTier.includes(activeCommander.tier);
                  const record = player.specialAttacks.find(sa => sa.type === type);
                  const isOnCooldownSA = record ? (serverNow() - record.lastUsedTs) < info.cooldownMs : false;
                  const cooldownRemaining = record ? Math.max(0, info.cooldownMs - (serverNow() - record.lastUsedTs)) : 0;
                  return (
                    <div key={type} className={cn("p-2 rounded-md border text-left", !isAvailable ? "border-border opacity-40" : isOnCooldownSA ? "border-warning/40" : "border-border")}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon className="w-3 h-3" style={{ color: isAvailable ? TIER_COLORS[activeCommander.tier] : undefined }} />
                        <span className="text-[9px] font-display uppercase font-bold">{info.name}</span>
                      </div>
                      <span className="text-[8px] text-muted-foreground block">{info.effect}</span>
                      <div className="flex items-center gap-2 mt-1 text-[8px] font-mono">
                        <span>{info.costAscend} ASCEND</span>
                        {isOnCooldownSA && <span className="text-warning flex items-center gap-0.5"><Clock className="w-2 h-2" />{formatCountdown(cooldownRemaining)}</span>}
                      </div>
                      {!isAvailable && <span className="text-[8px] text-destructive">Req. {info.requiredTier.join("/")}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Recon Drones ── */}
          <div data-testid="drone-section">
            <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Radar className="w-3 h-3" /> Recon Drones ({activeDrones.length}/{MAX_DRONES})
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <img src={droneImg} alt="Recon Drone" className="w-9 h-9 rounded-md object-cover" />
              <span className="text-[9px] text-muted-foreground flex-1">Scout enemy territory. {DRONE_MINT_COST_ASCEND} ASCEND each.</span>
              <Button size="sm" onClick={() => onDeployDrone()} disabled={isDeployingDrone || activeDrones.length >= MAX_DRONES || player.ascend < DRONE_MINT_COST_ASCEND} className="font-display uppercase text-xs shrink-0" data-testid="button-deploy-drone">
                <Radio className="w-3 h-3 mr-1" />{isDeployingDrone ? "…" : "Deploy"}
              </Button>
            </div>
            {activeDrones.length > 0 ? (
              <div className="space-y-2">{activeDrones.map((d, i) => <DroneCard key={d.id} drone={d} index={i} />)}</div>
            ) : (
              <div className="text-center py-3 text-muted-foreground"><Radar className="w-5 h-5 mx-auto mb-1 opacity-30" /><p className="text-[9px]">No drones deployed</p></div>
            )}
          </div>

          {/* ── Orbital Satellites ── */}
          <div data-testid="satellite-section">
            <h3 className="text-[10px] font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Satellite className="w-3 h-3" /> Orbital Satellites ({activeSatellites.length}/{MAX_SATELLITES})
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-md bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <Satellite className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-[9px] text-muted-foreground flex-1">+{SATELLITE_YIELD_BONUS * 100}% yield · 1h · {SATELLITE_DEPLOY_COST_ASCEND} ASCEND</span>
              <Button size="sm" onClick={() => onDeploySatellite()} disabled={isDeployingSatellite || activeSatellites.length >= MAX_SATELLITES || player.ascend < SATELLITE_DEPLOY_COST_ASCEND} className="font-display uppercase text-xs shrink-0" data-testid="button-deploy-satellite">
                <Satellite className="w-3 h-3 mr-1" />{isDeployingSatellite ? "…" : "Launch"}
              </Button>
            </div>
            {activeSatellites.length > 0 ? (
              <div className="space-y-2">{activeSatellites.map((s, i) => <SatelliteCard key={s.id} satellite={s} index={i} />)}</div>
            ) : (
              <div className="text-center py-3 text-muted-foreground"><Satellite className="w-5 h-5 mx-auto mb-1 opacity-30" /><p className="text-[9px]">No satellites in orbit</p></div>
            )}
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
