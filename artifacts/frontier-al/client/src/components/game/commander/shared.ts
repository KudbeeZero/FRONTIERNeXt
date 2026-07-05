import type { CommanderTier } from "@shared/schema";
import sentinelImg from "@assets/image_1771570491560.png";
import phantomImg from "@assets/image_1771570495782.png";
import reaperImg from "@assets/image_1771570500912.png";

// ── Companion animal config per tier ─────────────────────────────────────────
export const COMPANION: Record<CommanderTier, { emoji: string; name: string; flavor: string; winMsg: string; loseMsg: string }> = {
  sentinel: {
    emoji: "🐺",
    name: "Iron Wolf",
    flavor: "Mechanical legs, energy jaw, tactical suppression",
    winMsg: "Iron Wolf seized the sub-parcel.",
    loseMsg: "Iron Wolf retreated — defenses held.",
  },
  phantom: {
    emoji: "🦊",
    name: "Shadow Fox",
    flavor: "Cloaked chassis, EMP tail, stealth recon plating",
    winMsg: "Shadow Fox slipped through the defenses.",
    loseMsg: "Shadow Fox vanished — target too fortified.",
  },
  reaper: {
    emoji: "🦅",
    name: "Apex Raptor",
    flavor: "Biomechanical wings, siege talons, orbital targeting",
    winMsg: "Apex Raptor tore through the fortification.",
    loseMsg: "Apex Raptor pulled back — no breach achieved.",
  },
};

export const COMMANDER_IMAGES: Record<CommanderTier, string> = { sentinel: sentinelImg, phantom: phantomImg, reaper: reaperImg };
export const TIER_COLORS: Record<CommanderTier, string> = { sentinel: "#3b82f6", phantom: "#a855f7", reaper: "#f97316" };

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ready";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
