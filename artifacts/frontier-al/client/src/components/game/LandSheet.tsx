import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, resolveApiUrl } from "@/lib/queryClient";
import { X, Shield, Pickaxe, Fuel, Gem, MapPin, Swords, Hammer, ShoppingCart, ChevronUp, Coins, Target, Zap, Crosshair, Skull, PackageCheck, ExternalLink, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ATTACK_ICONS } from "@/lib/attackIcons";
import { SubParcelGrid } from "./land/SubParcelGrid";
import { CooldownTimer } from "./land/CooldownTimer";
import { GameTerminal } from "./GameTerminal";
import type { TerminalCommand } from "@/lib/terminalCommands";
import type { LandParcel, Player, ImprovementType, SpecialAttackType, DefenseImprovementType, FacilityType, BiomeType } from "@shared/schema";
import { biomeColors, biomeBonuses, MINE_COOLDOWN_MS, UPGRADE_COSTS, DEFENSE_IMPROVEMENT_INFO, FACILITY_INFO, IMPROVEMENT_INFO, SPECIAL_ATTACK_INFO, BASE_YIELD, TERRAFORM_COSTS, TERRAFORM_BIOME_MAP } from "@shared/schema";
import { ZClass } from "@/lib/uiLayers";

interface LandSheetProps {
  parcel: LandParcel | null;
  player: Player | null;
  onMine: () => void;
  onUpgrade: (type: string) => void;
  onAttack: () => void;
  onBuild: (type: ImprovementType) => void;
  onPurchase: () => void;
  onSpecialAttack?: (type: SpecialAttackType) => void;
  onClose: () => void;
  isMining: boolean;
  isUpgrading: boolean;
  isBuilding: boolean;
  isPurchasing: boolean;
  isWalletConnected: boolean;
  isSpecialAttacking?: boolean;
  nftInfo?: { assetId: number; inCustody: boolean } | null;
  onDeliverNft?: () => void;
  isDeliveringNft?: boolean;
  onNavigateToPlot?: () => void;
}

export function LandSheet({
  parcel,
  player,
  onMine,
  onUpgrade,
  onAttack,
  onBuild,
  onPurchase,
  onSpecialAttack,
  onClose,
  isMining,
  isUpgrading,
  isBuilding,
  isPurchasing,
  isWalletConnected,
  isSpecialAttacking,
  nftInfo,
  onDeliverNft,
  isDeliveringNft,
  onNavigateToPlot,
}: LandSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTerraformPanel, setShowTerraformPanel] = useState(false);
  const [pendingBiome, setPendingBiome] = useState<string | null>(null);
  const [lastTerraformResult, setLastTerraformResult] = useState<{ fromBiome: string; toBiome: string; level: number } | null>(null);
  const [advisorGoal, setAdvisorGoal] = useState<"defense" | "yield" | "balanced">("balanced");
  const { data: terraformAdvice, isFetching: adviceLoading } = useQuery<{
    recommendedBiome: string; recommendedAction: string; rationale: string; source: string;
  }>({
    queryKey: [`/api/plots/${parcel?.plotId}/terraform-advice`, advisorGoal],
    queryFn: async () => {
      const r = await fetch(resolveApiUrl(`/api/plots/${parcel!.plotId}/terraform-advice?goal=${advisorGoal}`));
      if (!r.ok) throw new Error("advice unavailable");
      return r.json();
    },
    enabled: showTerraformPanel && !!parcel,
    staleTime: 30_000,
  });

  const TERRAFORM_COST = TERRAFORM_COSTS.convert_biome;

  const terraformMutation = useMutation({
    mutationFn: (targetBiome: string) =>
      apiRequest("POST", `/api/plots/${parcel?.plotId}/terraform`, {
        playerId: player?.id,
        action: { type: "convert_biome", targetBiome },
      }),
    onSuccess: (_data, targetBiome) => {
      const toBiome = TERRAFORM_BIOME_MAP[targetBiome] ?? targetBiome;
      setLastTerraformResult({
        fromBiome: parcel?.biome ?? "unknown",
        toBiome,
        level: (parcel?.terraformLevel ?? 0) + 1,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
      setShowTerraformPanel(false);
      setPendingBiome(null);
    },
  });

  if (!parcel) return null;

  const isOwned = parcel.ownerId === player?.id;
  const isEnemyOwned = parcel.ownerId && parcel.ownerId !== player?.id;
  const isUnclaimed = !parcel.ownerId;
  const canMine = isOwned && Date.now() - parcel.lastMineTs >= MINE_COOLDOWN_MS;
  // Dev/test player can never claim — never treat its plots as escrow-locked, so
  // mining/upgrades stay unlocked and no claim prompt shows.
  const inCustody = !!nftInfo?.inCustody;
  const biomeBonus = biomeBonuses[parcel.biome];
  const totalStored = parcel.ironStored + parcel.fuelStored + parcel.crystalStored;
  const storagePercent = (totalStored / parcel.storageCapacity) * 100;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 md:left-60 md:right-60 lg:left-72 lg:right-72 transition-all duration-300 ease-out",
        ZClass.plotSheet, // was hardcoded z-40 — sat BELOW the mobile bottom nav (z-50), invisible on mobile
        expanded ? "max-h-[75vh]" : "max-h-[280px]"
      )}
      data-testid="land-sheet"
    >
      <div className="mx-2 backdrop-blur-xl bg-gradient-to-b from-card/95 to-card/85 border border-border/60 rounded-t-xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: expanded ? "75vh" : "280px" }}>
        <div
          className="h-2 w-full shrink-0"
          style={{ backgroundColor: biomeColors[parcel.biome] }}
        />

        <div className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shadow-md"
                style={{ backgroundColor: biomeColors[parcel.biome] + "35", border: `2px solid ${biomeColors[parcel.biome]}30` }}
              >
                <MapPin className="w-5 h-5" style={{ color: biomeColors[parcel.biome] }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold uppercase tracking-wide" data-testid="text-plot-id">
                    Plot #{parcel.plotId}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize font-semibold">{parcel.biome}</Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] mt-0.5">
                  {isOwned && <span className="text-primary font-display uppercase font-semibold">Your Territory</span>}
                  {isEnemyOwned && <span className="text-destructive font-display uppercase font-semibold">Enemy Territory</span>}
                  {isUnclaimed && <span className="font-display uppercase">Unclaimed</span>}
                  <span className="text-primary font-mono font-semibold">{parcel.ascendPerDay.toFixed(1)} ASCEND/day</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-muted/40"
                onClick={() => setExpanded(!expanded)}
                data-testid="button-expand-sheet"
              >
                <ChevronUp className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-muted/40"
                onClick={onClose}
                data-testid="button-close-sheet"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Biome yield profile */}
          <div className="mb-2 px-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-display uppercase tracking-wide mb-1">
              <span style={{ color: biomeColors[parcel.biome] }}>■</span>
              <span>{parcel.biome} zone</span>
              {(parcel.terraformStatus && parcel.terraformStatus !== "none") && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[8px] px-1.5 py-0 ml-auto font-display uppercase tracking-wide",
                    parcel.terraformStatus === "active"   && "border-emerald-500/60 text-emerald-400",
                    parcel.terraformStatus === "degraded" && "border-orange-500/60 text-orange-400"
                  )}
                >
                  <Layers className="w-2 h-2 mr-0.5 inline" />
                  Lvl {parcel.terraformLevel ?? 0}
                  {parcel.terraformStatus === "degraded" ? " ⚠ Degraded" : " Terraformed"}
                </Badge>
              )}
            </div>
            <div className="flex gap-3 font-mono text-[9px] text-muted-foreground">
              <span className="text-iron">⛏ ×{biomeBonus.ironMod.toFixed(1)} iron</span>
              <span className="text-fuel">⛽ ×{biomeBonus.fuelMod.toFixed(1)} fuel</span>
              <span className="text-purple-400">💎 ×{biomeBonus.crystalMod.toFixed(1)} crystal</span>
            </div>
            {(parcel.terraformStatus && parcel.terraformStatus !== "none" && parcel.terraformedAt) && (
              <div className="mt-1 text-[8px] text-muted-foreground font-mono flex gap-2 flex-wrap">
                <span>Last: {parcel.terraformType?.replace(/_/g, " ") ?? "—"}</span>
                <span>·</span>
                <span>{new Date(parcel.terraformedAt).toLocaleDateString()}</span>
                <span>·</span>
                <span>Hazard {parcel.hazardLevel ?? 0}%</span>
                <span>·</span>
                <span>Stability {parcel.stability ?? 100}%</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-primary/40 transition-colors">
              <Shield className={cn("w-4 h-4 mx-auto mb-1", parcel.defenseLevel > 5 ? "text-green-500" : parcel.defenseLevel > 2 ? "text-yellow-500" : "text-red-500")} />
              <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Defense</span>
              <span className="font-mono text-sm font-bold" data-testid="text-defense-level">{parcel.defenseLevel}</span>
              <span className="text-[8px] text-muted-foreground block">{(parcel.defenseLevel * 15).toFixed(0)} power</span>
            </div>
            <div className={cn(
              "p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center transition-colors",
              (parcel.influence ?? 100) > 66 ? "hover:border-green-500/40"
                : (parcel.influence ?? 100) > 33 ? "hover:border-yellow-500/40"
                : "border-red-500/30 hover:border-red-500/40"
            )}>
              <div className={cn("w-4 h-4 mx-auto mb-1", (parcel.influence ?? 100) > 66 ? "text-green-400" : (parcel.influence ?? 100) > 33 ? "text-yellow-400" : "text-red-400")}>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z"/></svg>
              </div>
              <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Influence</span>
              <span className={cn("font-mono text-sm font-bold", (parcel.influence ?? 100) > 66 ? "text-green-400" : (parcel.influence ?? 100) > 33 ? "text-yellow-400" : "text-red-400")}>
                {parcel.influence ?? 100}%
              </span>
              {(parcel.influence ?? 100) < 20 && <p className="text-[8px] text-red-400 uppercase font-bold mt-0.5">⚠ Blocked</p>}
            </div>
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-primary/40 transition-colors">
              <MapPin className="w-4 h-4 mx-auto mb-1 text-amber-500" />
              <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Richness</span>
              <span className="font-mono text-sm font-bold">{Math.round(parcel.richness)}%</span>
            </div>
          </div>
          {/* Stored-resource intel is fog-of-war: only the owner sees exact
              amounts. For enemy/unclaimed plots the server redacts these values,
              so we show a classified placeholder instead of a misleading 0.
              Sanctioned target intel comes from the War Room (attackable list). */}
          {isOwned ? (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-iron/40 transition-colors">
                <Pickaxe className="w-4 h-4 mx-auto mb-1 text-iron" />
                <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Iron</span>
                <span className="font-mono text-sm font-bold text-iron">{parcel.ironStored}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-fuel/40 transition-colors">
                <Fuel className="w-4 h-4 mx-auto mb-1 text-fuel" />
                <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Fuel</span>
                <span className="font-mono text-sm font-bold text-fuel">{parcel.fuelStored}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 text-center hover:border-purple-400/40 transition-colors">
                <Gem className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                <span className="text-[9px] text-muted-foreground block font-display uppercase tracking-wide">Crystal</span>
                <span className="font-mono text-sm font-bold text-purple-400">{parcel.crystalStored}</span>
              </div>
            </div>
          ) : (
            <div className="mb-3 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center">
              <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wide">
                🔒 Stored resources classified — recon required
              </span>
            </div>
          )}

          {/* 24h Resource Yield Forecast */}
          {(() => {
            const richMult = parcel.richness / 100;
            const influenceMult = Math.min(1, Math.max(0, (parcel.influence ?? 100) / 100));
            const yieldMult = parcel.yieldMultiplier ?? 1.0;
            const ironPerMine    = Math.floor(BASE_YIELD.iron    * biomeBonus.ironMod    * richMult * influenceMult * yieldMult);
            const fuelPerMine    = Math.floor(BASE_YIELD.fuel    * biomeBonus.fuelMod    * richMult * influenceMult * yieldMult);
            const crystalPerMine = Math.floor(BASE_YIELD.crystal * biomeBonus.crystalMod * richMult * influenceMult * yieldMult);
            const minesPerDay = Math.floor((24 * 60 * 60 * 1000) / MINE_COOLDOWN_MS);
            return (
              <div className="mb-2 px-1 py-1.5 rounded-md bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-1.5 text-[9px] text-primary/70 font-display uppercase tracking-wide mb-1">
                  <Pickaxe className="w-2.5 h-2.5" />
                  <span>Per-Mine Yield</span>
                  {yieldMult !== 1.0 && (
                    <span className="text-amber-400">×{yieldMult.toFixed(1)} orbital</span>
                  )}
                </div>
                <div className="flex gap-3 font-mono text-[10px]">
                  <span className="text-iron">⛏ +{ironPerMine} iron</span>
                  <span className="text-fuel">⛽ +{fuelPerMine} fuel</span>
                  <span className="text-purple-400">💎 +{crystalPerMine} xtal</span>
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                  ~{minesPerDay}× daily capacity · {(ironPerMine * minesPerDay).toLocaleString()} iron/day max
                </div>
              </div>
            );
          })()}

          {isOwned && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground font-display uppercase">Storage {totalStored}/{parcel.storageCapacity}</span>
                <span className="font-mono">{Math.round(storagePercent)}%</span>
              </div>
              <Progress value={storagePercent} className="h-1" />
              <CooldownTimer lastMineTs={parcel.lastMineTs} />
            </div>
          )}

          {/* ── NFT Claim Banner (top of action area) ── */}
          {nftInfo && (
            <div className={cn(
              "p-2.5 rounded-lg border",
              inCustody
                ? "bg-amber-500/10 border-amber-500/40"
                : "bg-primary/5 border-primary/20"
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <PackageCheck className={cn("w-4 h-4 shrink-0", inCustody ? "text-amber-400" : "text-primary")} />
                  <div className="min-w-0">
                    <span className={cn("text-xs font-display uppercase tracking-wide font-bold block", inCustody ? "text-amber-400" : "text-primary")}>
                      {inCustody ? "NFT Awaiting Claim" : "Plot NFT"}
                    </span>
                    {inCustody && (
                      <span className="text-[9px] text-amber-300/70">Claim to unlock mining &amp; upgrades</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`https://explorer.perawallet.app/assets/${nftInfo.assetId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-muted-foreground font-mono hover:text-primary transition-colors"
                  >
                    ASA {nftInfo.assetId} ↗
                  </a>
                  {inCustody && onDeliverNft && (
                    <Button
                      size="sm"
                      onClick={onDeliverNft}
                      disabled={isDeliveringNft}
                      className="h-7 px-3 text-[10px] font-display uppercase tracking-wide bg-amber-500 hover:bg-amber-600 text-black border-0"
                    >
                      {isDeliveringNft ? (
                        <><ExternalLink className="w-3 h-3 mr-1 animate-pulse" />Claiming…</>
                      ) : (
                        <><PackageCheck className="w-3 h-3 mr-1" />Claim NFT</>
                      )}
                    </Button>
                  )}
                  {!inCustody && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-green-400 border-green-500/30 bg-green-500/10">In Wallet ✓</Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sub-parcel grid — shown for owned plots and subdivided plots */}
          {(parcel.isSubdivided || isOwned) && (
            <SubParcelGrid parcel={parcel} player={player} onNavigate={onNavigateToPlot} />
          )}

          {/* Command console — type "mine"/"upgrade"/"claim" or click the [bracketed] word */}
          {isOwned && (() => {
            const consoleCommands: TerminalCommand[] = [];
            if (inCustody && onDeliverNft) {
              consoleCommands.push({
                keyword: "claim",
                label: "claim",
                run: onDeliverNft,
                disabled: !!isDeliveringNft,
              });
            } else {
              consoleCommands.push({
                keyword: "mine",
                aliases: ["m", "extract"],
                label: "mine",
                run: onMine,
                disabled: !canMine || isMining,
              });
              consoleCommands.push({
                keyword: "upgrade",
                aliases: ["u"],
                label: "upgrade",
                run: () => setExpanded(true),
              });
            }
            return (
              <div className="mb-2">
                <GameTerminal
                  accent="cyan"
                  title="Command Console"
                  lines={[
                    inCustody
                      ? "NFT awaiting claim — mining & upgrades locked."
                      : "Type [mine] to extract resources, or [upgrade] to open the upgrade panel.",
                  ]}
                  commands={consoleCommands}
                  testId="land-sheet-terminal"
                />
              </div>
            );
          })()}

          <div className="flex gap-2">
            {isOwned && (
              <>
                <Button
                  size="sm"
                  onClick={onMine}
                  disabled={!canMine || isMining || !!inCustody}
                  className={cn(
                    "flex-1 font-display uppercase tracking-wide text-xs font-semibold",
                    canMine && !isMining && !inCustody && "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg",
                    !!inCustody && "opacity-50 cursor-not-allowed"
                  )}
                  data-testid="button-mine"
                  title={inCustody ? "Claim your NFT first to unlock mining" : undefined}
                >
                  <Pickaxe className="w-4 h-4 mr-1.5" />
                  {isMining ? "Mining..." : inCustody ? "NFT Required" : "Mine"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setExpanded(true)}
                  disabled={!!inCustody}
                  className={cn("font-display uppercase tracking-wide text-xs font-semibold", !!inCustody && "opacity-50 cursor-not-allowed")}
                  data-testid="button-upgrade"
                  title={inCustody ? "Claim your NFT first to unlock upgrades" : undefined}
                >
                  <Hammer className="w-3.5 h-3.5 mr-1" />
                  Upgrade ↑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowTerraformPanel(v => !v); setPendingBiome(null); }}
                  disabled={!player}
                  className={cn(
                    "font-display uppercase tracking-wide text-xs font-semibold",
                    showTerraformPanel && "border-primary text-primary"
                  )}
                  data-testid="button-terraform"
                >
                  <Layers className="w-3.5 h-3.5 mr-1" />
                  Terraform
                </Button>
              </>
            )}
            {isEnemyOwned && player && parcel.biome !== "water" && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onAttack}
                  className="flex-1 font-display uppercase tracking-wide text-xs"
                  data-testid="button-attack"
                >
                  <Swords className="w-3.5 h-3.5 mr-1" />
                  Attack
                </Button>
              </>
            )}
            {isUnclaimed && player && parcel.purchasePriceAlgo !== null && (
              <Button
                size="sm"
                onClick={onPurchase}
                disabled={isPurchasing || !isWalletConnected}
                className="flex-1 font-display uppercase tracking-wide text-xs"
                data-testid="button-purchase"
              >
                <Coins className="w-3.5 h-3.5 mr-1" />
                {`Purchase (${parcel.purchasePriceAlgo} ALGO)`}
              </Button>
            )}
          </div>

          {showTerraformPanel && isOwned && (() => {
            const canAffordTerraform = !!player && player.ascend >= TERRAFORM_COST;
            const currentProtoKey = Object.keys(TERRAFORM_BIOME_MAP).find(
              k => TERRAFORM_BIOME_MAP[k] === parcel.biome
            );
            return (
              <div className="mt-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 space-y-2">
                {/* Terraforming advisor — heuristic by default, AI when configured */}
                <div className="rounded border border-primary/20 bg-primary/5 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-display uppercase tracking-wide text-primary flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Advisor
                    </span>
                    <div className="flex gap-1">
                      {(["defense", "yield", "balanced"] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setAdvisorGoal(g)}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-display uppercase tracking-wide transition-colors",
                            advisorGoal === g ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-primary",
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  {adviceLoading && <p className="text-[9px] text-muted-foreground">Analyzing plot…</p>}
                  {!adviceLoading && terraformAdvice && (
                    <div className="space-y-1">
                      <p className="text-[9px] text-foreground/90 leading-snug">{terraformAdvice.rationale}</p>
                      {terraformAdvice.recommendedAction === "convert_biome" && (() => {
                        const proto = Object.keys(TERRAFORM_BIOME_MAP).find(
                          (k) => TERRAFORM_BIOME_MAP[k] === terraformAdvice.recommendedBiome,
                        );
                        if (!proto) return null;
                        return (
                          <button
                            onClick={() => setPendingBiome(proto)}
                            className="text-[8px] font-display uppercase tracking-wide text-primary underline underline-offset-2"
                          >
                            Use recommended → {terraformAdvice.recommendedBiome}
                          </button>
                        );
                      })()}
                      <p className="text-[7px] text-muted-foreground/60">
                        {terraformAdvice.source === "llm" ? "AI advisor" : "heuristic"}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-display uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Layers className="w-3 h-3" /> Select Target Biome
                  </span>
                  <span className="text-[10px] font-mono text-primary">{TERRAFORM_COST} ASCEND</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.entries(TERRAFORM_BIOME_MAP) as [string, BiomeType][]).map(([protoKey, serverBiome]) => {
                    if (protoKey === currentProtoKey) return null;
                    const isSelected = pendingBiome === protoKey;
                    return (
                      <button
                        key={protoKey}
                        onClick={() => setPendingBiome(isSelected ? null : protoKey)}
                        className={cn(
                          "py-1.5 px-2 rounded border text-[9px] font-display uppercase tracking-wide transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/40 hover:border-primary/40"
                        )}
                        style={{ color: isSelected ? undefined : biomeColors[serverBiome] }}
                      >
                        {serverBiome}
                      </button>
                    );
                  })}
                </div>
                {pendingBiome && (
                  <Button
                    size="sm"
                    className="w-full font-display uppercase text-[10px]"
                    onClick={() => terraformMutation.mutate(pendingBiome)}
                    disabled={!canAffordTerraform || terraformMutation.isPending}
                  >
                    {terraformMutation.isPending
                      ? "Terraforming..."
                      : `Confirm → ${TERRAFORM_BIOME_MAP[pendingBiome]} (${TERRAFORM_COST} ASCEND)`}
                  </Button>
                )}
                {!canAffordTerraform && (
                  <p className="text-[9px] text-destructive font-mono">
                    Insufficient ASCEND — need {TERRAFORM_COST}, have {player?.ascend ?? 0}
                  </p>
                )}
                {terraformMutation.isError && (
                  <p className="text-[9px] text-destructive">
                    {String((terraformMutation.error as any)?.message ?? "Terraform failed")}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Terraform success confirmation */}
          {lastTerraformResult && (
            <div className="mt-2 p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between gap-2">
              <div className="text-[9px] font-mono text-emerald-400">
                <Layers className="w-3 h-3 inline mr-1" />
                <span className="capitalize">{lastTerraformResult.fromBiome}</span>
                <span className="mx-1 text-muted-foreground">→</span>
                <span className="capitalize font-bold" style={{ color: biomeColors[lastTerraformResult.toBiome as BiomeType] ?? undefined }}>
                  {lastTerraformResult.toBiome}
                </span>
                <span className="ml-1.5 text-muted-foreground">Lvl {lastTerraformResult.level}</span>
              </div>
              <button
                className="text-[8px] text-muted-foreground hover:text-foreground"
                onClick={() => setLastTerraformResult(null)}
              >✕</button>
            </div>
          )}

          {expanded && isOwned && (
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              <div>
                <h4 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Defense (Iron/Fuel)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(DEFENSE_IMPROVEMENT_INFO) as [DefenseImprovementType, typeof DEFENSE_IMPROVEMENT_INFO[DefenseImprovementType]][]).map(([type, info]) => {
                    const existing = parcel.improvements.find(i => i.type === type);
                    const atMax = existing && existing.level >= info.maxLevel;
                    const nextLevel = existing ? existing.level + 1 : 1;
                    const cost = { iron: info.cost.iron * nextLevel, fuel: info.cost.fuel * nextLevel };
                    const canAfford = player && player.iron >= cost.iron && player.fuel >= cost.fuel;
                    const needIron = !canAfford && player ? Math.max(0, cost.iron - player.iron) : 0;
                    const needFuel = !canAfford && player ? Math.max(0, cost.fuel - player.fuel) : 0;

                    return (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => onBuild(type)}
                        disabled={isBuilding || !!atMax || !canAfford}
                        className="flex-col items-start h-auto py-2 px-2.5 text-left"
                        data-testid={`button-build-${type}`}
                      >
                        <span className="text-[10px] font-display uppercase tracking-wide">{info.name}</span>
                        <span className="text-[9px] text-primary/70 font-mono">{info.effect}</span>
                        {existing && <span className="text-[9px] text-muted-foreground font-mono">Currently Lv{existing.level} → Lv{nextLevel}</span>}
                        <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                          {atMax ? "✓ MAX" : `${cost.iron}I ${cost.fuel}F`}
                        </span>
                        {!atMax && !canAfford && player && (
                          <span className="text-[8px] text-destructive font-mono">
                            Need {needIron > 0 ? `+${needIron} iron` : ""}{needIron > 0 && needFuel > 0 ? ", " : ""}{needFuel > 0 ? `+${needFuel} fuel` : ""}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-display uppercase tracking-wide text-primary mb-2 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" /> Facilities (ASCEND burned)
                  <span className="ml-auto text-[9px] text-primary/70 font-mono normal-case" data-testid="text-parcel-yield-mult">
                    Yield ×{(parcel.yieldMultiplier ?? 1.0).toFixed(2)}
                  </span>
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FACILITY_INFO) as [FacilityType, typeof FACILITY_INFO[FacilityType]][]).map(([type, info]) => {
                    const existing = parcel.improvements.find(i => i.type === type);
                    const atMax = existing && existing.level >= info.maxLevel;
                    const level = existing ? existing.level + 1 : 1;
                    const cost = atMax ? 0 : info.costAscend[level - 1];
                    const canAfford = player && player.ascend >= cost;
                    const hasPrereq = !info.prerequisite || parcel.improvements.find(i => i.type === info.prerequisite);
                    const perDay = info.ascendPerDay[Math.min(level - 1, info.ascendPerDay.length - 1)];
                    const showsIncome = perDay > 0;

                    return (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => onBuild(type)}
                        disabled={isBuilding || !!atMax || !canAfford || !hasPrereq}
                        className={cn("flex-col items-start h-auto py-2 px-2.5 text-left", !hasPrereq && "opacity-50")}
                        data-testid={`button-build-${type}`}
                      >
                        <span className="text-[10px] font-display uppercase tracking-wide">{info.name}</span>
                        {existing && (
                          <span className="text-[9px] text-primary font-mono">
                            Lv{existing.level}{existing.level < info.maxLevel ? ` → Lv${existing.level + 1}` : " MAX"}
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {atMax ? "✓ MAX" : `${cost} ASCEND`}
                        </span>
                        {showsIncome
                          ? <span className="text-[9px] text-primary/70 font-mono">+{perDay} ASCEND/day</span>
                          : <span className="text-[9px] text-primary/70 font-mono">{info.effect}</span>
                        }
                        {type === "data_centre" && !atMax && (
                          <span className="text-[9px] text-emerald-400/80 font-mono" data-testid="text-data-centre-yield">
                            +{(0.05 * level).toFixed(2)}× yield at Lv{level}
                          </span>
                        )}
                        {!hasPrereq && (
                          <span className="text-[8px] text-destructive flex items-center gap-0.5">
                            🔒 Needs Electricity
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {parcel.improvements.length > 0 && (
                <div>
                  <h4 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-1.5">Active Improvements</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {parcel.improvements.map((imp, i) => {
                      const info = IMPROVEMENT_INFO[imp.type];
                      return (
                        <Badge key={i} variant="secondary" className="text-[10px] flex items-center gap-1">
                          {info?.name || imp.type} Lv{imp.level}
                          {info?.effect && <span className="text-primary/60">· {info.effect.split(" per")[0]}</span>}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              <h4 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Hammer className="w-3.5 h-3.5" /> Plot Upgrades (Iron/Fuel)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(UPGRADE_COSTS).map(([type, cost]) => {
                  const canAfford = player && player.iron >= cost.iron && player.fuel >= cost.fuel;
                  const needIron = !canAfford && player ? Math.max(0, cost.iron - player.iron) : 0;
                  const needFuel = !canAfford && player ? Math.max(0, cost.fuel - player.fuel) : 0;
                  return (
                    <Button
                      key={type}
                      variant="secondary"
                      size="sm"
                      onClick={() => onUpgrade(type)}
                      disabled={isUpgrading || !canAfford}
                      className="flex-col items-start h-auto py-2 px-2.5 text-left"
                      data-testid={`button-upgrade-${type}`}
                    >
                      <span className="text-[10px] font-display uppercase tracking-wide capitalize">{type}</span>
                      <span className="text-[9px] text-primary/70 font-mono">{cost.effect}</span>
                      <span className="text-[9px] text-muted-foreground font-mono mt-0.5">{cost.iron}I {cost.fuel}F</span>
                      {!canAfford && player && (
                        <span className="text-[8px] text-destructive font-mono">
                          Need {needIron > 0 ? `+${needIron} iron` : ""}{needIron > 0 && needFuel > 0 ? ", " : ""}{needFuel > 0 ? `+${needFuel} fuel` : ""}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {expanded && isEnemyOwned && !player?.commander && onSpecialAttack && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground font-mono">
                Mint a Commander to unlock Special Attacks.
              </p>
            </div>
          )}

          {expanded && isEnemyOwned && player?.commander && onSpecialAttack && (
            <div className="mt-3 pt-3 border-t border-border">
              <h4 className="text-xs font-display uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Special Attacks
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(SPECIAL_ATTACK_INFO) as [SpecialAttackType, typeof SPECIAL_ATTACK_INFO[SpecialAttackType]][]).map(([type, info]) => {
                  const Icon = ATTACK_ICONS[type];
                  const isAvailable = info.requiredTier.includes(player.commander!.tier);
                  const record = player.specialAttacks.find(sa => sa.type === type);
                  const isOnCooldown = record ? (Date.now() - record.lastUsedTs) < info.cooldownMs : false;
                  const canAfford = player.ascend >= info.costAscend;

                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => onSpecialAttack(type)}
                      disabled={!isAvailable || isOnCooldown || !canAfford || isSpecialAttacking}
                      className="flex-col items-start h-auto py-2 px-2.5 text-left"
                      data-testid={`button-special-${type}`}
                    >
                      <span className="text-[10px] font-display uppercase tracking-wide flex items-center gap-1">
                        <Icon className="w-3 h-3" /> {info.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {isOnCooldown ? "Cooldown" : `${info.costAscend} ASCEND`}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {parcel.activeBattleId && (
            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded-md flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 text-destructive animate-pulse" />
              <span className="text-xs font-display uppercase tracking-wide text-destructive">Active Battle</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
