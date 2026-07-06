import { useState } from "react";
import type { ElementType } from "react";
import {
  Map,
  Package,
  Swords,
  Trophy,
  Shield,
  BarChart3,
  Radar,
  MoreHorizontal,
  ArrowLeftRight,
  Flag,
  TrendingUp,
  Crosshair,
  GraduationCap,
} from "lucide-react";
import type { NavTab } from "../BottomNav";
import { Dock, type DockItem } from "./Dock";
import { Drawer } from "./Drawer";

interface HudShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  battleCount?: number;
}

const PRIMARY_TABS: { id: NavTab; label: string; icon: ElementType }[] = [
  { id: "map", label: "MAP", icon: Map },
  { id: "battles", label: "BATTLES", icon: Swords },
  { id: "armory", label: "ARMORY", icon: Crosshair },
  { id: "inventory", label: "INVENTORY", icon: Package },
  { id: "commander", label: "COMMANDER", icon: Shield },
];

const OVERFLOW_TABS: { id: NavTab; label: string; icon: ElementType }[] = [
  { id: "intel", label: "INTEL", icon: Radar },
  { id: "factions", label: "FACTIONS", icon: Flag },
  { id: "leaderboard", label: "RANKINGS", icon: Trophy },
  { id: "economics", label: "ECONOMICS", icon: BarChart3 },
  { id: "trade", label: "TRADE", icon: ArrowLeftRight },
  { id: "markets", label: "MARKETS", icon: TrendingUp },
  { id: "university", label: "ACADEMY", icon: GraduationCap },
];

/**
 * Drop-in replacement for <BottomNav>: same `{ activeTab, onTabChange,
 * battleCount }` contract and the same `bottom-nav` / `nav-tab-*` testids, but
 * rendered with the v11 HUD shell (dock + sliding indicator + slide-up drawer),
 * scoped under `.hud-root`. The overflow tabs live in the drawer behind a "MORE"
 * dock item. No app state, globe, or transaction logic is touched here.
 */
export function HudShell({ activeTab, onTabChange, battleCount }: HudShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const overflowActive = OVERFLOW_TABS.some((t) => t.id === activeTab);

  const selectPrimary = (id: NavTab) => {
    setDrawerOpen(false);
    onTabChange(id);
  };

  const dockItems: DockItem[] = [
    ...PRIMARY_TABS.map((t) => ({
      id: t.id,
      label: t.label,
      icon: t.icon,
      active: activeTab === t.id,
      badge: t.id === "battles" ? battleCount : undefined,
      onSelect: () => selectPrimary(t.id),
    })),
    {
      id: "more",
      label: "MORE",
      icon: MoreHorizontal,
      active: overflowActive,
      onSelect: () => setDrawerOpen((o) => !o),
    },
  ];

  return (
    <div className="hud-root hud-mobile-only">
      <Dock items={dockItems} />
      <Drawer open={drawerOpen} title="MORE" onClose={() => setDrawerOpen(false)} data-testid="hud-overflow-drawer">
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {OVERFLOW_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                type="button"
                key={t.id}
                className={`hud-drawer-item${activeTab === t.id ? " on" : ""}`}
                data-testid={`nav-tab-${t.id}`}
                onClick={() => {
                  onTabChange(t.id);
                  setDrawerOpen(false);
                }}
              >
                <Icon />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </Drawer>
    </div>
  );
}
