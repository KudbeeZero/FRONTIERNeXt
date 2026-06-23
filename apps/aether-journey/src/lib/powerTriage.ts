/**
 * powerTriage — the pure core of Chapter 3 "The Quiet Mutiny" (see CHAPTER_3_DESIGN.md).
 *
 * A scarcity/allocation mechanic: a limited power bus must be split across three
 * consumers (life-support = you, comms = home, aetherCore = her), each of which goes
 * `critical` below a minimum. Demands sum to more than the bus, so every solve is a
 * deliberate sacrifice. Starving Aether's core is the game's biggest `trust` swing.
 *
 * No React, no store — unit-tested (powerTriage.spec.ts) so the moral math is provable
 * and the resolver is a pure function of state. The store wires `trustDelta`/`flags`
 * into the shipped decision-core (`makeChoice`/trust) in a later unit.
 */

export type Consumer = "lifeSupport" | "comms" | "aetherCore";
export const CONSUMERS: readonly Consumer[] = ["lifeSupport", "comms", "aetherCore"];

export interface ConsumerSpec {
  /** Units at/above which this consumer runs nominal. */
  demand: number;
  /** Units below which this consumer is critical (its consequence fires). */
  min: number;
  /** Human-facing label for the HUD. */
  label: string;
}

export interface TriageConfig {
  /** Total units on the power bus before VESTA takes its cut. */
  busTotal: number;
  /** Units VESTA siphons while left loose. */
  vestaDrain: number;
  /** Units it costs to lock VESTA off the bus. */
  containCost: number;
  consumers: Record<Consumer, ConsumerSpec>;
}

export interface Allocation {
  lifeSupport: number;
  comms: number;
  aetherCore: number;
}

export type Tier = "critical" | "strained" | "nominal";

export interface TriageOutcome {
  allocation: Allocation;
  containVesta: boolean;
  /** Units left to allocate after VESTA (contain cost or drain). */
  available: number;
  /** Units the allocation actually spends. */
  used: number;
  remaining: number;
  /** Non-negative units that don't overspend the available bus. */
  valid: boolean;
  tiers: Record<Consumer, Tier>;
  /** Net trust change from this allocation (Aether's core is the driver). */
  trustDelta: number;
  /** Story flags this allocation sets (drive dialogue + later chapters). */
  flags: string[];
}

/** Units left for the three consumers after VESTA is contained or left loose. */
export function availableBus(config: TriageConfig, containVesta: boolean): number {
  return config.busTotal - (containVesta ? config.containCost : config.vestaDrain);
}

/** Which tier a consumer sits in for a given unit count. */
export function tierFor(units: number, spec: ConsumerSpec): Tier {
  if (units < spec.min) return "critical";
  if (units < spec.demand) return "strained";
  return "nominal";
}

const sum = (a: Allocation) => a.lifeSupport + a.comms + a.aetherCore;

// Trust swing driven by how well Aether's core is fed — the chapter's whole point.
const AETHER_TRUST: Record<Tier, number> = { nominal: 8, strained: 0, critical: -12 };
// Extra credit for visibly sacrificing yourself to keep her whole.
const STARVE_SELF_BONUS = 4;

/**
 * Resolve an allocation against a config — pure. `tiers` are always reported so the UI
 * can colour the board live; `valid` gates whether the store may commit, and the commit
 * effects (`flags` + `trustDelta`) are empty/zero for an invalid (overspent/negative)
 * allocation — nothing to persist until the board is legal.
 */
export function resolveTriage(
  config: TriageConfig,
  allocation: Allocation,
  containVesta: boolean,
): TriageOutcome {
  const available = availableBus(config, containVesta);
  const used = sum(allocation);
  const nonNegative =
    allocation.lifeSupport >= 0 && allocation.comms >= 0 && allocation.aetherCore >= 0;
  const valid = nonNegative && used <= available;

  const tiers: Record<Consumer, Tier> = {
    lifeSupport: tierFor(allocation.lifeSupport, config.consumers.lifeSupport),
    comms: tierFor(allocation.comms, config.consumers.comms),
    aetherCore: tierFor(allocation.aetherCore, config.consumers.aetherCore),
  };

  // `flags` + `trustDelta` are the COMMIT effects — only an allocation the store may
  // actually commit (valid) carries them, so a careless caller can't persist phantom
  // consequences for an overspent/negative board. `tiers` above stay unconditional for
  // live preview colouring.
  const flags: string[] = [];
  let trustDelta = 0;
  if (valid) {
    flags.push(containVesta ? "vesta_contained" : "vesta_loose");
    if (tiers.lifeSupport === "critical") flags.push("lifeSupport_critical");
    if (tiers.comms === "critical") flags.push("comms_lost");
    if (tiers.aetherCore === "critical") flags.push("aether_starved", "sacrificed_aether");
    // You went without to keep her whole.
    if (tiers.aetherCore === "nominal" && tiers.lifeSupport === "critical") {
      flags.push("starved_self");
    }
    trustDelta = AETHER_TRUST[tiers.aetherCore];
    if (flags.includes("starved_self")) trustDelta += STARVE_SELF_BONUS;
  }

  return {
    allocation,
    containVesta,
    available,
    used,
    remaining: available - used,
    valid,
    tiers,
    trustDelta,
    flags,
  };
}

/**
 * A balanced allocation that fills `min` for everyone first, then tops up toward
 * `demand` in priority order (Aether's core, then life-support, then comms) within the
 * available bus. Used by tests and the (later) trust-scaled hint; deterministic.
 */
export function balancedAllocation(config: TriageConfig, containVesta: boolean): Allocation {
  let left = availableBus(config, containVesta);
  const alloc: Allocation = { lifeSupport: 0, comms: 0, aetherCore: 0 };
  const order: Consumer[] = ["aetherCore", "lifeSupport", "comms"];

  // Pass 1: cover each min if the bus can afford it.
  for (const c of order) {
    const need = Math.min(config.consumers[c].min, left);
    alloc[c] += need;
    left -= need;
  }
  // Pass 2: top up toward demand in priority order with whatever remains.
  for (const c of order) {
    const room = config.consumers[c].demand - alloc[c];
    const add = Math.max(0, Math.min(room, left));
    alloc[c] += add;
    left -= add;
  }
  return alloc;
}
