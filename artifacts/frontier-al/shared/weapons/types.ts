/**
 * shared/weapons/types.ts
 *
 * Core type system for the FRONTIER weapon system. Pure types + enums only —
 * imported by client, server, and the simulation layer. Mirrors the existing
 * `Record<Type, Info>` catalog style used by COMMANDER_INFO / SPECIAL_ATTACK_INFO
 * in shared/schema.ts.
 *
 * Design intent: every weapon carries BOTH real-world-grounded fields (rangeKm,
 * speedMps, flightProfile…) and game-scaled fields (damage, cooldownMs…). The
 * realism fields drive the simulation; the game-scaled fields drive balance.
 */

// ── Categories & profiles ─────────────────────────────────────────────────────

export type WeaponCategory =
  | "ballistic"        // tactical ballistic missile (high apex)
  | "cruise"           // subsonic terrain-following cruise missile
  | "hypersonic"       // boost-glide / depressed hypersonic
  | "artillery"        // towed/self-propelled gun (parabolic shell)
  | "rocket_artillery" // MLRS / HIMARS-class rockets
  | "anti_air"         // surface-to-air interceptor missile
  | "missile_defense"; // dedicated missile-defense battery

/** Offensive categories the player launches AT a target. */
export const OFFENSIVE_CATEGORIES: WeaponCategory[] = [
  "ballistic",
  "cruise",
  "hypersonic",
  "artillery",
  "rocket_artillery",
];

/** Defensive categories that intercept incoming fire. */
export const DEFENSIVE_CATEGORIES: WeaponCategory[] = ["anti_air", "missile_defense"];

export type FlightProfile =
  | "ballistic"   // high parabolic apex, steep terminal dive
  | "cruise_low"  // low-altitude great-circle, terrain-following
  | "boost_glide" // hypersonic depressed glide
  | "parabolic";  // artillery shell arc (lower apex than ballistic)

export type GuidanceType =
  | "inertial"
  | "gps"
  | "terrain"
  | "radar_homing"
  | "infrared"
  | "command"; // command-guided interceptor

// ── Progression keys (shared by catalog + progression layer) ──────────────────

export type AttributeKey =
  | "firepower"     // raw damage
  | "range"         // reach
  | "guidance"      // accuracy / harder to intercept
  | "interception"  // defensive Pk / radar
  | "logistics";    // reload / cooldown

export type BadgeKey =
  | "demolition"     // firepower line
  | "marksman"       // guidance line
  | "long_rifle"     // range line
  | "aegis"          // interception line
  | "quartermaster"; // logistics line

export type BadgeTier = "none" | "bronze" | "silver" | "gold" | "hall_of_fame";

// ── Interception envelope (defensive specs only) ──────────────────────────────

export interface InterceptEnvelope {
  /** Slant range (km) within which the battery can engage a track. */
  interceptRangeKm: number;
  /** Maximum engagement altitude (km). Low-tier point defense = low ceiling. */
  maxAltKm: number;
  /** Interceptor velocity (m/s) — closing speed drives Pk. */
  interceptorSpeedMps: number;
  /** Radar→launch reaction time (ms) before an interceptor can fly. */
  reactionMs: number;
  /** Base probability of kill (0..1) against a nominal target. */
  basePk: number;
  /** Shots available before a reload cycle. */
  magazine: number;
}

// ── The weapon spec ───────────────────────────────────────────────────────────

export interface WeaponSpec {
  id: string;
  name: string;
  category: WeaponCategory;
  /** Upgrade tier within its class (1 = base, 4 = apex). */
  tier: 1 | 2 | 3 | 4;
  /** Real-world system this is grounded in (documentation only — not gameplay). */
  realWorldRef: string;

  // ── realism (drives the simulation; scaled by scale.ts) ──
  /** Maximum range in kilometers. */
  rangeKm: number;
  /** Cruise/terminal velocity in meters/second. */
  speedMps: number;
  flightProfile: FlightProfile;
  guidance: GuidanceType;
  payloadKg: number;
  /** Circular Error Probable in meters (lower = more accurate). */
  cepM: number;

  // ── game-scaled (drives balance) ──
  damage: number;
  /** Splash radius in game units (see scale.ts). */
  splashRadius: number;
  cooldownMs: number;
  /** FRNTR cost to fire one shot. */
  costFrntr: number;

  // ── progression gating ──
  /** Which attribute powers/upgrades this weapon. */
  attributeAffinity: AttributeKey;
  /** Badge + tier required to unlock this weapon in the catalog. */
  unlock: { badge: BadgeKey; tier: BadgeTier };

  /** Present only for defensive categories (anti_air / missile_defense). */
  intercept?: InterceptEnvelope;
}

/** Narrowing helper: a defensive spec is guaranteed to carry an envelope. */
export interface DefenseSpec extends WeaponSpec {
  category: "anti_air" | "missile_defense";
  intercept: InterceptEnvelope;
}

export function isDefenseSpec(spec: WeaponSpec): spec is DefenseSpec {
  return spec.intercept !== undefined && DEFENSIVE_CATEGORIES.includes(spec.category);
}
