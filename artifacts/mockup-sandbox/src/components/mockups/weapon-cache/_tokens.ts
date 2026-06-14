// Visual tokens for the FRONTIER Weapon Cache & Armory mockup.
// Single source of truth for rarity + element + stat presentation so the card,
// the details panel, and the grid all read from the same palette.
//
// Mockup only — these are presentation tokens, not game data. The colors follow
// the UI Bible's rarity ladder (Common gray → Mythic animated rainbow) and the
// element coding (Fire orange, Ice blue, Electric yellow, Toxic green, Gravity
// purple, Void black/violet).

import type { Element, Rarity, StatKey } from "./_data";

export interface RarityMeta {
  label: string;
  /** Base hex — drives borders, glow, and bar fills via inline style. */
  hex: string;
  /** Tailwind text-color class for names / labels. */
  text: string;
  /** Soft translucent background for chips/badges. */
  chip: string;
  /** Mythic gets the animated rainbow treatment instead of a flat hex. */
  rainbow?: boolean;
}

// Ordered weakest → strongest (used by the "Rarity" sort).
export const RARITY_ORDER: Rarity[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Exotic",
  "Mythic",
];

export const RARITY: Record<Rarity, RarityMeta> = {
  Common: { label: "Common", hex: "#9ca3af", text: "text-zinc-300", chip: "bg-zinc-400/10" },
  Uncommon: { label: "Uncommon", hex: "#4ade80", text: "text-green-300", chip: "bg-green-400/10" },
  Rare: { label: "Rare", hex: "#3b82f6", text: "text-blue-300", chip: "bg-blue-500/10" },
  Epic: { label: "Epic", hex: "#a855f7", text: "text-purple-300", chip: "bg-purple-500/10" },
  Legendary: { label: "Legendary", hex: "#f5b50a", text: "text-amber-300", chip: "bg-amber-400/10" },
  Exotic: { label: "Exotic", hex: "#ef4444", text: "text-red-400", chip: "bg-red-500/10" },
  Mythic: { label: "Mythic", hex: "#e879f9", text: "text-fuchsia-300", chip: "bg-fuchsia-500/10", rainbow: true },
};

export interface ElementMeta {
  label: string;
  hex: string;
  text: string;
  glyph: string;
}

export const ELEMENT: Record<Element, ElementMeta> = {
  Fire: { label: "Fire", hex: "#fb923c", text: "text-orange-400", glyph: "🔥" },
  Ice: { label: "Ice", hex: "#60a5fa", text: "text-blue-400", glyph: "❄" },
  Electric: { label: "Electric", hex: "#facc15", text: "text-yellow-400", glyph: "⚡" },
  Toxic: { label: "Toxic", hex: "#84cc16", text: "text-lime-400", glyph: "☣" },
  Gravity: { label: "Gravity", hex: "#a78bfa", text: "text-violet-400", glyph: "🌀" },
  Void: { label: "Void", hex: "#7c3aed", text: "text-violet-300", glyph: "🕳" },
};

// The nine stat bars from the Bible, in display order.
export const STAT_ORDER: StatKey[] = [
  "Damage",
  "Fire Rate",
  "Accuracy",
  "Recoil",
  "Range",
  "Reload",
  "Magazine",
  "Critical Chance",
  "Mobility",
];

/** A box-shadow glow string for a given rarity hex (used on hover / selection). */
export function glow(hex: string, spread = 22): string {
  return `0 0 ${spread}px -4px ${hex}, 0 0 ${Math.round(spread / 2)}px -6px ${hex}`;
}
