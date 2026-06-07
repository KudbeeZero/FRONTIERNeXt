// Extracted from LandSheet.tsx into the dedicated sub-parcel panel directory
// (feat/subparcel-ui, DORMANT LUT 1.1). Behavior identical — drives the existing
// /api/sub-parcels/* + /api/plots/:id/* endpoints. No server routes changed.

import type { SubParcelArchetype, EnergyAlignment } from "@shared/schema";

export const ARCHETYPE_LABELS: Record<SubParcelArchetype, string> = {
  resource: "Resource",
  trade: "Trade",
  fortress: "Fortress",
  energy: "Energy",
};
export const ARCHETYPE_DESCS: Record<SubParcelArchetype, string> = {
  resource: "Boosts extraction yield",
  trade: "Increases market throughput",
  fortress: "Tiered combat fortification",
  energy: "Generates power for adjacent parcels",
};
export const FORTRESS_TIERS: Record<number, string> = { 1: "Outpost", 2: "Garrison", 3: "Citadel" };
export const ENERGY_ALIGNMENTS: Record<EnergyAlignment, string> = { helios: "Helios", aegis: "Aegis", nexus: "Nexus" };
