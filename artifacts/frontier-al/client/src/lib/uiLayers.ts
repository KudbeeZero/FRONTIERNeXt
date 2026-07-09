/**
 * Centralized z-index layering for the game UI.
 * All z-index values should reference these constants to prevent conflicts.
 */
export const Z = {
  globe: 0,
  parcels: 10,
  hud: 20,
  panels: 30,
  sidebar: 40,
  /** BottomNav fixed bar on mobile */
  bottomNav: 50,
  /** Plot action sheet — must be above bottomNav */
  plotSheet: 55,
  /** Desktop floating plot panel */
  selectedPlotPanel: 55,
  /** Toast / orbital notifications */
  toast: 60,
  /** Full-screen modals and dialogs */
  modal: 100,
} as const;

export type ZLayer = keyof typeof Z;

/** Tailwind class helpers for common layers */
export const ZClass = {
  globe: "z-0",
  parcels: "z-10",
  hud: "z-20",
  panels: "z-30",
  sidebar: "z-40",
  bottomNav: "z-50",
  plotSheet: "z-[55]",
  selectedPlotPanel: "z-[55]",
  toast: "z-[60]",
  modal: "z-[100]",
} as const;
