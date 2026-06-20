/**
 * client/src/lib/globe/liveEventDisplay.ts
 *
 * Pure mapping from a live `WorldEvent` to a transient on-map telemetry box.
 *
 * Only events that carry real coordinates AND currently have no live globe visual
 * are surfaced (battle resolutions and land claims). Battle *starts* and weapon
 * shots already draw arcs; mining already pulses; orbital events already render —
 * so those return `null` here to avoid double-drawing. Deterministic + side-effect
 * free, so it's unit-tested and the layer that consumes it stays thin.
 */
import type { WorldEvent } from "@shared/worldEvents";

export interface LiveEventDisplay {
  label: string;
  /** Accent color for the box + burst ring. */
  color: string;
  kind: "victory" | "defense" | "claim";
}

const COLOR = {
  victory: "#22d3ee", // cyan — attacker took the plot
  defense: "#f87171", // red — defense held
  claim: "#4ade80", // green — new territory
} as const;

/** Returns a telemetry box spec for a map-placeable live event, or null to skip. */
export function liveEventDisplay(event: WorldEvent): LiveEventDisplay | null {
  const plot = event.plotId != null ? ` #${event.plotId}` : "";
  switch (event.type) {
    case "battle_resolved": {
      const outcome = typeof event.metadata?.outcome === "string" ? event.metadata.outcome : "";
      if (outcome === "attacker_wins") return { label: `VICTORY${plot}`, color: COLOR.victory, kind: "victory" };
      if (outcome === "defender_wins") return { label: `DEFENSE HELD${plot}`, color: COLOR.defense, kind: "defense" };
      return { label: `BATTLE RESOLVED${plot}`, color: COLOR.defense, kind: "defense" };
    }
    case "land_claimed":
      return { label: `CLAIMED${plot}`, color: COLOR.claim, kind: "claim" };
    default:
      return null; // already-visualized or coordless event types
  }
}
