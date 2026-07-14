import { useState, useEffect, useMemo, useCallback } from "react";
import { MapPin, Crosshair, Star, Shield, Flame, Droplets, Mountain, Snowflake, Trees, Wind, Swords, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Pickaxe, Fuel, Clock, AlertTriangle, CheckCircle2, Target as TargetIcon, Radio, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { serverNow } from "@/lib/serverClock";
import { COMMANDER_INFO, ATTACK_BASE_COST, type CommanderTier, type LandParcel, type Player, type Battle, type BiomeType } from "@shared/schema";
import { classifyRelationship, type EffectiveFaction } from "@shared/factionIdentity";
import type { PlayerFactionId } from "@shared/waitlist";
import { PLAYER_FACTIONS } from "@/lib/factions";
import { formatCountdown, TIER_COLORS, COMPANION } from "./commander/shared";
import { BattleTargetSelector } from "./BattleTargetSelector";
import {
  sphereDistance,
  formatDistanceLabel,
  evaluateOrigins,
  recommendOrigins,
  evaluateCommanders,
  computeAttackCost,
  remainingBalance,
  isAffordable,
  maxTroopsFor,
  resolveLaunchState,
  LAUNCH_STATE_LABEL,
  isLaunchEnabled,
  PLANNER_STEPS,
  computePlannedPowers,
  projectWinChance,
  type PlannerStep,
  type CommanderEvaluation,
} from "@/lib/battlePlanner";

const BIOME_COLORS: Record<string, string> = {
  arctic: "#93c5fd",
  tundra: "#c4b5fd",
  forest: "#4ade80",
  grassland: "#a3e635",
  desert: "#fbbf24",
  ocean: "#60a5fa",
  mountain: "#a8a29e",
  volcanic: "#f87171",
};

const BIOME_ICONS: Record<string, React.ReactNode> = {
  arctic: <Snowflake className="w-3 h-3" />,
  tundra: <Wind className="w-3 h-3" />,
  forest: <Trees className="w-3 h-3" />,
  grassland: <Mountain className="w-3 h-3" />,
  desert: <Flame className="w-3 h-3" />,
  ocean: <Droplets className="w-3 h-3" />,
  mountain: <Mountain className="w-3 h-3" />,
  volcanic: <Flame className="w-3 h-3" />,
};

function getFactionMeta(factionId: string | null | undefined) {
  if (!factionId) return undefined;
  return PLAYER_FACTIONS.find((f) => f.id === factionId);
}

function relationshipColor(rel: "ally" | "enemy" | "neutral"): string {
  if (rel === "enemy") return "#f87171";
  if (rel === "ally") return "#4ade80";
  return "#94a3b8";
}

export interface BattlePlannerProps {
  player: Player;
  allParcels: LandParcel[];
  ownedParcels: LandParcel[];
  selectedParcel: LandParcel | null | undefined;
  onSelectTarget: (id: string) => void;
  sourceParcelId: string | null;
  onSourceParcelChange: (id: string) => void;
  troops: number;
  onTroopsChange: (n: number) => void;
  extraIron: number;
  onExtraIronChange: (n: number) => void;
  extraFuel: number;
  onExtraFuelChange: (n: number) => void;
  extraCrystal: number;
  onExtraCrystalChange: (n: number) => void;
  battles: Battle[];
  onAttack: (
    troops: number,
    iron: number,
    fuel: number,
    crystal: number,
    commanderId?: string,
    sourceParcelId?: string,
  ) => void;
  isAttacking?: boolean;
  onOpenMap?: () => void;
}

export function BattlePlanner({
  player,
  allParcels,
  ownedParcels,
  selectedParcel,
  onSelectTarget,
  sourceParcelId,
  onSourceParcelChange,
  troops,
  onTroopsChange,
  extraIron,
  onExtraIronChange,
  extraFuel,
  onExtraFuelChange,
  extraCrystal,
  onExtraCrystalChange,
  battles,
  onAttack,
  isAttacking,
  onOpenMap,
}: BattlePlannerProps) {
  const now = serverNow();
  const commanders = player.commanders || [];
  const attacking = !!isAttacking;

  const [step, setStep] = useState<PlannerStep>("target");
  const [selectedCommanderId, setSelectedCommanderId] = useState<string | null>(
    player.commander?.id ?? commanders[0]?.id ?? null,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  // An invalid / cleared target resets dependent draft state safely.
  useEffect(() => {
    if (!selectedParcel) {
      setStep("target");
      setSelectedCommanderId(commanders[0]?.id ?? null);
    }
  }, [selectedParcel, commanders]);

  const cost = useMemo(
    () => computeAttackCost(troops, extraIron, extraFuel, extraCrystal),
    [troops, extraIron, extraFuel, extraCrystal],
  );
  const remaining = useMemo(() => remainingBalance(player, cost), [player, cost]);
  const affordable = useMemo(() => isAffordable(player, cost), [player, cost]);
  const maxTroops = useMemo(() => maxTroopsFor(player), [player]);

  const originEvals = useMemo(
    () => evaluateOrigins(ownedParcels, selectedParcel, battles),
    [ownedParcels, selectedParcel, battles],
  );
  const recommendedOriginsList = useMemo(
    () => recommendOrigins(ownedParcels, selectedParcel, battles),
    [ownedParcels, selectedParcel, battles],
  );
  const recommendedOriginId = recommendedOriginsList.find((p) => p.id !== selectedParcel?.id)?.id ?? null;
  const sourceParcel = useMemo(
    () => ownedParcels.find((p) => p.id === sourceParcelId) ?? null,
    [ownedParcels, sourceParcelId],
  );

  const commanderEvals = useMemo(
    () => evaluateCommanders(commanders, battles, now),
    [commanders, battles, now],
  );
  const selectedCommanderEval = useMemo(
    () => commanderEvals.find((e) => e.commander.id === selectedCommanderId) ?? null,
    [commanderEvals, selectedCommanderId],
  );

  const launchState = useMemo(
    () =>
      resolveLaunchState({
        target: selectedParcel,
        sourceParcelId,
        selectedCommander: selectedCommanderEval,
        player,
        cost,
        attacking,
        now,
      }),
    [selectedParcel, sourceParcelId, selectedCommanderEval, player, cost, attacking, now],
  );

  // Advisory outcome preview — re-projects whenever the plan inputs change.
  const plannedPowers = useMemo(
    () =>
      computePlannedPowers({
        troops,
        extraIron,
        extraFuel,
        extraCrystal,
        commanderAttackBonus: selectedCommanderEval?.commander.attackBonus ?? 0,
        targetDefenseLevel: selectedParcel?.defenseLevel ?? 0,
        targetBiome: (selectedParcel?.biome ?? "plains") as BiomeType,
      }),
    [troops, extraIron, extraFuel, extraCrystal, selectedCommanderEval, selectedParcel],
  );
  const projectedWinChance = useMemo(
    () => projectWinChance({
      troops,
      extraIron,
      extraFuel,
      extraCrystal,
      commanderAttackBonus: selectedCommanderEval?.commander.attackBonus ?? 0,
      targetDefenseLevel: selectedParcel?.defenseLevel ?? 0,
      targetBiome: (selectedParcel?.biome ?? "plains") as BiomeType,
    }),
    [troops, extraIron, extraFuel, extraCrystal, selectedCommanderEval, selectedParcel],
  );

  const playerFaction = player.playerFactionId as PlayerFactionId | null | undefined;
  const targetRelationship: "ally" | "enemy" | "neutral" = useMemo(() => {
    if (selectedParcel?.effectiveFaction && playerFaction) {
      return classifyRelationship(playerFaction, selectedParcel.effectiveFaction as EffectiveFaction);
    }
    return "neutral";
  }, [selectedParcel, playerFaction]);

  const targetFactionMeta = getFactionMeta(selectedParcel?.effectiveFaction);
  const distanceToTarget = useMemo(
    () => (sourceParcel && selectedParcel ? sphereDistance(sourceParcel.lat, sourceParcel.lng, selectedParcel.lat, selectedParcel.lng) : null),
    [sourceParcel, selectedParcel],
  );

  const stepIndex = (s: PlannerStep) => PLANNER_STEPS.findIndex((x) => x.id === s);

  const canAdvanceFrom = useCallback(
    (s: PlannerStep): boolean => {
      switch (s) {
        case "target":
          return !!selectedParcel;
        case "origin":
          return !!sourceParcelId;
        case "commander":
          return !!selectedCommanderEval;
        case "commitment":
          return true;
        case "review":
          return true;
        default:
          return false;
      }
    },
    [selectedParcel, sourceParcelId, selectedCommanderEval],
  );

  const footerAction = () => {
    if (step === "review" || step === "launch") {
      if (isLaunchEnabled(launchState) && selectedCommanderEval) {
        onAttack(troops, cost.iron, cost.fuel, cost.crystal, selectedCommanderEval.commander.id, sourceParcelId ?? undefined);
      }
      return;
    }
    const order: PlannerStep[] = ["target", "origin", "commander", "commitment", "review"];
    const idx = order.indexOf(step);
    if (idx >= 0 && idx < order.length - 1 && canAdvanceFrom(step)) {
      setStep(order[idx + 1]);
    }
  };

  const footerLabel = () => {
    if (step === "review" || step === "launch") return LAUNCH_STATE_LABEL[launchState];
    if (step === "target") return "Select Origin";
    if (step === "origin") return "Choose Commander";
    if (step === "commander") return "Set Commitment";
    if (step === "commitment") return "Review Attack";
    return "Continue";
  };

  const footerDisabled = () => {
    if (step === "review" || step === "launch") return !isLaunchEnabled(launchState);
    return !canAdvanceFrom(step);
  };

  const setTroopsSafe = (n: number) => onTroopsChange(Math.min(maxTroops, Math.max(1, n)));

  return (
    <div className="flex flex-col" data-testid="battle-planner">
      {/* ── Compact stepper ── */}
      <div className="flex items-center gap-0.5 mb-2 overflow-x-auto no-scrollbar" data-testid="planner-stepper">
        {PLANNER_STEPS.map((s, i) => {
          const active = step === s.id;
          const done = stepIndex(step) > i;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              data-testid={`planner-step-${s.id}`}
              className={cn(
                "flex items-center gap-1 px-1.5 py-1 rounded text-[9px] font-display uppercase tracking-wide whitespace-nowrap transition-colors shrink-0",
                active ? "bg-primary/20 text-primary" : done ? "text-muted-foreground/70" : "text-muted-foreground/40",
              )}
            >
              <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-mono", active ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {i + 1}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Compact plan summary strip (desktop) ── */}
      <div className="hidden md:grid grid-cols-3 gap-1.5 mb-2 text-[9px] font-mono" data-testid="planner-summary">
        <div className="rounded bg-muted/20 border border-border/40 px-2 py-1 truncate">
          <span className="text-muted-foreground">Target </span>
          {selectedParcel ? <span className="text-foreground">#{selectedParcel.plotId}</span> : <span className="text-muted-foreground/60">—</span>}
        </div>
        <div className="rounded bg-muted/20 border border-border/40 px-2 py-1 truncate">
          <span className="text-muted-foreground">Origin </span>
          {sourceParcel ? <span className="text-foreground">#{sourceParcel.plotId}</span> : <span className="text-muted-foreground/60">—</span>}
        </div>
        <div className="rounded bg-muted/20 border border-border/40 px-2 py-1 truncate">
          <span className="text-muted-foreground">Cmdr </span>
          {selectedCommanderEval ? <span className="text-foreground">{selectedCommanderEval.commander.name}</span> : <span className="text-muted-foreground/60">—</span>}
        </div>
      </div>

      {/* ── Step content (scrolls independently) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-2.5" data-testid="planner-content">
        {step === "target" && (
          <div className="space-y-2" data-testid="planner-step-target">
            {selectedParcel ? (
              <Card className="p-2.5 border-border/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3 h-3 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-xs font-bold truncate">Plot #{selectedParcel.plotId}</span>
                    {targetFactionMeta && (
                      <span className="text-[9px] font-display uppercase font-bold shrink-0" style={{ color: targetFactionMeta.color }}>
                        {targetFactionMeta.name}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[9px] font-display uppercase shrink-0"
                    style={{ color: relationshipColor(targetRelationship) }}
                  >
                    {targetRelationship}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 text-[9px] font-mono text-muted-foreground">
                  <span>Owner: <span className="text-foreground">{selectedParcel.ownerId ? selectedParcel.ownerId.slice(0, 10) : "Unowned"}</span></span>
                  <span>Faction: <span className="text-foreground">{selectedParcel.effectiveFaction ?? "Neutral"}</span></span>
                  <span>Biome: <span className="capitalize text-foreground">{selectedParcel.biome}</span></span>
                  <span>Defense: <span className="text-foreground">{selectedParcel.defenseLevel}</span></span>
                  <span>Richness: <span className="text-foreground">{selectedParcel.richness}</span></span>
                  <span>
                    Distance: <span className="text-foreground">
                      {distanceToTarget != null ? formatDistanceLabel(distanceToTarget) : "—"}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center justify-between text-[9px] font-mono">
                  <span className="text-muted-foreground">Status</span>
                  {selectedParcel.activeBattleId != null ? (
                    <span className="text-red-400 flex items-center gap-1"><TargetIcon className="w-2.5 h-2.5" />Engaged</span>
                  ) : (
                    <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />Open</span>
                  )}
                </div>
                {targetRelationship === "enemy" && (
                  <p className="mt-1.5 text-[8px] font-mono text-orange-400/80">Rival faction target — mission objective</p>
                )}
              </Card>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center py-2">Select a target plot to begin planning.</p>
            )}

            <BattleTargetSelector
              allParcels={allParcels}
              ownedParcels={ownedParcels}
              playerFactionId={player.playerFactionId}
              selectedParcelId={selectedParcel?.id ?? null}
              onSelect={(p) => onSelectTarget(p.id)}
              sourceParcelId={sourceParcelId}
              currentCommanderName={selectedCommanderEval?.commander.name ?? null}
              currentTroops={troops}
              baseCostIron={ATTACK_BASE_COST.iron}
              baseCostFuel={ATTACK_BASE_COST.fuel}
            />

            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="flex-1 text-[10px] font-display uppercase" onClick={() => setStep("target")}>
                Change Target
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-[10px] font-display uppercase" onClick={() => onOpenMap?.()} data-testid="button-choose-on-globe">
                <Crosshair className="w-3 h-3 mr-1" />Choose on Globe
              </Button>
            </div>
          </div>
        )}

        {step === "origin" && (
          <div className="space-y-1.5" data-testid="planner-step-origin">
            <p className="text-[10px] font-display uppercase text-muted-foreground">Launch Origin</p>
            {recommendedOriginId && (
              <p className="text-[8px] font-mono text-cyan-400/80">
                Recommended: Plot #{ownedParcels.find((p) => p.id === recommendedOriginId)?.plotId}
              </p>
            )}
            {originEvals.length === 0 && (
              <p className="text-[9px] text-muted-foreground text-center py-3">You own no eligible origin plots.</p>
            )}
            <div className="grid grid-cols-1 gap-1.5">
              {originEvals.map((e) => {
                const p = e.parcel;
                const isSelected = p.id === sourceParcelId;
                const isRecommended = p.id === recommendedOriginId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!e.eligible}
                    onClick={() => e.eligible && onSourceParcelChange(p.id)}
                    data-testid={`origin-card-${p.plotId}`}
                    className={cn(
                      "text-left p-2 rounded-md border transition-colors",
                      !e.eligible
                        ? "border-border/40 bg-muted/10 opacity-60 cursor-not-allowed"
                        : isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/10 hover:border-muted-foreground/30",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3 h-3 shrink-0 text-muted-foreground" />
                        <span className="font-mono text-xs font-bold">#{p.plotId}</span>
                        <span className="text-[9px] capitalize flex items-center gap-0.5" style={{ color: BIOME_COLORS[p.biome] || "#94a3b8" }}>
                          {BIOME_ICONS[p.biome] || <Shield className="w-2.5 h-2.5" />}
                          {p.biome}
                        </span>
                      </div>
                      {isRecommended && e.eligible && (
                        <span className="text-[8px] font-display uppercase text-cyan-400 shrink-0">★ Rec</span>
                      )}
                      {!e.eligible && (
                        <span className="text-[8px] font-display uppercase text-red-400 shrink-0">{e.blockedReason}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1 mt-1 text-[8px] font-mono text-muted-foreground">
                      <span>Dist: {e.distance != null && Number.isFinite(e.distance) ? formatDistanceLabel(e.distance) : "—"}</span>
                      <span>Troops: {p.ironStored}</span>
                      <span>Def: {p.defenseLevel}</span>
                      <span>Fe: {p.fuelStored}</span>
                      <span>Cr: {p.crystalStored}</span>
                      <span>{e.hasActiveBattle ? "Engaged" : "Ready"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "commander" && (
          <div className="space-y-1.5" data-testid="planner-step-commander">
            <p className="text-[10px] font-display uppercase text-muted-foreground">Select Commander</p>
            {commanders.length === 0 && (
              <p className="text-[9px] text-muted-foreground text-center py-3">No commanders available — mint one to attack.</p>
            )}
            <div className="grid grid-cols-1 gap-1.5">
              {commanderEvals.map((e) => {
                const c = e.commander;
                const tier = c.tier as CommanderTier;
                const meta = COMMANDER_INFO[tier];
                const isSelected = c.id === selectedCommanderId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={e.state !== "available"}
                    onClick={() => e.state === "available" && setSelectedCommanderId(c.id)}
                    data-testid={`commander-card-${c.id}`}
                    className={cn(
                      "text-left p-2 rounded-md border transition-colors",
                      isSelected ? "border-primary bg-primary/10" : "border-border bg-muted/10",
                      e.state !== "available" && "opacity-70",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{COMPANION[tier]?.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display uppercase font-bold text-xs" style={{ color: TIER_COLORS[tier] }}>{c.name}</p>
                        <p className="text-[8px] text-muted-foreground truncate">{meta.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] font-mono font-bold" data-testid={`commander-active-${c.id}`}>
                          Battles · {e.activeBattles}/{e.maxConcurrent}
                        </p>
                        {e.state === "locked" && (
                          <p className="text-[8px] font-mono text-orange-400 flex items-center gap-0.5 justify-end">
                            <Clock className="w-2.5 h-2.5" />{formatCountdown(e.lockRemainingMs)}
                          </p>
                        )}
                        {e.state === "maxed" && (
                          <p className="text-[8px] font-display uppercase text-red-400">Maxed</p>
                        )}
                        {e.state === "available" && (
                          <p className="text-[8px] font-display uppercase text-green-400">Available</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "commitment" && (
          <div className="space-y-2" data-testid="planner-step-commitment">
            <p className="text-[10px] font-display uppercase text-muted-foreground">Resource Commitment</p>

            {/* Troops */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-display uppercase text-muted-foreground">Troops</span>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => setTroopsSafe(troops - 1)} disabled={troops <= 1}><ChevronLeft className="w-2.5 h-2.5" /></Button>
                  <span className="font-mono text-sm w-5 text-center">{troops}</span>
                  <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => setTroopsSafe(troops + 1)} disabled={troops >= maxTroops}><ChevronRight className="w-2.5 h-2.5" /></Button>
                </div>
              </div>
              <Slider value={[troops]} onValueChange={([v]) => setTroopsSafe(v)} min={1} max={Math.max(1, maxTroops)} step={1} className="w-full" />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-display uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-toggle-advanced-commit"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Advanced
              {!showAdvanced && (extraIron > 0 || extraFuel > 0 || extraCrystal > 0) && (
                <span className="text-cyan-400 normal-case">· boosted</span>
              )}
            </button>

            {showAdvanced && (
              <div className="space-y-2 pl-2 border-l border-border/40">
                <ResourceSlider
                  label="Extra Iron"
                  icon={<Pickaxe className="w-2.5 h-2.5 text-iron" />}
                  value={extraIron}
                  max={Math.max(0, player.iron - ATTACK_BASE_COST.iron * troops)}
                  onChange={onExtraIronChange}
                />
                <ResourceSlider
                  label="Extra Fuel"
                  icon={<Fuel className="w-2.5 h-2.5 text-fuel" />}
                  value={extraFuel}
                  max={Math.max(0, player.fuel - ATTACK_BASE_COST.fuel * troops)}
                  onChange={onExtraFuelChange}
                />
                <ResourceSlider
                  label="Crystal"
                  icon={<span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />}
                  value={extraCrystal}
                  max={Math.max(0, player.crystal)}
                  onChange={onExtraCrystalChange}
                />
              </div>
            )}

            {/* Balance footer */}
            <div className="grid grid-cols-3 gap-1.5 text-[8px] font-mono">
              <BalanceCell label="IR" available={player.iron} spent={cost.iron} remaining={remaining.iron} />
              <BalanceCell label="FL" available={player.fuel} spent={cost.fuel} remaining={remaining.fuel} />
              <BalanceCell label="CR" available={player.crystal} spent={cost.crystal} remaining={remaining.crystal} />
            </div>
            {!affordable && (
              <p className="text-[9px] text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Insufficient resources for this commitment.</p>
            )}
          </div>
        )}

        {(step === "review" || step === "launch") && (
          <div className="space-y-2" data-testid="planner-step-review">
            <p className="text-[10px] font-display uppercase text-muted-foreground">Review Attack</p>

            <ReviewSection title="Target" icon={<TargetIcon className="w-3 h-3" />}>
              {selectedParcel ? (
                <>
                  <Row k="Plot" v={`#${selectedParcel.plotId}`} />
                  <Row k="Faction" v={selectedParcel.effectiveFaction ?? "Neutral"} />
                  <Row k="Defense" v={String(selectedParcel.defenseLevel)} />
                  <Row k="Biome" v={selectedParcel.biome} />
                  <Row k="Distance" v={distanceToTarget != null ? formatDistanceLabel(distanceToTarget) : "—"} />
                </>
              ) : <span className="text-[9px] text-muted-foreground">No target</span>}
            </ReviewSection>

            <ReviewSection title="Launch From" icon={<MapPin className="w-3 h-3" />}>
              {sourceParcel ? (
                <>
                  <Row k="Plot" v={`#${sourceParcel.plotId}`} />
                  <Row k="Distance" v={distanceToTarget != null ? formatDistanceLabel(distanceToTarget) : "—"} />
                  <Row k="Avail IR/FL/CR" v={`${sourceParcel.ironStored}/${sourceParcel.fuelStored}/${sourceParcel.crystalStored}`} />
                </>
              ) : <span className="text-[9px] text-muted-foreground">No origin</span>}
            </ReviewSection>

            <ReviewSection title="Commander" icon={<Star className="w-3 h-3" />}>
              {selectedCommanderEval ? (
                <>
                  <Row k="Name" v={selectedCommanderEval.commander.name} />
                  <Row k="Active" v={`${selectedCommanderEval.activeBattles}/${selectedCommanderEval.maxConcurrent}`} />
                  <Row k="Lock" v={selectedCommanderEval.isLocked ? formatCountdown(selectedCommanderEval.lockRemainingMs) : "Ready"} />
                </>
              ) : <span className="text-[9px] text-muted-foreground">No commander</span>}
            </ReviewSection>

            <ReviewSection title="Commitment" icon={<Swords className="w-3 h-3" />}>
              <Row k="Troops" v={String(troops)} />
              <Row k="Iron" v={String(cost.iron)} />
              <Row k="Fuel" v={String(cost.fuel)} />
              <Row k="Crystal" v={String(cost.crystal)} />
            </ReviewSection>

            {/* Outcome preview — advisory projection of the existing combat math. */}
            <ReviewSection title="Outcome Preview" icon={<TargetIcon className="w-3 h-3" />}>
              <Row k="Attacker Power" v={String(Math.round(plannedPowers.attackerPower))} />
              <Row k="Defender Power" v={selectedParcel ? String(Math.round(plannedPowers.defenderPower)) : "—"} />
              <Row k="Win Chance" v={selectedParcel ? `${Math.round(projectedWinChance)}%` : "—"} />
            </ReviewSection>

            <ReviewSection title="Status" icon={<CheckCircle2 className="w-3 h-3" />}>
              <StatusRow ok={!selectedParcel || selectedParcel.activeBattleId == null} label="Target available" bad="Target already engaged" />
              <StatusRow ok={!selectedCommanderEval || selectedCommanderEval.state !== "maxed"} label="Commander available" bad="Commander maxed" />
              <StatusRow ok={!selectedCommanderEval || selectedCommanderEval.state !== "locked"} label="Commander unlocked" bad="Commander locked" />
              <StatusRow ok={!(player.attackCooldownUntil && player.attackCooldownUntil > now)} label="No player cooldown" bad="Player cooldown active" />
              <StatusRow ok={affordable} label="Resources sufficient" bad="Insufficient resources" />
            </ReviewSection>

            <div className={cn(
              "p-2 rounded-md border text-[9px] font-mono text-center font-bold uppercase tracking-wide",
              isLaunchEnabled(launchState)
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
            )} data-testid="planner-launch-state">
              {LAUNCH_STATE_LABEL[launchState]}
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky footer CTA (always reachable above bottom nav) ── */}
      <div className="sticky bottom-0 mt-2 -mx-3 px-3 pt-2 pb-1 bg-background/95 border-t border-border/50 backdrop-blur z-10">
        <div className="flex items-center gap-1.5">
          {stepIndex(step) > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setStep(PLANNER_STEPS[stepIndex(step) - 1].id)} className="text-[10px] font-display uppercase">
              <ChevronLeft className="w-3 h-3" />Back
            </Button>
          )}
          <Button
            variant={isLaunchEnabled(launchState) ? "destructive" : "default"}
            className="flex-1 font-display uppercase tracking-wide text-xs"
            disabled={footerDisabled()}
            onClick={footerAction}
            data-testid="planner-cta"
          >
            {(attacking) && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            {(step === "review" || step === "launch") && !attacking && <Swords className="w-3.5 h-3.5 mr-2" />}
            {footerLabel()}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResourceSlider({ label, icon, value, max, onChange }: { label: string; icon: React.ReactNode; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-display uppercase flex items-center gap-1 text-muted-foreground">{icon}{label}</span>
        <span className="font-mono text-[10px]">{value}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={0} max={Math.max(0, max)} step={1} className="w-full" />
    </div>
  );
}

function BalanceCell({ label, available, spent, remaining }: { label: string; available: number; spent: number; remaining: number }) {
  const negative = remaining < 0;
  return (
    <div className={cn("rounded border px-1.5 py-1", negative ? "border-red-500/40 bg-red-500/5" : "border-border/40 bg-muted/10")}>
      <p className="text-muted-foreground uppercase">{label}</p>
      <p className="font-mono text-[10px]">{spent}/{available}</p>
      <p className={cn("font-mono text-[9px]", negative ? "text-red-400" : "text-green-400")}>{remaining >= 0 ? "+" : ""}{remaining}</p>
    </div>
  );
}

function ReviewSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/10 p-2">
      <p className="text-[9px] font-display uppercase text-muted-foreground flex items-center gap-1 mb-1">
        {icon}{title}
      </p>
      <div className="space-y-0.5 text-[9px] font-mono">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground capitalize truncate">{v}</span>
    </div>
  );
}

function StatusRow({ ok, label, bad }: { ok: boolean; label: string; bad: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{ok ? label : bad}</span>
      {ok ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" /> : <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
    </div>
  );
}
