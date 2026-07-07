/** Every panel tab the game's nav (mobile bottom bar + desktop rail) can show. */
export type NavTab = "map" | "inventory" | "battles" | "armory" | "leaderboard" | "commander" | "economics" | "intel" | "trade" | "factions" | "markets" | "university";

/**
 * Panel tabs the desktop rail can show. Unlike mobile's fullscreen panel (which
 * has a real "no panel, show the map" state via `activeTab === "map"`), the
 * desktop rail is always visible — there's no equivalent "hide it" concept.
 * "map" has no desktop-rail rendering, so it's excluded. "inventory" (loot
 * boxes, resource collection) previously had no desktop surface at all —
 * player-owned loot boxes were fetched but never rendered on desktop — so
 * it's included here now, mirroring the mobile fullscreen panel.
 */
export type RailTab = Exclude<NavTab, "map">;

const RAIL_TABS: readonly RailTab[] = [
  "battles",
  "armory",
  "university",
  "commander",
  "inventory",
  "leaderboard",
  "trade",
  "factions",
  "markets",
  "economics",
  "intel",
];

export function isRailTab(tab: NavTab): tab is RailTab {
  return (RAIL_TABS as readonly NavTab[]).includes(tab);
}

/**
 * What the desktop rail should show for a given shared `activeTab`. When the
 * shared tab isn't rail-eligible (the player is on "map" or "inventory" — both
 * mobile-only concepts), the rail keeps showing whatever it last showed
 * instead of going blank, since it has no "no panel" state of its own.
 */
export function resolveRailTab(activeTab: NavTab, lastRailTab: RailTab): RailTab {
  return isRailTab(activeTab) ? activeTab : lastRailTab;
}
