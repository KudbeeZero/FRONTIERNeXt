// Left panel: category tabs (ALL/AR/SMG/.../FAVORITES), a sort row, and the
// responsive grid of weapon cards. Filtering/sorting is owned by the container;
// this component renders the controls and the resulting grid. Presentation-only.

import { ArrowUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { CACHE_TABS, SORT_KEYS } from "./_data";
import type { CacheTab, SortKey, Weapon } from "./_data";
import { WeaponCard } from "./_WeaponCard";

interface CacheGridProps {
  weapons: Weapon[];
  activeTab: CacheTab;
  onTabChange: (tab: CacheTab) => void;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
  favoritesCount: number;
  totalCount: number;
  selectedId: string | null;
  compareDps: number | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function CacheGrid({
  weapons,
  activeTab,
  onTabChange,
  sortKey,
  onSortChange,
  favoritesCount,
  totalCount,
  selectedId,
  compareDps,
  onSelect,
  onToggleFavorite,
}: CacheGridProps) {
  return (
    <div className="flex min-h-0 flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-200">
            Weapon Cache
          </h2>
          <p className="text-[11px] text-zinc-500">
            {totalCount} weapons · {favoritesCount} favorites
          </p>
        </div>
        <div className="flex h-8 items-center gap-2 rounded-md border border-white/10 bg-zinc-900/60 px-2 text-zinc-500">
          <Search className="h-3.5 w-3.5" />
          <span className="text-[11px]">Search cache…</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-1 pb-3">
        {CACHE_TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                active
                  ? "bg-cyan-400/15 text-cyan-300 shadow-[0_0_14px_-4px_rgba(34,211,238,0.8)]"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
              )}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Sort row */}
      <div className="flex items-center gap-2 px-1 py-3">
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-zinc-500">
          <ArrowUpDown className="h-3 w-3" /> Sort
        </span>
        {SORT_KEYS.map((key) => {
          const active = key === sortKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSortChange(key)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors",
                active
                  ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                  : "border-white/10 text-zinc-500 hover:text-zinc-300",
              )}
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {weapons.length === 0 ? (
          <div className="grid h-40 place-items-center text-sm text-zinc-600">
            No weapons in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 xl:grid-cols-4">
            {weapons.map((w) => (
              <WeaponCard
                key={w.id}
                weapon={w}
                selected={w.id === selectedId}
                compareDps={w.id === selectedId ? null : compareDps}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
