// A single weapon card for the cache grid. Rarity-framed (Mythic gets an animated
// rainbow ring), with a framer-motion hover lift + glow + stat-preview overlay and
// a DPS comparison arrow vs the currently-selected weapon. Presentation-only.

import { AnimatePresence, motion } from "framer-motion";
import { Star, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Weapon } from "./_data";
import { ELEMENT, RARITY, glow } from "./_tokens";
import { StatBar } from "./_StatBar";

interface WeaponCardProps {
  weapon: Weapon;
  selected: boolean;
  /** DPS of the currently-selected weapon, for the comparison arrow. */
  compareDps: number | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function WeaponCard({
  weapon,
  selected,
  compareDps,
  onSelect,
  onToggleFavorite,
}: WeaponCardProps) {
  const rarity = RARITY[weapon.rarity];
  const element = ELEMENT[weapon.element];
  const dpsDelta = compareDps === null ? 0 : weapon.dps - compareDps;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, boxShadow: glow(rarity.hex, 30) }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="group relative"
      style={{ borderRadius: 14 }}
    >
      {/* Mythic animated rainbow ring */}
      {rarity.rainbow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-[2px] rounded-[16px] opacity-90"
          style={{
            background:
              "conic-gradient(from 0deg, #f87171, #fb923c, #facc15, #4ade80, #22d3ee, #818cf8, #e879f9, #f87171)",
            animation: "fnx-rainbow-spin 5s linear infinite",
            filter: "blur(0.5px)",
          }}
        />
      )}

      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={() => onSelect(weapon.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(weapon.id);
          }
        }}
        className={cn(
          "relative flex w-full cursor-pointer flex-col overflow-hidden rounded-[13px] border bg-zinc-950/90 text-left outline-none",
          "backdrop-blur transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400/60",
        )}
        style={{
          borderColor: selected ? rarity.hex : `${rarity.hex}66`,
          boxShadow: selected ? glow(rarity.hex, 26) : undefined,
        }}
      >
        {/* Artwork placeholder */}
        <div
          className="relative h-24 w-full"
          style={{
            background: `radial-gradient(120% 90% at 50% 0%, ${element.hex}33, transparent 70%), linear-gradient(160deg, ${rarity.hex}22, #09090b 75%)`,
          }}
        >
          <span
            className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{ backgroundColor: `${rarity.hex}22`, color: rarity.hex }}
          >
            {rarity.label}
          </span>

          <button
            type="button"
            aria-label="Toggle favorite"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(weapon.id);
            }}
            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/40 transition-colors hover:bg-black/70"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                weapon.favorite ? "fill-amber-400 text-amber-400" : "text-zinc-500",
              )}
            />
          </button>

          {/* Silhouette glyph as stand-in for weapon art */}
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-3xl opacity-30 grayscale">{element.glyph}</span>
          </div>
        </div>

        {/* Identity */}
        <div className="flex flex-col gap-1 px-3 pb-2 pt-2">
          <span
            className="truncate text-sm font-semibold tracking-wide"
            style={{ color: rarity.rainbow ? "#f0abfc" : rarity.hex }}
          >
            {weapon.name}
          </span>
          <span className="truncate text-[10px] uppercase tracking-wider text-zinc-500">
            {weapon.weaponClass}
          </span>

          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">
              Lv <span className="font-semibold text-zinc-200">{weapon.level}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="font-bold text-zinc-100 tabular-nums">{weapon.dps}</span>
              <span className="text-zinc-500">DPS</span>
              {compareDps !== null && dpsDelta !== 0 && (
                <span
                  className={cn(
                    "ml-0.5 flex items-center",
                    dpsDelta > 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {dpsDelta > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1" style={{ color: element.hex }}>
              <span>{element.glyph}</span>
              <span className="text-[10px] uppercase">{element.label}</span>
            </span>
          </div>
        </div>

        {/* Hover stat preview */}
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="hidden flex-col gap-1.5 border-t border-white/5 bg-black/40 px-3 py-2 group-hover:flex"
          >
            <StatBar label="DMG" value={weapon.stats.Damage} hex={rarity.hex} compact />
            <StatBar label="RATE" value={weapon.stats["Fire Rate"]} hex={rarity.hex} compact />
            <StatBar label="RANGE" value={weapon.stats.Range} hex={rarity.hex} compact />
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
