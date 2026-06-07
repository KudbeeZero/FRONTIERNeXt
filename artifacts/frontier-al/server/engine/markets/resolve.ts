/**
 * server/engine/markets/resolve.ts
 *
 * Pure, deterministic core of the PROVABLY-FAIR prediction market resolver.
 *
 * These functions contain NO I/O. The storage layer reads the authoritative facts
 * (a battle row, a parcel owner, a burn total, a territory count) and hands them to
 * `deriveOutcome`, which computes the winning side by a published formula. Anyone can
 * re-run `deriveOutcome` / `hashResolution` on the same public inputs and get the same
 * answer — that is the verifiability guarantee. There is no admin-chosen-outcome path.
 *
 * Mirrors the battle-engine split (pure `resolveBattle` + storage wiring + spec).
 */

import { createHash } from "crypto";
import type { MarketOutcome, ResolutionSource } from "@shared/schema";

/** Authoritative facts the storage layer reads for each resolution-source type. */
export interface BattleFact {
  /** True if the battle's attacker won (battle.outcome === "attacker_wins"). */
  attackerWon: boolean;
}
export interface OwnershipFact {
  /** Current owner id of the parcel, or null if unowned. */
  owner: string | null;
}
export interface BurnFact {
  /** Total FRONTIER burned across the economy. */
  burned: number;
}
export interface TerritoryFact {
  /** Number of parcels owned by the target identity. */
  count: number;
}

export type ResolutionFact = BattleFact | OwnershipFact | BurnFact | TerritoryFact;

/**
 * Derive the winning outcome from a source + the facts read for it.
 * Convention: outcome "a" when the predicted condition holds, else "b".
 *
 * Pure: same (source, facts) always yields the same outcome.
 */
export function deriveOutcome(source: ResolutionSource, facts: ResolutionFact): MarketOutcome {
  switch (source.type) {
    case "battle_outcome":
      return (facts as BattleFact).attackerWon ? "a" : "b";
    case "ownership_at_turn":
      return (facts as OwnershipFact).owner === source.ownerId ? "a" : "b";
    case "burn_threshold":
      return (facts as BurnFact).burned >= source.amount ? "a" : "b";
    case "territory_count":
      return (facts as TerritoryFact).count >= source.threshold ? "a" : "b";
    default: {
      // Exhaustiveness guard — a new source type must add a branch above.
      const _never: never = source;
      throw new Error(`Unknown resolution source: ${JSON.stringify(_never)}`);
    }
  }
}

/** Context the resolver knows when deciding whether a market can yet be resolved. */
export interface ResolvabilityContext {
  now: number;
  cutoffTs: number;
  currentTurn: number;
  /** For battle markets: whether the referenced battle has resolved. */
  battleResolved?: boolean;
}

/**
 * Whether the resolving fact is knowable yet. Staking must be closed (cutoff passed)
 * AND the underlying fact must exist (battle resolved / target turn reached). The
 * cutoff is set before the fact is knowable, so the dev gets no special timing.
 *
 * Pure: no clock access — `now` is passed in.
 */
export function isResolvable(source: ResolutionSource, ctx: ResolvabilityContext): boolean {
  if (ctx.now < ctx.cutoffTs) return false;
  switch (source.type) {
    case "battle_outcome":
      return ctx.battleResolved === true;
    case "ownership_at_turn":
      return ctx.currentTurn >= source.turn;
    case "burn_threshold":
      return ctx.currentTurn >= source.byTurn;
    case "territory_count":
      return ctx.currentTurn >= source.turn;
    default: {
      const _never: never = source;
      throw new Error(`Unknown resolution source: ${JSON.stringify(_never)}`);
    }
  }
}

/**
 * Stable JSON stringify with recursively sorted object keys, so the proof hash is
 * independent of property insertion order. Arrays keep their order.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(",");
  return `{${body}}`;
}

/**
 * The verification hash recorded on resolution. Anyone with the source, inputs, and
 * outcome can recompute this and confirm the market resolved honestly.
 */
export function hashResolution(
  source: ResolutionSource,
  inputs: Record<string, unknown>,
  outcome: MarketOutcome,
): string {
  return createHash("sha256")
    .update(stableStringify({ source, inputs, outcome }))
    .digest("hex");
}
