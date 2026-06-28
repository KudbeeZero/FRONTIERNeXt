/**
 * Canonical default widget placement for the in-game dashboard (12-col grid).
 * Spread so nothing overlaps out of the box — the player can then drag, resize,
 * minimize, hide, or reset back to this. Ids match the widget keys GameLayout
 * passes to the canvas.
 */
import type { DashboardLayout } from "@/lib/dashboard/layout";

export const DASHBOARD_WIDGET_IDS = [
  "commandcenter",
  "warroom",
  "rankings",
  "armory",
  "university",
  "commander",
  "trade",
  "factions",
  "markets",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const DEFAULT_DASHBOARD: DashboardLayout = {
  commandcenter: { id: "commandcenter", x: 0, y: 0, w: 3, h: 13 },
  warroom: { id: "warroom", x: 3, y: 0, w: 6, h: 7 },
  rankings: { id: "rankings", x: 9, y: 0, w: 3, h: 7 },
  armory: { id: "armory", x: 3, y: 7, w: 3, h: 6 },
  university: { id: "university", x: 6, y: 7, w: 3, h: 6 },
  commander: { id: "commander", x: 9, y: 7, w: 3, h: 6 },
  trade: { id: "trade", x: 0, y: 13, w: 4, h: 6, hidden: true },
  factions: { id: "factions", x: 4, y: 13, w: 4, h: 6, hidden: true },
  markets: { id: "markets", x: 8, y: 13, w: 4, h: 6, hidden: true },
};
