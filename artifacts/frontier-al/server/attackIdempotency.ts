// ─────────────────────────────────────────────────────────────────────────────
// Plot-attack idempotency — Phase 4A.
//
// Reuses the shared `action_nonces` DB-backed guard (two-phase claim → record/
// release → replay) but, unlike target-scoped actions (build/upgrade), keys the
// attack ONLY on `(player, action="attack", nonce)`. The plot target and all
// other attack parameters are folded into a canonical *payload fingerprint* that is
// stored alongside the claim. This makes the contract exactly:
//
//   • same attacker + same nonce + same payload        → replay original 200
//   • same attacker + same nonce + DIFFERENT payload → 409 conflict
//   • different attacker (same nonce string)            → distinct key, no collision
//
// We deliberately do NOT fold the target into the key: that would let a client
// reuse one nonce across many distinct attacks (one per target), defeating the
// "one key = one logical attack" guarantee. The fingerprint is what enforces
// "same key + different parameters → reject".
//
// The actor identity is ALWAYS the auth-verified player id (never the
// client-supplied `attackerId`) — see routes.ts `assertPlayerOwnership`.
// ─────────────────────────────────────────────────────────────────────────────

import type { AttackAction } from "@shared/schema";

export const ATTACK_IDEMPOTENCY_ACTION = "attack" as const;

/**
 * Idempotency scope for a plot attack — keyed on the auth-verified actor only.
 * NO target: the target (and every other parameter) lives in the fingerprint.
 */
export function attackIdempotencyScope(playerId: string): { playerId: string; action: string } {
  return { playerId, action: ATTACK_IDEMPOTENCY_ACTION };
}

/**
 * Canonical, deterministic payload fingerprint for a plot attack.
 *
 * Includes every field that affects attack *creation* (resource deduction,
 * battle insert, cooldown, event) plus the auth-verified actor. Constants are
 * normalized to a fixed-shape object and JSON-stringified with a stable key
 * order, so two semantically-identical attacks produce the same string and two
 * attacks that differ in ANY committed field produce different strings.
 *
 * No secrets / private wallet data — only game-facing plot ids + committed
 * amounts + the actor's public player id.
 */
export function attackPayloadFingerprint(playerId: string, action: AttackAction): string {
  const canonical = {
    actor: playerId,
    source: action.sourceParcelId ?? null,
    target: action.targetParcelId,
    troops: action.troopsCommitted,
    iron: action.resourcesBurned.iron,
    fuel: action.resourcesBurned.fuel,
    crystal: action.crystalBurned ?? 0,
    commander: action.commanderId ?? null,
  };
  return JSON.stringify(canonical);
}
