/**
 * client/src/components/game/globe/StrikePanel.tsx
 *
 * The offensive half of the weapon system's combat UI: pick an owned weapon and
 * fire it at the selected hostile parcel. Self-contained — it pulls the weapon
 * catalog and the player's territory itself (so the HUD only has to toggle it),
 * derives fireable options via the pure `eligibleStrikes` helper, and posts to
 * /api/weapons/fire. The engagement resolves synchronously server-side; the
 * toast reports whether the shot reached its target or was intercepted.
 */
import { useMemo } from "react";
import { Crosshair, X, Zap } from "lucide-react";
import type { LandParcel } from "@shared/schema";
import { useGameState } from "@/hooks/useGameState";
import { useWeaponCatalog, useFireWeapon } from "@/hooks/useWeapons";
import { eligibleStrikes, type SourceParcel, type StrikeOption } from "@/lib/weaponStrike";
import { useToast } from "@/hooks/use-toast";

export function StrikePanel({
  playerId,
  target,
  accentColor = "#ff5a5a",
  onClose,
}: {
  playerId: string;
  target: LandParcel;
  accentColor?: string;
  onClose: () => void;
}) {
  const { data: gameState } = useGameState();
  const catalog = useWeaponCatalog(playerId);
  const fire = useFireWeapon();
  const { toast } = useToast();

  const ownedParcels: SourceParcel[] = useMemo(
    () =>
      (gameState?.parcels ?? [])
        .filter((p) => p.ownerId === playerId)
        .map((p) => ({ id: p.id, plotId: p.plotId, lat: p.lat, lng: p.lng })),
    [gameState?.parcels, playerId],
  );

  const options: StrikeOption[] = useMemo(
    () =>
      catalog.data
        ? eligibleStrikes(catalog.data.entries, ownedParcels, { lat: target.lat, lng: target.lng })
        : [],
    [catalog.data, ownedParcels, target.lat, target.lng],
  );

  const onFire = (opt: StrikeOption) => {
    if (!opt.canFire || !opt.source) return;
    fire.mutate(
      { playerId, specId: opt.spec.id, sourceParcelId: opt.source.id, targetParcelId: target.id },
      {
        onSuccess: (res: { engagement?: { status?: string } }) => {
          const intercepted = res?.engagement?.status === "intercepted";
          toast({
            title: intercepted ? `${opt.spec.name} intercepted` : `${opt.spec.name} away`,
            description: intercepted
              ? "Enemy defenses knocked it down before impact."
              : `Warhead inbound on plot #${target.plotId}.`,
            variant: intercepted ? "destructive" : undefined,
          });
          if (!intercepted) onClose();
        },
        onError: (err: unknown) =>
          toast({
            title: "Strike failed",
            description: (err as Error)?.message ?? "Could not fire.",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        className="relative m-3 w-full max-w-sm rounded-xl border bg-[#0b0e16]/95 p-4"
        style={{ borderColor: `${accentColor}50`, boxShadow: `0 0 30px ${accentColor}25` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest"
            style={{ color: accentColor }}
          >
            <Crosshair className="h-4 w-4" /> Weapon Strike · Plot #{target.plotId}
          </div>
          <button onClick={onClose} className="text-slate-400 transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {catalog.isLoading ? (
          <p className="py-6 text-center text-xs text-slate-400">Loading armory…</p>
        ) : options.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No offensive weapons in your armory. Build one in the Armory to strike from your territory.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {options.map((opt) => (
              <li
                key={opt.spec.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] text-slate-100">{opt.spec.name}</div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {opt.distanceKm !== null
                      ? `${Math.round(opt.distanceKm)}km / ${opt.spec.rangeKm}km`
                      : `${opt.spec.rangeKm}km reach`}
                    {opt.canFire ? null : opt.reason ? ` · ${opt.reason}` : null}
                  </div>
                </div>
                <button
                  onClick={() => onFire(opt)}
                  disabled={!opt.canFire || fire.isPending}
                  className="flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-all enabled:hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: `${accentColor}1f`, border: `1px solid ${accentColor}55`, color: accentColor }}
                >
                  <Zap className="h-3 w-3" /> {fire.isPending ? "…" : `Fire · ${opt.fireCost}`}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 font-mono text-[9px] text-slate-500">
          Cost in ASCEND · fired from your nearest in-range territory
        </p>
      </div>
    </div>
  );
}
