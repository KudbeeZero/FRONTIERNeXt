// Extracted from LandSheet.tsx into the dedicated sub-parcel panel directory
// (feat/subparcel-ui, DORMANT LUT 1.1). Behavior identical — drives the existing
// /api/sub-parcels/* + /api/plots/:id/* endpoints. No server routes changed.

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Player, ImprovementType, DefenseImprovementType, FacilityType, SubParcel, BiomeType, SubParcelArchetype, EnergyAlignment } from "@shared/schema";
import { biomeColors, DEFENSE_IMPROVEMENT_INFO, FACILITY_INFO, IMPROVEMENT_INFO, SUB_PARCEL_FACILITY_COSTS, SUB_PARCEL_DEFENSE_COSTS, getBiomeUpgradeMultiplier, ARCHETYPE_FACTION_BONUSES } from "@shared/schema";
import { ARCHETYPE_LABELS, ARCHETYPE_DESCS, FORTRESS_TIERS, ENERGY_ALIGNMENTS } from "./archetypeConfig";

export function SubParcelDetail({ sp, player, parentPlotId, biome, onClose }: {
  sp: SubParcel;
  player: Player;
  parentPlotId: number;
  biome: BiomeType;
  onClose: () => void;
}) {
  const [listPrice, setListPrice] = useState("");
  const [pendingArchetype, setPendingArchetype] = useState<SubParcelArchetype | null>(null);
  const [pendingLevel, setPendingLevel] = useState<number>(1);
  const [pendingAlignment, setPendingAlignment] = useState<EnergyAlignment>("helios");

  const buildMutation = useMutation({
    mutationFn: (improvementType: ImprovementType) =>
      apiRequest("POST", `/api/sub-parcels/${sp.id}/build`, { playerId: player.id, improvementType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plots/${parentPlotId}/sub-parcels`] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });

  const { data: listingsData } = useQuery<{ listings: { id: string; subParcelId: string; status: string; askPriceFrontier: number }[] }>({
    queryKey: ["/api/sub-parcels/listings"],
    staleTime: 10_000,
  });
  const existingListing = listingsData?.listings?.find(l => l.subParcelId === sp.id && l.status === "open");

  const createListingMutation = useMutation({
    mutationFn: (price: number) =>
      apiRequest("POST", "/api/sub-parcels/listings", { sellerId: player.id, subParcelId: sp.id, askPriceFrontier: price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-parcels/listings"] });
      setListPrice("");
    },
  });

  const cancelListingMutation = useMutation({
    mutationFn: (listingId: string) =>
      apiRequest("DELETE", `/api/sub-parcels/listings/${listingId}`, { sellerId: player.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-parcels/listings"] });
    },
  });

  const archetypeMutation = useMutation({
    mutationFn: (params: { archetype: SubParcelArchetype; archetypeLevel?: number; energyAlignment?: EnergyAlignment }) =>
      apiRequest("POST", `/api/sub-parcels/${sp.id}/archetype`, { playerId: player.id, ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plots/${parentPlotId}/sub-parcels`] });
      setPendingArchetype(null);
    },
  });

  const improvements = sp.improvements ?? [];

  const facilityTypes: FacilityType[] = ["electricity", "blockchain_node", "data_centre", "ai_lab"];
  const defenseTypes: DefenseImprovementType[] = ["turret", "shield_gen", "storage_depot", "radar", "fortress"];
  const biomeColor = biomeColors[biome];

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-display uppercase tracking-wide text-primary flex items-center gap-1.5">
          <Wrench className="w-3 h-3" /> Sub-Parcel #{sp.subIndex + 1} Upgrades
        </span>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[8px] capitalize px-1.5 py-0" style={{ borderColor: biomeColor + "80", color: biomeColor }}>
            {biome}
          </Badge>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[10px]">✕</button>
        </div>
      </div>

      {/* ── Archetype Section ───────────────────────────────────────────── */}
      <div className="border-b border-border/30 pb-2">
        <p className="text-[9px] text-muted-foreground font-display uppercase tracking-wide mb-1.5">Archetype</p>
        {sp.archetype && !pendingArchetype && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Badge variant="secondary" className="text-[9px] capitalize">{ARCHETYPE_LABELS[sp.archetype]}</Badge>
            {sp.archetype === "fortress" && sp.archetypeLevel > 0 && (
              <Badge variant="outline" className="text-[9px]">{FORTRESS_TIERS[sp.archetypeLevel] ?? `Lv${sp.archetypeLevel}`}</Badge>
            )}
            {sp.archetype === "energy" && sp.energyAlignment && (
              <Badge variant="outline" className="text-[9px] capitalize">{ENERGY_ALIGNMENTS[sp.energyAlignment]}</Badge>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-1 mb-1">
          {(["resource", "trade", "fortress", "energy"] as SubParcelArchetype[]).map(type => {
            const isActive = sp.archetype === type && !pendingArchetype;
            const isPending = pendingArchetype === type;
            const factionBonus = player.playerFactionId ? ARCHETYPE_FACTION_BONUSES[type][player.playerFactionId] : undefined;
            return (
              <button
                key={type}
                onClick={() => setPendingArchetype(isPending ? null : type)}
                disabled={isActive || archetypeMutation.isPending}
                className={cn(
                  "flex flex-col items-start px-2 py-1.5 rounded border text-left transition-colors",
                  isPending ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/40 bg-muted/20",
                  isActive && "opacity-50 cursor-not-allowed",
                )}
              >
                <span className="text-[9px] font-display uppercase">{ARCHETYPE_LABELS[type]}</span>
                <span className="text-[8px] text-muted-foreground">{ARCHETYPE_DESCS[type]}</span>
                {factionBonus && (
                  <span className="text-[8px] text-green-400">+{Math.round(factionBonus * 100)}% faction</span>
                )}
              </button>
            );
          })}
        </div>
        {pendingArchetype === "fortress" && (
          <div className="flex gap-1 mb-1">
            {([1, 2, 3] as number[]).map(lvl => (
              <button
                key={lvl}
                onClick={() => setPendingLevel(lvl)}
                className={cn(
                  "flex-1 text-[9px] px-1.5 py-1 rounded border transition-colors",
                  pendingLevel === lvl ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-primary/40"
                )}
              >
                {FORTRESS_TIERS[lvl]}
              </button>
            ))}
          </div>
        )}
        {pendingArchetype === "energy" && (
          <div className="flex gap-1 mb-1">
            {(["helios", "aegis", "nexus"] as EnergyAlignment[]).map(align => (
              <button
                key={align}
                onClick={() => setPendingAlignment(align)}
                className={cn(
                  "flex-1 text-[9px] px-1.5 py-1 rounded border capitalize transition-colors",
                  pendingAlignment === align ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-primary/40"
                )}
              >
                {ENERGY_ALIGNMENTS[align]}
              </button>
            ))}
          </div>
        )}
        {pendingArchetype && (
          <button
            onClick={() => archetypeMutation.mutate({
              archetype: pendingArchetype,
              ...(pendingArchetype === "fortress" ? { archetypeLevel: pendingLevel } : {}),
              ...(pendingArchetype === "energy"   ? { energyAlignment: pendingAlignment } : {}),
            })}
            disabled={archetypeMutation.isPending}
            className="w-full text-[9px] font-display uppercase py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 transition-colors"
          >
            {archetypeMutation.isPending ? "Assigning..." : `Assign ${ARCHETYPE_LABELS[pendingArchetype]}`}
          </button>
        )}
        {archetypeMutation.isError && (
          <p className="text-[8px] text-destructive mt-0.5">{String((archetypeMutation.error as any)?.message ?? "Failed")}</p>
        )}
      </div>

      {improvements.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {improvements.map((imp, i) => (
            <Badge key={i} variant="secondary" className="text-[9px]">
              {IMPROVEMENT_INFO[imp.type]?.name ?? imp.type} Lv{imp.level}
            </Badge>
          ))}
        </div>
      )}

      <div>
        <p className="text-[9px] text-muted-foreground font-display uppercase tracking-wide mb-1">Facilities (ASCEND)</p>
        <div className="grid grid-cols-2 gap-1">
          {facilityTypes.map(type => {
            const info = FACILITY_INFO[type];
            const existing = improvements.find(i => i.type === type);
            const atMax = existing && existing.level >= info.maxLevel;
            const level = existing ? existing.level + 1 : 1;
            const rawCost = atMax ? 0 : SUB_PARCEL_FACILITY_COSTS[type][level - 1];
            const multiplier = getBiomeUpgradeMultiplier(biome, type);
            const cost = atMax ? 0 : Math.ceil(rawCost * multiplier);
            const hasDiscount = multiplier < 0.99;
            const hasPremium = multiplier > 1.01;
            const canAfford = player.frontier >= cost;
            const hasPrereq = !info.prerequisite || improvements.find(i => i.type === info.prerequisite);
            return (
              <Button key={type} variant="outline" size="sm"
                onClick={() => buildMutation.mutate(type)}
                disabled={buildMutation.isPending || !!atMax || !canAfford || !hasPrereq}
                className={cn("flex-col items-start h-auto py-1.5 px-2 text-left", !hasPrereq && "opacity-50")}
              >
                <span className="text-[9px] font-display uppercase">{info.name}</span>
                {existing && <span className="text-[8px] text-primary font-mono">Lv{existing.level}{!atMax ? ` → Lv${level}` : " MAX"}</span>}
                {atMax ? (
                  <span className="text-[8px] text-muted-foreground font-mono">✓ MAX</span>
                ) : (
                  <span className="text-[8px] font-mono flex items-center gap-0.5">
                    {hasDiscount && <span className="line-through text-muted-foreground/50">{rawCost}</span>}
                    <span className={cn(hasDiscount ? "text-green-400" : hasPremium ? "text-amber-400" : "text-muted-foreground")}>
                      {cost} ASCEND
                    </span>
                    {hasDiscount && <span className="text-green-400/70">↓{Math.round((1 - multiplier) * 100)}%</span>}
                    {hasPremium && <span className="text-amber-400/70">↑{Math.round((multiplier - 1) * 100)}%</span>}
                  </span>
                )}
                {!hasPrereq && <span className="text-[7px] text-destructive">🔒 Needs Electricity</span>}
                {!atMax && !canAfford && <span className="text-[7px] text-destructive/70">Insufficient ASCEND</span>}
              </Button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[9px] text-muted-foreground font-display uppercase tracking-wide mb-1">Defense (Iron/Fuel)</p>
        <div className="grid grid-cols-2 gap-1">
          {defenseTypes.map(type => {
            const info = DEFENSE_IMPROVEMENT_INFO[type];
            const existing = improvements.find(i => i.type === type);
            const atMax = existing && existing.level >= info.maxLevel;
            const level = existing ? existing.level + 1 : 1;
            const baseCost = SUB_PARCEL_DEFENSE_COSTS[type];
            const multiplier = getBiomeUpgradeMultiplier(biome, type);
            const rawCost = { iron: baseCost.iron * level, fuel: baseCost.fuel * level };
            const cost = { iron: Math.ceil(rawCost.iron * multiplier), fuel: Math.ceil(rawCost.fuel * multiplier) };
            const hasDiscount = multiplier < 0.99;
            const hasPremium = multiplier > 1.01;
            const canAfford = player.iron >= cost.iron && player.fuel >= cost.fuel;
            return (
              <Button key={type} variant="outline" size="sm"
                onClick={() => buildMutation.mutate(type)}
                disabled={buildMutation.isPending || !!atMax || !canAfford}
                className="flex-col items-start h-auto py-1.5 px-2 text-left"
              >
                <span className="text-[9px] font-display uppercase">{info.name}</span>
                {existing && <span className="text-[8px] text-primary font-mono">Lv{existing.level}{!atMax ? ` → Lv${level}` : " MAX"}</span>}
                {atMax ? (
                  <span className="text-[8px] text-muted-foreground font-mono">✓ MAX</span>
                ) : (
                  <span className="text-[8px] font-mono flex items-center gap-0.5">
                    <span className={cn(hasDiscount ? "text-green-400" : hasPremium ? "text-amber-400" : "text-muted-foreground")}>
                      {cost.iron}I {cost.fuel}F
                    </span>
                    {hasDiscount && <span className="text-green-400/70">↓{Math.round((1 - multiplier) * 100)}%</span>}
                    {hasPremium && <span className="text-amber-400/70">↑{Math.round((multiplier - 1) * 100)}%</span>}
                  </span>
                )}
                {!atMax && !canAfford && <span className="text-[7px] text-destructive/70">Insufficient resources</span>}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Trade Section */}
      <div className="border-t border-border/30 pt-2">
        <p className="text-[9px] text-muted-foreground font-display uppercase tracking-wide mb-1.5">Trade</p>
        {existingListing ? (
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-emerald-400 font-mono">Listed: {existingListing.askPriceFrontier} ASCEND</span>
            <Button size="sm" variant="outline" className="h-5 px-2 text-[9px] border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => cancelListingMutation.mutate(existingListing.id)}
              disabled={cancelListingMutation.isPending}
            >Cancel Listing</Button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <input
              type="number"
              min={1}
              value={listPrice}
              onChange={e => setListPrice(e.target.value)}
              placeholder="Ask price (ASCEND)"
              className="flex-1 bg-muted/30 border border-border rounded px-2 py-1 text-[9px] font-mono focus:outline-none focus:border-primary"
            />
            <Button size="sm" variant="outline" className="h-7 px-2 text-[9px] border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
              onClick={() => { const p = parseInt(listPrice); if (p > 0) createListingMutation.mutate(p); }}
              disabled={!listPrice || parseInt(listPrice) < 1 || createListingMutation.isPending}
            >List for Sale</Button>
          </div>
        )}
      </div>

      {buildMutation.isError && (
        <p className="text-[9px] text-destructive">{String((buildMutation.error as any)?.message ?? "Build failed")}</p>
      )}
    </div>
  );
}
