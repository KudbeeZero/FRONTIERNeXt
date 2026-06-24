/**
 * shared/battle-sequence.ts
 *
 * FRONTIER Battle Sequence Engine — the cinematic spine of a battle.
 *
 * The deterministic resolver (`server/engine/battle/resolve.ts`) decides *who
 * wins*; `buildReplayLog` narrates it in prose. Neither produces a structured,
 * timed sequence a renderer can drive arcs / telegraph lines / impact flashes
 * off of. THIS module does: it turns a resolved (or about-to-resolve) battle
 * into one gapless, absolutely-timed timeline of 10 beats — muster → lock →
 * launch → transit → brace → impact → clash → swing → resolve → aftermath —
 * that the globe, the watch modal, and any future replay UI all sample off a
 * single clock. That shared clock IS "the lines connecting everything together
 * when there's a battle": telegraph, flight, impact and capture stop being
 * disconnected layers and become one sequence.
 *
 * CONTRACT:
 *   - PURE: given identical input, returns an identical sequence. No DB, no
 *     network, no randomness, no Date.now, no Three.js / DOM. Importable by both
 *     the Node server and the Vite client.
 *   - The matchup outcome is an INPUT (from the resolver) — this engine never
 *     re-decides a winner; it only choreographs the one already decided.
 *   - SECURITY: captions carry only display names, plot id, biome, powers and
 *     resource counts — never wallet addresses or raw UUIDs (a sequence may be
 *     shipped to clients alongside the public replay record). Display names are
 *     caller-supplied, exactly as in `buildReplayLog`.
 */

import {
  MUSTER_BASE_MS,
  MUSTER_PER_TROOP_MS,
  MUSTER_MAX_MS,
  LOCK_MS,
  LAUNCH_MS,
  TRANSIT_BASE_MS,
  TRANSIT_PER_RAD_MS,
  TRANSIT_MAX_MS,
  BRACE_MS,
  IMPACT_MS,
  CLASH_MS,
  SWING_BASE_MS,
  SWING_PER_FACTOR_MS,
  SWING_FLIP_BONUS_MS,
  RESOLVE_MS,
  AFTERMATH_MS,
  TROOP_INTENSITY_K,
  POWER_INTENSITY_K,
  SPOILS_INTENSITY_K,
  FORT_INTENSITY_K,
  MIN_INTENSITY,
} from "./battle-sequence-tuning";

// ── Public types ───────────────────────────────────────────────────────────────

/** A point on the planet (degrees). Plot id → lat/lng is the caller's job. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export type BattleOutcome = "attacker_wins" | "defender_wins";

/**
 * The ten connected beats of a battle, in canonical order. The engine emits a
 * timed instance of each, exactly once, gaplessly.
 */
export type BattleBeatKind =
  | "muster" //     1. attacker charges — an attack is forming
  | "lock" //       2. telegraph line reaches attacker → defender
  | "launch" //     3. strike leaves the source plot
  | "transit" //    4. strike travels the great-circle arc
  | "brace" //      5. defender raises shields / fortifications
  | "impact" //     6. strike lands
  | "clash" //      7. attacker power vs defender power collide
  | "swing" //      8. the randFactor luck swing
  | "resolve" //    9. VICTORY / DEFENSE HELD
  | "aftermath"; // 10. capture + spoils, or the defender holds

/** Canonical beat order. Exported so renderers can pre-allocate / index. */
export const BEAT_ORDER: readonly BattleBeatKind[] = [
  "muster",
  "lock",
  "launch",
  "transit",
  "brace",
  "impact",
  "clash",
  "swing",
  "resolve",
  "aftermath",
] as const;

/** One timed beat of the cinematic. Pure timing + a dramatic weight + a caption. */
export interface BattleBeat {
  kind: BattleBeatKind;
  /** Absolute start offset from the start of the sequence, ms. */
  startMs: number;
  /** Length of the beat, ms (> 0). */
  durationMs: number;
  /** 0…1 dramatic weight — drives FX scale / volume / line thickness. */
  intensity: number;
  /** Short, display-only caption (telemetry line / subtitle). No ids/addresses. */
  caption: string;
}

export interface Combatant {
  /** Display name (faction or player handle) — caller-sanitised. */
  name: string;
  /** Final power that entered the clash. */
  power: number;
  /** Optional colour hint (e.g. faction colour) for the renderer. */
  color?: string;
}

export interface Spoils {
  iron: number;
  fuel: number;
  crystal: number;
}

/**
 * The fully-built cinematic. Structural data (endpoints, powers, outcome,
 * spoils) lives here, constant across the sequence; the per-frame motion lives
 * in `beats`. A renderer reads geometry/colours from here and timing from beats.
 */
export interface BattleSequence {
  battleId: string;
  /** Total wall-clock length of the cinematic, ms (= end of the last beat). */
  durationMs: number;
  beats: BattleBeat[];

  // Geometry the renderer draws the arc between.
  source: GeoPoint;
  target: GeoPoint;
  /** Angular (great-circle) distance source→target, radians (0…π). */
  arcRadians: number;
  plotId: number;
  biome: string;

  attacker: Combatant;
  defender: Combatant;

  outcome: BattleOutcome;
  /** Attacker took the plot (outcome === "attacker_wins"). */
  captured: boolean;
  /** randFactor that decided the clash, -RAND_FACTOR_MAX…+RAND_FACTOR_MAX. */
  randFactor: number;
  /** True when the luck swing flipped the result vs. the raw power compare. */
  swingDecided: boolean;

  spoils: Spoils;
  /** Colour the renderer can recolour the captured plot with (victor's colour). */
  victorColor?: string;
}

/** Input — everything the engine needs, all derivable from a battle row + result. */
export interface BattleSequenceInput {
  battleId: string;
  source: GeoPoint;
  target: GeoPoint;
  plotId: number;
  biome: string;

  attackerName: string;
  /** null/undefined ⇒ a neutral/unowned defender ("the garrison"). */
  defenderName?: string | null;
  attackerColor?: string;
  defenderColor?: string;

  /** Final adjusted attacker power (post-randFactor) — matches BattleResult.attackerPower. */
  attackerPower: number;
  defenderPower: number;
  /** randFactor from the resolver, -RAND_FACTOR_MAX…+RAND_FACTOR_MAX. */
  randFactor: number;
  outcome: BattleOutcome;

  troopsCommitted: number;
  hasCommander?: boolean;
  /** Sum of defensive improvement levels (turret/shield_gen/fortress); 0 if none. */
  fortificationLevel?: number;

  pillagedIron?: number;
  pillagedFuel?: number;
  pillagedCrystal?: number;
}

// ── Small pure helpers ───────────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Soft saturating curve x/(x+k) → 0…1; floored at MIN_INTENSITY so FX never dies. */
function saturate(x: number, k: number): number {
  const v = x <= 0 || !Number.isFinite(x) ? 0 : x / (x + k);
  return clamp01(Math.max(MIN_INTENSITY, v));
}

/** Great-circle (haversine) angular distance between two lat/lng points, radians. */
export function greatCircleRadians(a: GeoPoint, b: GeoPoint): number {
  const φ1 = a.lat * DEG2RAD;
  const φ2 = b.lat * DEG2RAD;
  const dφ = (b.lat - a.lat) * DEG2RAD;
  const dλ = (b.lng - a.lng) * DEG2RAD;
  const s =
    Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  // Clamp the radicand into [0,1] against float drift before asin.
  const d = 2 * Math.asin(Math.min(1, Math.sqrt(Math.max(0, s))));
  return clamp(d, 0, Math.PI);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// ── The engine ───────────────────────────────────────────────────────────────

/**
 * Build the timed, structured cinematic for one battle.
 *
 * Deterministic and side-effect-free. The outcome is taken from the input
 * (already decided by the resolver) — this only choreographs it.
 */
export function buildBattleSequence(input: BattleSequenceInput): BattleSequence {
  const captured = input.outcome === "attacker_wins";
  const defenderName =
    input.defenderName && input.defenderName.length > 0
      ? input.defenderName
      : "the garrison";

  const troops = Math.max(0, input.troopsCommitted | 0);
  const fort = Math.max(0, input.fortificationLevel ?? 0);
  const atkPower = Math.max(0, input.attackerPower);
  const defPower = Math.max(0, input.defenderPower);
  const randFactor = input.randFactor;

  const spoils: Spoils = {
    iron: Math.max(0, Math.round(input.pillagedIron ?? 0)),
    fuel: Math.max(0, Math.round(input.pillagedFuel ?? 0)),
    crystal: Math.max(0, Math.round(input.pillagedCrystal ?? 0)),
  };

  const arcRadians = greatCircleRadians(input.source, input.target);

  // Did the luck swing flip the result? Recover the pre-randFactor attacker power
  // (adjusted = base × (1 + rf/100)) and compare the raw matchup to the real one.
  const factor = 1 + randFactor / 100;
  const basePower = factor !== 0 ? atkPower / factor : atkPower;
  const rawAttackerWins = basePower > defPower;
  const swingDecided = rawAttackerWins !== captured;

  // ── Beat durations (data-scaled) ───────────────────────────────────────────
  const musterMs = clamp(
    MUSTER_BASE_MS + troops * MUSTER_PER_TROOP_MS,
    MUSTER_BASE_MS,
    MUSTER_MAX_MS,
  );
  const transitMs = clamp(
    TRANSIT_BASE_MS + arcRadians * TRANSIT_PER_RAD_MS,
    TRANSIT_BASE_MS,
    TRANSIT_MAX_MS,
  );
  const swingMs =
    SWING_BASE_MS +
    Math.abs(randFactor) * SWING_PER_FACTOR_MS +
    (swingDecided ? SWING_FLIP_BONUS_MS : 0);

  // ── Intensities (0…1) ──────────────────────────────────────────────────────
  const powerSum = atkPower + defPower;
  // Closer powers ⇒ tenser clash. Equal powers → 1; a blowout → near 0.
  const clashTension =
    powerSum > 0 ? clamp01(1 - Math.abs(atkPower - defPower) / powerSum) : 0;
  const spoilsTotal = spoils.iron + spoils.fuel + spoils.crystal;

  const intensities: Record<BattleBeatKind, number> = {
    muster: saturate(troops, TROOP_INTENSITY_K),
    lock: clamp01((input.hasCommander ? 0.65 : 0.45) + 0.0),
    launch: saturate(atkPower, POWER_INTENSITY_K),
    transit: clamp01(MIN_INTENSITY + arcRadians / Math.PI * 0.5),
    brace: clamp01(
      Math.max(saturate(defPower, POWER_INTENSITY_K), saturate(fort, FORT_INTENSITY_K)),
    ),
    impact: saturate(atkPower, POWER_INTENSITY_K),
    clash: clamp01(Math.max(MIN_INTENSITY, clashTension)),
    swing: clamp01(
      Math.max(
        MIN_INTENSITY,
        Math.abs(randFactor) / 10 + (swingDecided ? 0.35 : 0),
      ),
    ),
    resolve: captured ? 1 : 0.8,
    aftermath: captured
      ? saturate(spoilsTotal, SPOILS_INTENSITY_K)
      : MIN_INTENSITY,
  };

  // ── Captions (display-only; no ids/addresses) ──────────────────────────────
  const captions: Record<BattleBeatKind, string> = {
    muster:
      `${input.attackerName} musters ${troops} troops` +
      (input.hasCommander ? " under a commander" : ""),
    lock: `Target lock — plot #${input.plotId}`,
    launch: `${input.attackerName} launches the strike`,
    transit: `Inbound across the ${input.biome} sector`,
    brace:
      fort > 0
        ? `${defenderName} brace — fortifications L${fort}`
        : `${defenderName} brace for impact`,
    impact: `Impact at plot #${input.plotId}`,
    clash: `${round2(atkPower).toFixed(1)} vs ${round2(defPower).toFixed(1)}`,
    swing:
      randFactor === 0
        ? "The dice hold steady"
        : `Fortune swings ${randFactor > 0 ? "+" : ""}${randFactor}` +
          (swingDecided ? " — it flips the battle!" : ""),
    resolve: captured
      ? `VICTORY — ${input.attackerName} takes plot #${input.plotId}`
      : `DEFENSE HELD at plot #${input.plotId}`,
    aftermath: captured
      ? buildSpoilsCaption(input.attackerName, spoils)
      : `${input.attackerName}'s attack is repelled`,
  };

  // ── Lay the beats end-to-end (gapless) ──────────────────────────────────────
  const durations: Record<BattleBeatKind, number> = {
    muster: musterMs,
    lock: LOCK_MS,
    launch: LAUNCH_MS,
    transit: transitMs,
    brace: BRACE_MS,
    impact: IMPACT_MS,
    clash: CLASH_MS,
    swing: swingMs,
    resolve: RESOLVE_MS,
    aftermath: AFTERMATH_MS,
  };

  const beats: BattleBeat[] = [];
  let cursor = 0;
  for (const kind of BEAT_ORDER) {
    const durationMs = Math.max(1, Math.round(durations[kind]));
    beats.push({
      kind,
      startMs: cursor,
      durationMs,
      intensity: round2(intensities[kind]),
      caption: captions[kind],
    });
    cursor += durationMs;
  }

  return {
    battleId: input.battleId,
    durationMs: cursor,
    beats,
    source: input.source,
    target: input.target,
    arcRadians,
    plotId: input.plotId,
    biome: input.biome,
    attacker: { name: input.attackerName, power: round2(atkPower), color: input.attackerColor },
    defender: { name: defenderName, power: round2(defPower), color: input.defenderColor },
    outcome: input.outcome,
    captured,
    randFactor,
    swingDecided,
    spoils,
    victorColor: captured ? input.attackerColor : input.defenderColor,
  };
}

function buildSpoilsCaption(attackerName: string, spoils: Spoils): string {
  const parts = [
    `${spoils.iron} iron`,
    `${spoils.fuel} fuel`,
    ...(spoils.crystal > 0 ? [`${spoils.crystal} crystal`] : []),
  ];
  return `${attackerName} pillages ${parts.join(", ")}`;
}

// ── Sampling the timeline ──────────────────────────────────────────────────────

/** A beat that is live at a given time, with its local progress. */
export interface ActiveBeat {
  beat: BattleBeat;
  /** 0…1 progress through this beat at the sampled time. */
  progress: number;
}

/**
 * Every beat live at `tMs` (half-open intervals [start, start+duration)), with
 * its local 0…1 progress. With the v1 gapless layout this is 0 or 1 beats, but
 * the array shape is future-proof for intentionally overlapping beats. Returns
 * `[]` before 0 and at/after the end (the cinematic has settled).
 */
export function sampleSequence(seq: BattleSequence, tMs: number): ActiveBeat[] {
  const out: ActiveBeat[] = [];
  if (!Number.isFinite(tMs)) return out;
  for (const beat of seq.beats) {
    const end = beat.startMs + beat.durationMs;
    if (tMs >= beat.startMs && tMs < end) {
      out.push({ beat, progress: clamp01((tMs - beat.startMs) / beat.durationMs) });
    }
  }
  return out;
}

/** The single dominant (latest-started) live beat at `tMs`, or null if settled. */
export function beatAt(seq: BattleSequence, tMs: number): ActiveBeat | null {
  const active = sampleSequence(seq, tMs);
  return active.length ? active[active.length - 1] : null;
}

/** Overall 0…1 progress through the whole cinematic at `tMs` (for a master bar). */
export function progressAt(seq: BattleSequence, tMs: number): number {
  if (seq.durationMs <= 0) return 1;
  return clamp01(tMs / seq.durationMs);
}
