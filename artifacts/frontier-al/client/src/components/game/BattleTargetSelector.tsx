import { useState, useMemo, useCallback } from "react";
import { MapPin, Search, Globe, Crosshair, Star, Shield, Flame, Droplets, Mountain, Snowflake, Trees, Wind, Target } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LandParcel } from "@shared/schema";
import { PLAYER_FACTIONS, type FactionMeta } from "@/lib/factions";
import { classifyRelationship, type EffectiveFaction } from "@shared/factionIdentity";
import { type PlayerFactionId } from "@shared/waitlist";

const DISPLAY_LIMIT = 20;
const NEARBY_MAX_DISTANCE = 0.15;

function sphereDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

export interface BattleTargetSelectorProps {
  allParcels: LandParcel[];
  ownedParcels: LandParcel[];
  playerFactionId: string | null | undefined;
  selectedParcelId: string | null;
  onSelect: (parcel: LandParcel) => void;
  sourceParcelId?: string | null;
  currentCommanderName?: string | null;
  currentTroops?: number;
  baseCostIron?: number;
  baseCostFuel?: number;
  className?: string;
}

function getFactionMeta(factionId: string | null | undefined): FactionMeta | undefined {
  if (!factionId) return undefined;
  return PLAYER_FACTIONS.find(f => f.id === factionId);
}

function relationshipColor(rel: "ally" | "enemy" | "neutral"): string {
  if (rel === "enemy") return "#f87171";
  if (rel === "ally") return "#4ade80";
  return "#94a3b8";
}

export function BattleTargetSelector({
  allParcels,
  ownedParcels,
  playerFactionId,
  selectedParcelId,
  onSelect,
  sourceParcelId,
  currentCommanderName,
  currentTroops = 1,
  baseCostIron = 10,
  baseCostFuel = 10,
  className,
}: BattleTargetSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const playerFaction = useMemo(() => getFactionMeta(playerFactionId), [playerFactionId]);

  const originParcel = useMemo(() => {
    if (sourceParcelId) return allParcels.find(p => p.id === sourceParcelId) || null;
    if (ownedParcels.length > 0) return ownedParcels[0];
    return selectedParcelId ? allParcels.find(p => p.id === selectedParcelId) || null : null;
  }, [sourceParcelId, ownedParcels, selectedParcelId, allParcels]);

  const playerFactionEffective = useMemo((): EffectiveFaction => {
    if (!playerFactionId) return null;
    const id = playerFactionId as PlayerFactionId;
    return PLAYER_FACTIONS.some(f => f.id === id) ? id : null;
  }, [playerFactionId]);

  const isEnemy = useCallback((parcel: LandParcel): boolean => {
    if (!parcel.ownerId || !playerFactionEffective) return false;
    const ownerParcel = allParcels.find(p => p.ownerId === parcel.ownerId);
    if (!ownerParcel) return false;
    const ownerFaction = (ownerParcel.effectiveFaction ?? null) as EffectiveFaction;
    const rel = classifyRelationship(playerFactionEffective, ownerFaction);
    return rel === "enemy";
  }, [playerFactionEffective, allParcels]);

  const enemyParcels = useMemo(() => {
    return allParcels.filter(isEnemy);
  }, [allParcels, isEnemy]);

  const nearbyEnemies = useMemo(() => {
    if (!originParcel) return [];
    return enemyParcels
      .map(p => ({
        parcel: p,
        distance: sphereDistance(originParcel.lat, originParcel.lng, p.lat, p.lng),
      }))
      .filter(item => item.distance > 0 && item.distance < NEARBY_MAX_DISTANCE)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, DISPLAY_LIMIT);
  }, [enemyParcels, originParcel]);

  const recommendedTargets = useMemo(() => {
    if (!originParcel) return [];
    return enemyParcels
      .map(p => {
        const dist = sphereDistance(originParcel.lat, originParcel.lng, p.lat, p.lng);
        const distScore = Math.max(0, 1 - dist / NEARBY_MAX_DISTANCE);
        const defenseScore = Math.max(0, 1 - p.defenseLevel / 15);
        const valueScore = (p.richness || 0) / 100;
        const ownerFaction = p.effectiveFaction;
        const isRival = ownerFaction && playerFactionEffective && classifyRelationship(playerFactionEffective, ownerFaction) === "enemy";
        const missionBoost = isRival ? 0.3 : 0;
        const score = distScore * 0.4 + defenseScore * 0.3 + valueScore * 0.2 + missionBoost * 0.1;
        return { parcel: p, distance: dist, score };
      })
      .filter(item => item.distance > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, DISPLAY_LIMIT);
  }, [enemyParcels, originParcel, playerFactionEffective]);

  const missionTargets = useMemo(() => {
    if (!playerFactionEffective) return [];
    const rivals = PLAYER_FACTIONS.filter(f => f.id !== playerFactionId && classifyRelationship(playerFactionEffective, f.id as EffectiveFaction) === "enemy");
    const rivalIds = new Set(rivals.map(r => r.id));
    return enemyParcels
      .filter(p => p.effectiveFaction && rivalIds.has(p.effectiveFaction))
      .sort((a, b) => (b.richness || 0) - (a.richness || 0) || a.defenseLevel - b.defenseLevel)
      .slice(0, DISPLAY_LIMIT);
  }, [enemyParcels, playerFactionEffective, playerFactionId]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return enemyParcels
      .filter(p => {
        if (!isNaN(Number(q))) return String(p.plotId) === q || p.id.toLowerCase().includes(q);
        return (
          String(p.plotId).includes(q) ||
          (p.ownerId && p.ownerId.toLowerCase().includes(q)) ||
          (p.effectiveFaction && p.effectiveFaction.toLowerCase().includes(q)) ||
          p.biome.toLowerCase().includes(q)
        );
      })
      .slice(0, DISPLAY_LIMIT);
  }, [enemyParcels, searchQuery]);

  const handleGlobeSelect = useCallback(() => {
    if (originParcel) {
      onSelect(originParcel);
    }
  }, [originParcel, onSelect]);

  const renderTargetCard = (item: { parcel: LandParcel; distance?: number; score?: number }) => {
    const p = item.parcel;
    const isSelected = p.id === selectedParcelId;
    const factionMeta = getFactionMeta(p.effectiveFaction);
    const rel = playerFactionEffective && p.effectiveFaction
      ? classifyRelationship(playerFactionEffective, p.effectiveFaction)
      : "neutral";
    const estimatedCost = baseCostIron * currentTroops + baseCostFuel * currentTroops;

    return (
      <button
        key={p.id}
        onClick={() => onSelect(p)}
        className={cn(
          "w-full text-left p-2.5 rounded-md border transition-colors active:scale-[0.98]",
          isSelected ? "border-primary bg-primary/10" : "border-border bg-muted/10 hover:border-muted-foreground/30"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3 h-3 shrink-0 text-muted-foreground" />
            <span className="font-mono text-xs font-bold truncate">Plot #{p.plotId}</span>
            {factionMeta && (
              <span className="text-[9px] font-display uppercase font-bold shrink-0" style={{ color: factionMeta.color }}>
                {factionMeta.name}
              </span>
            )}
          </div>
          {item.score !== undefined && (
            <span className="text-[9px] font-mono text-cyan-400 shrink-0">{Math.round(item.score * 100)} match</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground font-mono">
          <span className={cn("capitalize", rel === "enemy" ? "text-red-400" : rel === "ally" ? "text-green-400" : "")}>
            {rel}
          </span>
          <span>Def {p.defenseLevel}</span>
          {item.distance !== undefined && (
            <span>{item.distance < 0.01 ? "Nearby" : item.distance < 0.05 ? "~50 units" : "~100 units"}</span>
          )}
          <span style={{ color: BIOME_COLORS[p.biome] || "#94a3b8" }} className="capitalize flex items-center gap-0.5">
            {BIOME_ICONS[p.biome] || <Shield className="w-2.5 h-2.5" />}
            {p.biome}
          </span>
          <span>Rich {p.richness}</span>
        </div>
        {isSelected && (
          <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[8px] font-mono text-muted-foreground space-y-0.5">
            <div className="flex justify-between"><span>Launch From</span><span className="text-foreground">#{originParcel?.plotId ?? "—"}</span></div>
            <div className="flex justify-between"><span>Commander</span><span className="text-foreground">{currentCommanderName || "—"}</span></div>
            <div className="flex justify-between"><span>Estimated Cost</span><span className="text-foreground">{estimatedCost} IR/FL</span></div>
          </div>
        )}
      </button>
    );
  };

  return (
    <Card className={cn("border-border/60 bg-background/95", className)}>
      <Tabs defaultValue="recommended" className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-auto p-1 gap-0.5 bg-muted/30">
          <TabsTrigger value="recommended" className="text-[9px] py-1.5 px-1 font-display uppercase whitespace-normal leading-tight" data-testid="tab-recommended">
            <Star className="w-3 h-3 mr-0.5" />Recommended
          </TabsTrigger>
          <TabsTrigger value="nearby" className="text-[9px] py-1.5 px-1 font-display uppercase whitespace-normal leading-tight" data-testid="tab-nearby">
            <Crosshair className="w-3 h-3 mr-0.5" />Nearby
          </TabsTrigger>
          <TabsTrigger value="mission" className="text-[9px] py-1.5 px-1 font-display uppercase whitespace-normal leading-tight" data-testid="tab-mission">
            <Target className="w-3 h-3 mr-0.5" />Missions
          </TabsTrigger>
          <TabsTrigger value="search" className="text-[9px] py-1.5 px-1 font-display uppercase whitespace-normal leading-tight" data-testid="tab-search">
            <Search className="w-3 h-3 mr-0.5" />Search
          </TabsTrigger>
          <TabsTrigger value="globe" className="text-[9px] py-1.5 px-1 font-display uppercase whitespace-normal leading-tight" data-testid="tab-globe">
            <Globe className="w-3 h-3 mr-0.5" />Globe
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[220px] mt-2">
          <TabsContent value="recommended" className="mt-0 space-y-1.5 px-1">
            {recommendedTargets.length === 0 ? (
              <p className="text-[9px] text-muted-foreground text-center py-4">No enemy targets detected.</p>
            ) : (
              recommendedTargets.map(renderTargetCard)
            )}
          </TabsContent>

          <TabsContent value="nearby" className="mt-0 space-y-1.5 px-1">
            {nearbyEnemies.length === 0 ? (
              <p className="text-[9px] text-muted-foreground text-center py-4">No nearby enemies within range.</p>
            ) : (
              nearbyEnemies.map(item => renderTargetCard({ ...item, score: undefined }))
            )}
          </TabsContent>

          <TabsContent value="mission" className="mt-0 space-y-1.5 px-1">
            {missionTargets.length === 0 ? (
              <p className="text-[9px] text-muted-foreground text-center py-4">No active mission objectives.</p>
            ) : (
              missionTargets.map(p => renderTargetCard({ parcel: p, score: undefined }))
            )}
          </TabsContent>

          <TabsContent value="search" className="mt-0 space-y-2 px-1">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 w-3 h-3 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Plot # or faction…"
                className="h-8 pl-7 text-xs font-mono"
                data-testid="target-search-input"
              />
            </div>
            {searchResults.length === 0 && searchQuery ? (
              <p className="text-[9px] text-muted-foreground text-center py-3">No matches for "{searchQuery}"</p>
            ) : (
              searchResults.map(p => renderTargetCard({ parcel: p, score: undefined }))
            )}
          </TabsContent>

          <TabsContent value="globe" className="mt-0 px-1">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Globe className="w-8 h-8 mb-2 text-cyan-400/60" />
              <p className="text-[10px] font-display uppercase text-muted-foreground mb-1">Tap a parcel on the globe</p>
              <p className="text-[9px] text-muted-foreground/70 mb-3">Close this panel and touch any plot to select it as your target.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGlobeSelect}
                disabled={!originParcel}
                className="h-8 text-[10px] font-display uppercase"
                data-testid="button-use-selected-globe"
              >
                <MapPin className="w-3 h-3 mr-1" />Use Selected
              </Button>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
  );
}
