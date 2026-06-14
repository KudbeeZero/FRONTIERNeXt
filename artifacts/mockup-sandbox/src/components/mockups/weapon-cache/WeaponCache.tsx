// FRONTIER — Weapon Cache & Armory (UI Bible mockup)
//
// The primary armory screen: a category-tabbed, filterable cache grid of
// rarity-framed weapon cards (left) beside a full weapon details panel (right),
// over a 7-button action bar. Inspiration mix per the Bible: Destiny 2 premium
// presentation + Division 2 stat readability + Cyberpunk neon + Dead Cells speed.
//
// This is a STANDALONE VISUAL PROTOTYPE in the mockup sandbox. It runs on sample
// data (./_data) and touches no server, schema, or real game code. COMPARE and
// INSPECT modes are intentionally deferred (placeholder feedback). The component
// is self-contained in a `.dark` wrapper so it renders correctly regardless of
// the sandbox theme.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes } from "lucide-react";

import {
  TAB_CATEGORIES,
  WEAPONS,
  type CacheTab,
  type SortKey,
  type Weapon,
} from "./_data";
import { RARITY_ORDER, ELEMENT } from "./_tokens";
import { CacheGrid } from "./_CacheGrid";
import { WeaponDetails } from "./_WeaponDetails";
import { ActionBar } from "./_ActionBar";

function matchesTab(weapon: Weapon, tab: CacheTab): boolean {
  if (tab === "ALL") return true;
  if (tab === "FAVORITES") return weapon.favorite;
  const cats = TAB_CATEGORIES[tab];
  return cats ? cats.includes(weapon.category) : true;
}

function sortWeapons(list: Weapon[], key: SortKey): Weapon[] {
  const copy = [...list];
  switch (key) {
    case "DPS":
      return copy.sort((a, b) => b.dps - a.dps);
    case "Rarity":
      return copy.sort(
        (a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
      );
    case "Element":
      return copy.sort((a, b) =>
        ELEMENT[a.element].label.localeCompare(ELEMENT[b.element].label),
      );
    case "Recently Acquired":
      return copy.sort((a, b) => a.acquiredDaysAgo - b.acquiredDaysAgo);
    default:
      return copy;
  }
}

export default function WeaponCache() {
  const [weapons, setWeapons] = useState<Weapon[]>(WEAPONS);
  const [activeTab, setActiveTab] = useState<CacheTab>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("DPS");
  const [selectedId, setSelectedId] = useState<string | null>(WEAPONS[0]?.id ?? null);
  const [equippedId, setEquippedId] = useState<string | null>(WEAPONS[0]?.id ?? null);
  const [toast, setToast] = useState<string | null>(null);

  const visible = useMemo(
    () => sortWeapons(weapons.filter((w) => matchesTab(w, activeTab)), sortKey),
    [weapons, activeTab, sortKey],
  );

  const selected = useMemo(
    () => weapons.find((w) => w.id === selectedId) ?? null,
    [weapons, selectedId],
  );

  const favoritesCount = useMemo(
    () => weapons.filter((w) => w.favorite).length,
    [weapons],
  );

  // Keep a valid selection when the active tab filters the current one out.
  useEffect(() => {
    if (visible.length === 0) return;
    if (!visible.some((w) => w.id === selectedId)) {
      setSelectedId(visible[0].id);
    }
  }, [visible, selectedId]);

  // Auto-dismiss the deferred-action toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function toggleFavorite(id: string) {
    setWeapons((prev) =>
      prev.map((w) => (w.id === id ? { ...w, favorite: !w.favorite } : w)),
    );
  }

  return (
    <div className="dark">
      {/* Rainbow keyframes for the Mythic frame (self-contained). */}
      <style>{`@keyframes fnx-rainbow-spin { to { transform: rotate(360deg); } }`}</style>

      <div
        className="flex h-screen w-full flex-col gap-3 p-4 text-zinc-100"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% -10%, #0b1220 0%, transparent 60%), radial-gradient(1000px 500px at 100% 0%, #160b1f 0%, transparent 55%), #050507",
        }}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-[0_0_20px_-6px_rgba(34,211,238,0.9)]">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-[0.25em] text-zinc-100">
                Armory
              </h1>
              <p className="text-[11px] tracking-wide text-zinc-500">
                FRONTIER Weapon Cache · build, browse, obsess
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Mockup · sample data
            </span>
          </div>
        </header>

        {/* Body: cache grid | details */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
          <CacheGrid
            weapons={visible}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            sortKey={sortKey}
            onSortChange={setSortKey}
            favoritesCount={favoritesCount}
            totalCount={weapons.length}
            selectedId={selectedId}
            compareDps={selected?.dps ?? null}
            onSelect={setSelectedId}
            onToggleFavorite={toggleFavorite}
          />
          <div className="hidden min-h-0 lg:block">
            <WeaponDetails weapon={selected} />
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="shrink-0">
          <ActionBar
            weapon={selected}
            equipped={selected !== null && selected.id === equippedId}
            onEquip={() => {
              if (!selected) return;
              setEquippedId(selected.id);
              setToast(`${selected.name} equipped`);
            }}
            onToggleFavorite={() => selected && toggleFavorite(selected.id)}
            onDeferred={(action) =>
              setToast(
                action === "Compare" || action === "Inspect"
                  ? `${action} mode — coming in a later unit`
                  : `${action}: ${selected?.name ?? ""} (mockup)`,
              )
            }
          />
        </div>

        {/* Transient toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-cyan-400/30 bg-zinc-950/90 px-4 py-2 text-xs font-medium text-cyan-200 shadow-[0_0_24px_-8px_rgba(34,211,238,0.9)] backdrop-blur"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
