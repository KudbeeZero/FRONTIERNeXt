import { cn } from "@/lib/utils";
import type { SubParcel } from "@shared/schema";

// ── Sub-Parcel Grid Picker ────────────────────────────────────────────────────

export function SubParcelGridPicker({ subParcels, selectedIdx, onSelect, currentPlayerId }: {
  subParcels: SubParcel[]; selectedIdx: number | null;
  onSelect: (idx: number, spId: string) => void; currentPlayerId: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }, (_, i) => {
        const sp = subParcels.find(s => s.subIndex === i);
        const isOwn = sp?.ownerId === currentPlayerId;
        const isOther = sp?.ownerId && sp.ownerId !== currentPlayerId;
        const isSelected = selectedIdx === i;
        return (
          <button
            key={i}
            onClick={() => sp && isOther && onSelect(i, sp.id)}
            disabled={!sp || !isOther}
            className={cn(
              "h-9 rounded border text-[9px] font-mono flex flex-col items-center justify-center transition-colors",
              isSelected ? "border-destructive bg-destructive/20 text-destructive" :
              isOther ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:border-destructive hover:bg-destructive/10 cursor-pointer" :
              isOwn ? "border-green-500/30 bg-green-500/5 text-green-400 cursor-not-allowed" :
              "border-border/40 bg-muted/5 text-muted-foreground cursor-not-allowed"
            )}
          >
            <span>{i + 1}</span>
            {sp?.ownerId ? (
              <span className="text-[7px] truncate max-w-full px-0.5">{isOwn ? "yours" : "enemy"}</span>
            ) : (
              <span className="text-[7px] opacity-50">empty</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
