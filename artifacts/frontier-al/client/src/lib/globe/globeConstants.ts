import * as THREE from "three";

// ── Globe geometry ────────────────────────────────────────────────────────────
export const GLOBE_RADIUS = 2;
export const PLOT_COUNT = 21000;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Polar exclusion latitude — must match server/sphereUtils.ts POLAR_EXCLUSION_LAT.
 * Plots above this latitude (abs) are skipped, creating clean circular polar cap voids.
 */
export const POLAR_EXCLUSION_LAT = 75;

// ── Tile fill palette — neon gameplay zone colors ─────────────────────────────
export const COLOR_PLAYER         = new THREE.Color("#00ffaa"); // bright mint-green — your territory
export const COLOR_ENEMY          = new THREE.Color("#ff4400"); // hot orange-red — enemy territory
export const COLOR_BATTLE         = new THREE.Color("#ff0055"); // hot pink-red — active battle
export const COLOR_SELECTED       = new THREE.Color("#ffe566"); // bright gold — selected plot highlight
export const COLOR_BORDER_OWNED   = new THREE.Color("#ffffff"); // white outline on owned
export const COLOR_BORDER_UNOWNED = new THREE.Color("#4fc3f7"); // bright cyan grid — visible on all terrain
export const COLOR_SUBDIVIDED     = new THREE.Color(0x1a3a5c); // dark-blue tint for subdivided macro-plots

// ── Biome colors — neon zone aesthetic ───────────────────────────────────────
// forest   = Storm Belt    | desert   = Canyon Zone  | mountain = AI Nexus
// plains   = Launch Dist.  | water    = Aquatic Rift | tundra   = Ice Sector
// volcanic = Volcanic Core | swamp    = Arena District
export const BIOME_COLORS: Record<string, THREE.Color> = {
  forest:   new THREE.Color("#39ff14"), // Storm Belt → electric green
  desert:   new THREE.Color("#ff8a00"), // Canyon Zone → signal orange
  mountain: new THREE.Color("#c000ff"), // AI Nexus → ion purple
  plains:   new THREE.Color("#00ffd5"), // Launch District → orbital teal
  water:    new THREE.Color("#00ccff"), // Aquatic Rift → neon cyan
  tundra:   new THREE.Color("#bfe9ff"), // Ice Sector → pale blue
  volcanic: new THREE.Color("#ff5a36"), // Volcanic Core → hot orange-red
  swamp:    new THREE.Color("#ff4dca"), // Arena District → neon magenta
};

// ── Sub-parcel archetype colors ───────────────────────────────────────────────
// resource = industrial orange | trade = gold | energy = electric cyan | fortress = military red
export const ARCHETYPE_COLORS: Record<string, THREE.Color> = {
  resource: new THREE.Color("#ff8a00"),
  trade:    new THREE.Color("#ffd700"),
  energy:   new THREE.Color("#00e5ff"),
  fortress: new THREE.Color("#ff3366"),
};

// ── Plot size variants — subtle natural variety without overlap artifacts ─────
export const SIZE_VARIANTS = [1.0, 1.04, 0.96, 1.06, 0.98, 1.02, 0.95, 1.05];

// ── Battle arc rendering ──────────────────────────────────────────────────────
export const ARC_LIFT_BASE   = 1.4;
export const ARC_LIFT_SCALE  = 0.6;
export const PROJECTILE_SIZE = 0.018;
export const ARC_TUBE_RADIUS = 0.006;
export const ARC_SEGMENTS    = 48;
export const FADE_DURATION   = 1500;

// ── Mining pulse ──────────────────────────────────────────────────────────────
export const PULSE_DURATION = 600;

// ── Orbital zone events ───────────────────────────────────────────────────────
export const ORBITAL_ZONE_COLORS: Record<string, string> = {
  ATMOSPHERIC_BURST: "#ff6622",
  IMPACT_STRIKE:     "#ff1744",
  METEOR_SHOWER:     "#ff9944",
  SINGLE_BOLIDE:     "#ffcc22",
  COMET_PASS:        "#aaddff",
  ORBITAL_DEBRIS:    "#aaaaaa",
};
export const ZONE_BASE_RADIUS = 0.12;

// ── Satellite orbit ───────────────────────────────────────────────────────────
export const SAT_ORBIT_RADIUS  = GLOBE_RADIUS + 0.45;
export const SAT_ORBIT_SPEED   = 0.003; // radians per second (visual)
export const SAT_SPHERE_RADIUS = 0.035;

// ── Stream camera ─────────────────────────────────────────────────────────────
/** How long the stream camera dwells on each battle hotspot (ms). */
export const STREAM_DWELL_MS = 15_000;

// ── Camera fly-to ─────────────────────────────────────────────────────────────
export const FLY_DISTANCE = GLOBE_RADIUS * 2.8;
export const FLY_SPEED    = 0.055;
export const FLY_DONE_SQ  = 0.0004;

// ── PlotOverlay sizing ────────────────────────────────────────────────────────
export const FILL_SIZE   = GLOBE_RADIUS * 0.022;
export const BORDER_SIZE = GLOBE_RADIUS * 0.026;

// ── SubParcel sizing ──────────────────────────────────────────────────────────
export const SUB_FILL_SIZE   = GLOBE_RADIUS * 0.018;  // visible 3×3 cell fill
export const SUB_BORDER_SIZE = GLOBE_RADIUS * 0.020;  // slightly larger for outline
export const SUB_SPACING     = GLOBE_RADIUS * 0.019;  // gap between cell centers
export const MAX_SUB_TILES   = 9 * 500;
/** Sub-parcel 3×3 grids only render when the camera is closer than this (LOD). */
export const SUB_PARCEL_LOD_DISTANCE = GLOBE_RADIUS * 2.6;

/** Fog of war: reveal radius around each owned plot (euclidean, globe units). */
export const FOG_REVEAL_RADIUS = GLOBE_RADIUS * 0.085;

// ── Terraform visual stages ───────────────────────────────────────────────────
// 5 stages driven by parcel.terraformLevel (cumulative action count).
// Stage 0 = raw land, Stage 4 = fully ascended floating-island tech.
export const TERRAFORM_STAGE_MAX = 4;
// Per-stage altitude multiplier above the globe surface (replaces the static 1.018).
export const TERRAFORM_ALTITUDE = [1.018, 1.020, 1.023, 1.027, 1.032];
// Per-stage fill scale (subtle size growth as the plot "develops").
export const TERRAFORM_SCALE = [1.0, 1.02, 1.05, 1.08, 1.12];
// Per-stage glow/emissive intensity multiplier (applied to base color).
export const TERRAFORM_GLOW = [0.0, 0.12, 0.25, 0.42, 0.65];
// Per-stage border opacity boost (energy halo thickness).
export const TERRAFORM_BORDER_BOOST = [0.0, 0.05, 0.12, 0.22, 0.35];
// Per-stage border glow color — neutral cool tech by default.
export const TERRAFORM_BORDER_COLOR = new THREE.Color("#7fd4ff");
// Per-stage center color (used for stage 3-4 inner accent) — bright tech cyan.
export const TERRAFORM_ACCENT_COLOR = new THREE.Color("#a8eaff");

// Hazard/stability visual thresholds.
export const HAZARD_DIM_THRESHOLD = 50;   // hazardLevel above this starts darkening the tile
export const HAZARD_DEGRADE_THRESHOLD = 60; // hazardLevel above this triggers degraded treatment
export const STABILITY_DIM_THRESHOLD = 30; // stability below this starts dimming the tile
// Hazard contamination color — warm amber/red overlay.
export const HAZARD_TINT = new THREE.Color("#ff4a1a");
export const DEGRADED_TINT = new THREE.Color("#5a1a0a");

// ── Terraform stage 3-4 particle/halo layer ───────────────────────────────────
// Maximum number of plots that can simultaneously show the sparkle/halo effect.
// Selected/hovered plots are prioritised first, then owned-by-me plots.
export const MAX_TERRAFORM_EFFECTS = 1000;
// Per-stage sparkle count (0 = no effect, 3-4 only).
export const TERRAFORM_SPARKLE_COUNT_BY_STAGE = [0, 0, 0, 4, 10];
// Halo (large soft disc) is rendered only on stage 3-4 plots at the population cap.
export const TERRAFORM_HALO_RADIUS = GLOBE_RADIUS * 0.035;   // soft disc around tile
export const TERRAFORM_SPARKLE_RADIUS = GLOBE_RADIUS * 0.005; // small sparkle dot
// Sprite base colors (additive blending, so the base color is the bloom source).
export const TERRAFORM_HALO_COLOR = new THREE.Color("#7fd4ff");
export const TERRAFORM_SPARKLE_COLOR = new THREE.Color("#e8f8ff");
// LOD: hide the entire sparkle/halo layer when the camera is farther than this.
// Stays visible at sub-continent zoom (~ GLOBE_RADIUS * 2.6) and hides at planet view.
export const TERRAFORM_FX_LOD_DISTANCE = GLOBE_RADIUS * 3.0;
