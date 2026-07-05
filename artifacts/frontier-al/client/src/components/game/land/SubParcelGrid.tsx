import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MapPin, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LandParcel, Player, SubParcel } from "@shared/schema";
import { IMPROVEMENT_INFO, SUB_PARCEL_HOLD_HOURS } from "@shared/schema";
import { SubdivisionCountdown } from "./SubdivisionCountdown";
import { SubParcelUpgradePanel } from "./SubParcelUpgradePanel";

// ── SubParcelGrid ─────────────────────────────────────────────────────────────
// Shows the 3×3 sub-parcel ownership grid for subdivided plots.
// Fetches sub-parcel data from /api/plots/:plotId/sub-parcels.

interface SubParcelGridProps {
  parcel: LandParcel;
  player: Player | null;
  onNavigate?: () => void;
}

export function SubParcelGrid({ parcel, player, onNavigate }: SubParcelGridProps) {
  const [selectedSubIndex, setSelectedSubIndex] = useState<number | null>(null);

  // API returns { plotId, subParcels, isSubdivided } — select extracts the array
  const { data: subParcels = [], isLoading } = useQuery<SubParcel[]>({
    queryKey: [`/api/plots/${parcel.plotId}/sub-parcels`],
    enabled: !!parcel.isSubdivided,
    select: (data: any) => data?.subParcels ?? data ?? [],
  });

  const purchaseMutation = useMutation({
    mutationFn: (subParcelId: string) =>
      apiRequest("POST", `/api/sub-parcels/${subParcelId}/purchase`, { playerId: player?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/plots/${parcel.plotId}/sub-parcels`] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });

  const subdivideMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/plots/${parcel.plotId}/subdivide`, { playerId: player?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
      queryClient.invalidateQueries({ queryKey: [`/api/plots/${parcel.plotId}/sub-parcels`] });
    },
  });

  const isOwner = player && parcel.ownerId === player.id;
  const holdMs  = SUB_PARCEL_HOLD_HOURS * 60 * 60 * 1000;
  const heldSince = parcel.capturedAt ?? parcel.lastAscendClaimTs;
  const canSubdivide = !!(isOwner && !parcel.isSubdivided && heldSince && Date.now() - heldSince >= holdMs);

  if (!parcel.isSubdivided) {
    if (!isOwner) return null;
    return (
      <div className="mt-3 p-2.5 rounded-lg bg-muted/30 border border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <Grid3X3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-display uppercase tracking-wide text-muted-foreground">Sub-Parcels</span>
        </div>
        {heldSince && !canSubdivide && <SubdivisionCountdown heldSince={heldSince} />}
        <p className="text-[9px] text-muted-foreground mb-2">
          {canSubdivide
            ? "Subdivide this plot into a 3×3 grid of 9 purchasable sub-parcels."
            : `Hold for ${SUB_PARCEL_HOLD_HOURS}h to unlock subdivision.`
          }
        </p>
        {canSubdivide && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-[10px] font-display uppercase"
            onClick={() => subdivideMutation.mutate()}
            disabled={subdivideMutation.isPending}
          >
            <Grid3X3 className="w-3 h-3 mr-1" />
            {subdivideMutation.isPending ? "Subdividing..." : "Subdivide Plot"}
          </Button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-3 p-2.5 rounded-lg bg-muted/30 border border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <Grid3X3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-display uppercase tracking-wide">Sub-Parcels</span>
        </div>
        <div className="space-y-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Build indexed map for quick lookup
  const subMap = new Map<number, SubParcel>();
  for (const sp of subParcels) subMap.set(sp.subIndex, sp);

  const allOwnedByMe = subParcels.length === 9 && subParcels.every(s => s.ownerId === player?.id);
  const selectedSp = selectedSubIndex !== null ? subMap.get(selectedSubIndex) : undefined;

  return (
    <div className="mt-3 p-2.5 rounded-lg bg-muted/30 border border-border/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-display uppercase tracking-wide">Sub-Parcels</span>
        </div>
        <div className="flex items-center gap-1.5">
          {allOwnedByMe && (
            <Badge variant="outline" className="text-[9px] text-primary border-primary/40">
              +50% Yield
            </Badge>
          )}
          {onNavigate && (
            <button
              onClick={onNavigate}
              title="Find this plot on the map"
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded border border-border/40 hover:border-primary/40"
            >
              <MapPin className="w-2.5 h-2.5" />
              Find Plot
            </button>
          )}
        </div>
      </div>
      <Table className="text-[10px]">
        <TableHeader>
          <TableRow className="border-border/30">
            <TableHead className="text-[9px] font-display uppercase tracking-wide h-6 py-0">#</TableHead>
            <TableHead className="text-[9px] font-display uppercase tracking-wide h-6 py-0">Status</TableHead>
            <TableHead className="text-[9px] font-display uppercase tracking-wide h-6 py-0">Improvements</TableHead>
            <TableHead className="text-[9px] font-display uppercase tracking-wide h-6 py-0 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 9 }).map((_, i) => {
            const sp = subMap.get(i);
            const isYours = sp?.ownerId === player?.id;
            const isEnemy = sp?.ownerId && !isYours;
            const price   = sp?.purchasePriceAscend;
            const canAffordBuy = player && price !== undefined && player.ascend >= price;
            const canBuy  = !sp?.ownerId && player && price !== undefined;
            const hasImprovements = (sp?.improvements?.length ?? 0) > 0;
            const isSelected = selectedSubIndex === i;

            return (
              <TableRow
                key={i}
                className={cn(
                  "border-border/20 transition-colors",
                  isSelected && "bg-primary/10"
                )}
              >
                <TableCell className="py-1 font-mono text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="py-1">
                  {isYours ? (
                    <span className="text-primary font-display uppercase font-semibold">Yours</span>
                  ) : isEnemy ? (
                    <span className="text-destructive font-display uppercase font-semibold">Enemy</span>
                  ) : sp ? (
                    <span className="text-muted-foreground font-mono">{price}F</span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </TableCell>
                <TableCell className="py-1">
                  {hasImprovements ? (
                    <div className="flex flex-wrap gap-0.5">
                      {sp!.improvements!.map((imp, j) => (
                        <Badge key={j} variant="secondary" className="text-[8px] px-1 py-0">
                          {IMPROVEMENT_INFO[imp.type]?.name ?? imp.type} {imp.level}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/40 text-[9px]">None</span>
                  )}
                </TableCell>
                <TableCell className="py-1 text-right">
                  {canBuy && sp && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-5 px-2 text-[9px] font-display uppercase",
                        canAffordBuy ? "" : "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => canAffordBuy && purchaseMutation.mutate(sp.id)}
                      disabled={purchaseMutation.isPending || !canAffordBuy}
                      title={canAffordBuy ? `Buy for ${price} ASCEND` : `Need ${price} ASCEND`}
                    >
                      {canAffordBuy ? `Buy ${price}F` : `${price}F`}
                    </Button>
                  )}
                  {isYours && (
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "ghost"}
                      className="h-5 px-2 text-[9px] font-display uppercase"
                      onClick={() => setSelectedSubIndex(isSelected ? null : i)}
                    >
                      {isSelected ? "Close" : "Manage"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedSp && player && selectedSp.ownerId === player.id && (
        <SubParcelUpgradePanel
          sp={selectedSp}
          player={player}
          parentPlotId={parcel.plotId}
          biome={parcel.biome}
          onClose={() => setSelectedSubIndex(null)}
        />
      )}

      {purchaseMutation.isError && (
        <p className="text-[9px] text-destructive mt-1">
          {String((purchaseMutation.error as any)?.message ?? "Purchase failed")}
        </p>
      )}
    </div>
  );
}
