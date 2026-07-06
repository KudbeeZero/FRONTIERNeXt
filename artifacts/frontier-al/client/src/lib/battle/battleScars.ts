/**
 * client/src/lib/battle/battleScars.ts
 *
 * Pure derivation for Unit B3 "Battle Scars" — persistent aftermath decals.
 * Today the globe forgets a battle 12 seconds after
 * `GlobeBattleSequence`'s cinematic fades. This turns resolved-battle records
 * (seeded from `GET /api/battles/history`, appended live off
 * `battle:resolved`) into fading, capped, deduped marks so the map reads as a
 * war history: a scorch ring where a plot was captured, a shield glint where
 * a defense held — both scaled by the real power differential and decaying
 * with age.
 *
 * CONTRACT: pure — no clock, no Three.js, no fetch. The caller supplies `now`
 * and the raw records; colors are resolved by the caller (`factionColor`).
 */

/** How long a scar remains visible before it fully fades (4 hours). */
export const MAX_SCAR_AGE_MS = 4 * 60 * 60 * 1000;
/** Hard cap on concurrently rendered scars (oldest-beyond-cap are dropped). */
export const MAX_SCARS = 40;

const POWER_DIFF_K = 40; // soft-saturating scale for the attacker/defender power differential

export interface BattleScarRecord {
  battleId: string;
  plotId: number;
  outcome: "attacker_wins" | "defender_wins";
  attackerPower: number;
  defenderPower: number;
  /** Epoch ms the battle resolved. */
  resolvedAt: number;
  /** Victor's color (attacker's on a capture, defender's on a held defense) — caller resolves via factionColor. */
  color: string;
}

export interface BattleScarVisual {
  battleId: string;
  plotId: number;
  captured: boolean;
  color: string;
  /** 0…1 — fades with age, 0 once past MAX_SCAR_AGE_MS. */
  opacity: number;
  /** 0…1 — soft-saturating scale of the power differential; bigger margin, bigger mark. */
  size: number;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function saturate(x: number, k: number): number {
  const v = x <= 0 || !Number.isFinite(x) ? 0 : x / (x + k);
  return clamp01(v);
}

/** 0…1, 1 when brand new, 0 at/after maxAgeMs, negative age (clock skew) treated as brand new. */
export function scarOpacityForAge(ageMs: number, maxAgeMs = MAX_SCAR_AGE_MS): number {
  if (!Number.isFinite(ageMs) || maxAgeMs <= 0) return 0;
  if (ageMs >= maxAgeMs) return 0;
  return clamp01(1 - Math.max(0, ageMs) / maxAgeMs);
}

/** 0…1 soft-saturating scale of the power differential (margin of victory). */
export function scarSizeForPowerDiff(attackerPower: number, defenderPower: number): number {
  return saturate(Math.abs(attackerPower - defenderPower), POWER_DIFF_K);
}

/**
 * Dedupe by battleId (last record wins — a live update refreshes a seeded
 * one), drop anything past its max age, compute opacity/size, sort newest
 * first, and cap to `maxScars`.
 */
export function deriveBattleScars(
  records: BattleScarRecord[],
  now: number,
  maxAgeMs = MAX_SCAR_AGE_MS,
  maxScars = MAX_SCARS,
): BattleScarVisual[] {
  const byId = new Map<string, BattleScarRecord>();
  for (const r of records) byId.set(r.battleId, r);

  const withAge = Array.from(byId.values())
    .map((r) => ({ r, ageMs: now - r.resolvedAt }))
    .filter(({ ageMs }) => scarOpacityForAge(ageMs, maxAgeMs) > 0)
    .sort((a, b) => a.ageMs - b.ageMs); // newest (smallest age) first

  return withAge.slice(0, maxScars).map(({ r, ageMs }) => ({
    battleId: r.battleId,
    plotId: r.plotId,
    captured: r.outcome === "attacker_wins",
    color: r.color,
    opacity: scarOpacityForAge(ageMs, maxAgeMs),
    size: scarSizeForPowerDiff(r.attackerPower, r.defenderPower),
  }));
}
