/**
 * shared/energyGrid.ts
 *
 * Deterministic sub-plot ENERGY-GRID SIMULATION contract (Phase 2).
 *
 * This module is a pure, deterministic, side-effect-free simulator. It has
 * ZERO production integration:
 *
 *  - No schema, migration, seed, route, or persistence is touched.
 *  - No database, timer, random value, or wall-clock read is made.
 *  - No gameplay resolver, AI loop, or UI consumes these functions yet.
 *  - `computeGridPowerDependency()` (server/storage/game-rules.ts) is NOT
 *    modified; it remains the production power-dependency path. A later phase
 *    may adapt it to this simulator or replace it after integration.
 *
 * All quantities are non-negative safe integers. Invalid inputs are REJECTED
 * (throwing `EnergyGridValidationError`) rather than silently guessed.
 *
 * Alignment (`helios` | `aegis` | `nexus`) is echoed into facility results but
 * has NO numerical effect in Phase 2.
 */

import type { EnergyAlignment } from "./schema";
import { isFacilityArchetypeId, type FacilityArchetypeId } from "./subplotArchitecture";

// ---------------------------------------------------------------------------
// Closed value sets
// ---------------------------------------------------------------------------

/** A unit of energy on the grid. Always a non-negative safe integer. */
export type EnergyUnits = number;

/** Allocation priority tier. Critical is served first. */
export type EnergyPriority = "critical" | "high" | "normal" | "low";

/** The requested-demand profile selector for a facility. */
export type FacilityOperatingMode = "standby" | "operational" | "active" | "burst";

/** Outcome of a facility's power allocation for a tick. */
export type FacilityPowerState = "fully_powered" | "reduced" | "offline";

const PRIORITY_RANK: Record<EnergyPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const VALID_PRIORITIES = new Set<string>(["critical", "high", "normal", "low"]);
const VALID_MODES = new Set<string>(["standby", "operational", "active", "burst"]);
const VALID_ALIGNMENTS = new Set<string>(["helios", "aegis", "nexus"]);

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/**
 * Caller-supplied numeric energy demand for a facility. These are NUMERIC
 * (unlike Phase 1's qualitative `EnergyDemand`/`BurstDemand` labels). The
 * simulator never converts Phase 1 labels into numbers.
 */
export interface NumericFacilityEnergyProfile {
  standbyDemand: EnergyUnits;
  operationalDemand: EnergyUnits;
  activeDemand: EnergyUnits;
  burstDemand: EnergyUnits;
  minimumSustainableDemand: EnergyUnits;
}

export interface EnergyProducerInput {
  id: string;
  generation: EnergyUnits;
}

export interface EnergyConsumerInput {
  instanceId: string;
  archetypeId: string;
  operatingMode: FacilityOperatingMode;
  priority: EnergyPriority;
  /** Explicit tiebreaker within a priority tier. Must be unique when present. */
  allocationOrder?: number;
  alignment: EnergyAlignment;
  profile: NumericFacilityEnergyProfile;
}

export interface EnergyStorageInput {
  capacity: EnergyUnits;
  initialStored: EnergyUnits;
  reserveFloor: EnergyUnits;
  maxChargeRate: EnergyUnits;
  maxDischargeRate: EnergyUnits;
}

/**
 * Tunables for deficit handling. `enforceReserveFloor` (default true) prevents
 * storage from discharging below `reserveFloor` during a deficit.
 */
export interface BrownoutPolicy {
  enforceReserveFloor?: boolean;
}

export interface EnergyGridInput {
  producers: EnergyProducerInput[];
  consumers: EnergyConsumerInput[];
  storage?: EnergyStorageInput;
  policy?: BrownoutPolicy;
}

export interface FacilityEnergyResult {
  instanceId: string;
  archetypeId: FacilityArchetypeId;
  alignment: EnergyAlignment;
  operatingMode: FacilityOperatingMode;
  priority: EnergyPriority;
  allocationOrder: number | null;
  requested: EnergyUnits;
  allocated: EnergyUnits;
  minimumSustainableDemand: EnergyUnits;
  powerState: FacilityPowerState;
}

export interface EnergyGridResult {
  totalGeneration: EnergyUnits;
  totalRequested: EnergyUnits;
  totalAllocated: EnergyUnits;
  totalUnmet: EnergyUnits;
  startingStorage: EnergyUnits;
  charged: EnergyUnits;
  discharged: EnergyUnits;
  endingStorage: EnergyUnits;
  curtailedGeneration: EnergyUnits;
  brownout: boolean;
  blackout: boolean;
  facilities: FacilityEnergyResult[];
}

export class EnergyGridValidationError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[]) {
    super(message);
    this.name = "EnergyGridValidationError";
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isSafeNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && Number.isSafeInteger(v);
}

function checkInt(value: unknown, field: string, issues: string[]): void {
  if (!isSafeNonNegativeInt(value)) {
    issues.push(`${field} must be a non-negative safe integer, got ${JSON.stringify(value)}`);
  }
}

function demandForMode(mode: FacilityOperatingMode, profile: NumericFacilityEnergyProfile): number {
  switch (mode) {
    case "standby":
      return profile.standbyDemand;
    case "operational":
      return profile.operationalDemand;
    case "active":
      return profile.activeDemand;
    case "burst":
      return profile.burstDemand;
  }
}

/**
 * Validate a full grid input. Returns a normalized input (archetype IDs
 * narrowed) on success; throws `EnergyGridValidationError` with field-level
 * messages otherwise. Never silently coerces.
 */
export function validateEnergyGridInput(input: unknown): EnergyGridInput {
  const issues: string[] = [];

  if (typeof input !== "object" || input === null) {
    throw new EnergyGridValidationError("energy grid input must be an object", [
      `input must be an object, got ${JSON.stringify(input)}`,
    ]);
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.producers)) {
    issues.push("producers must be an array");
  }
  if (!Array.isArray(obj.consumers)) {
    issues.push("consumers must be an array");
  }

  if (issues.length > 0) {
    throw new EnergyGridValidationError("energy grid input invalid", issues);
  }

  const producers = obj.producers as EnergyProducerInput[];
  const consumers = obj.consumers as EnergyConsumerInput[];

  producers.forEach((p, i) => {
    if (typeof p?.id !== "string" || p.id.length === 0) {
      issues.push(`producers[${i}].id must be a non-empty string`);
    }
    checkInt(p?.generation, `producers[${i}].generation`, issues);
  });

  const seenInstanceIds = new Set<string>();
  const seenOrders = new Set<number>();

  consumers.forEach((c, i) => {
    const f = `consumers[${i}]`;

    if (typeof c?.instanceId !== "string" || c.instanceId.length === 0) {
      issues.push(`${f}.instanceId must be a non-empty string`);
    } else {
      if (seenInstanceIds.has(c.instanceId)) {
        issues.push(`${f}.instanceId duplicate facility instance id "${c.instanceId}"`);
      }
      seenInstanceIds.add(c.instanceId);
    }

    if (!isFacilityArchetypeId(c?.archetypeId)) {
      issues.push(`${f}.archetypeId unknown facility archetype "${c?.archetypeId}"`);
    }

    if (!VALID_MODES.has(c?.operatingMode)) {
      issues.push(`${f}.operatingMode unsupported mode "${c?.operatingMode}"`);
    }

    if (!VALID_PRIORITIES.has(c?.priority)) {
      issues.push(`${f}.priority unsupported priority "${c?.priority}"`);
    }

    if (c?.allocationOrder !== undefined) {
      if (!isSafeNonNegativeInt(c.allocationOrder)) {
        issues.push(`${f}.allocationOrder must be a non-negative safe integer, got ${JSON.stringify(c.allocationOrder)}`);
      } else {
        if (seenOrders.has(c.allocationOrder)) {
          issues.push(`${f}.allocationOrder duplicate explicit allocation-order value ${c.allocationOrder}`);
        }
        seenOrders.add(c.allocationOrder);
      }
    }

    if (!VALID_ALIGNMENTS.has(c?.alignment)) {
      issues.push(`${f}.alignment unsupported alignment "${c?.alignment}"`);
    }

    const profile = c?.profile as NumericFacilityEnergyProfile | undefined;
    if (typeof profile !== "object" || profile === null) {
      issues.push(`${f}.profile must be an object`);
    } else {
      checkInt(profile.standbyDemand, `${f}.profile.standbyDemand`, issues);
      checkInt(profile.operationalDemand, `${f}.profile.operationalDemand`, issues);
      checkInt(profile.activeDemand, `${f}.profile.activeDemand`, issues);
      checkInt(profile.burstDemand, `${f}.profile.burstDemand`, issues);
      checkInt(profile.minimumSustainableDemand, `${f}.profile.minimumSustainableDemand`, issues);

      if (
        isSafeNonNegativeInt(profile.standbyDemand) &&
        isSafeNonNegativeInt(profile.operationalDemand) &&
        isSafeNonNegativeInt(profile.activeDemand) &&
        isSafeNonNegativeInt(profile.burstDemand) &&
        isSafeNonNegativeInt(profile.minimumSustainableDemand) &&
        VALID_MODES.has(c?.operatingMode)
      ) {
        const requested = demandForMode(c.operatingMode, profile);
        if (requested < profile.minimumSustainableDemand) {
          issues.push(
            `${f} requested demand (${requested}) is below minimum sustainable demand (${profile.minimumSustainableDemand})`,
          );
        }
      }
    }
  });

  const storage = obj.storage as EnergyStorageInput | undefined;
  if (storage !== undefined) {
    checkInt(storage.capacity, "storage.capacity", issues);
    checkInt(storage.initialStored, "storage.initialStored", issues);
    checkInt(storage.reserveFloor, "storage.reserveFloor", issues);
    checkInt(storage.maxChargeRate, "storage.maxChargeRate", issues);
    checkInt(storage.maxDischargeRate, "storage.maxDischargeRate", issues);

    if (isSafeNonNegativeInt(storage.capacity) && isSafeNonNegativeInt(storage.initialStored)) {
      if (storage.initialStored > storage.capacity) {
        issues.push(`storage.initialStored (${storage.initialStored}) is above capacity (${storage.capacity})`);
      }
    }
    if (isSafeNonNegativeInt(storage.capacity) && isSafeNonNegativeInt(storage.reserveFloor)) {
      if (storage.reserveFloor > storage.capacity) {
        issues.push(`storage reserve floor (${storage.reserveFloor}) is above capacity (${storage.capacity})`);
      }
    }
  }

  if (issues.length > 0) {
    throw new EnergyGridValidationError(`energy grid input invalid (${issues.length} issue(s))`, issues);
  }

  return input as EnergyGridInput;
}

// ---------------------------------------------------------------------------
// Facility request helper
// ---------------------------------------------------------------------------

/**
 * Build a valid `EnergyConsumerInput` from caller-supplied parameters. The
 * requested demand is selected from the operating mode; the simulator does NOT
 * convert Phase 1 qualitative labels (low/high/extreme) into numbers — the
 * caller supplies explicit numeric demands via `profile`.
 *
 * Throws `EnergyGridValidationError` rather than silently guessing on unknown
 * archetype IDs or out-of-range numbers.
 */
export function createFacilityEnergyRequest(params: {
  instanceId: string;
  archetypeId: string;
  operatingMode: FacilityOperatingMode;
  priority: EnergyPriority;
  allocationOrder?: number;
  alignment: EnergyAlignment;
  profile: NumericFacilityEnergyProfile;
}): EnergyConsumerInput {
  const issues: string[] = [];

  if (typeof params.instanceId !== "string" || params.instanceId.length === 0) {
    issues.push("instanceId must be a non-empty string");
  }
  if (!isFacilityArchetypeId(params.archetypeId)) {
    issues.push(`archetypeId unknown facility archetype "${params.archetypeId}"`);
  }
  if (!VALID_MODES.has(params.operatingMode)) {
    issues.push(`operatingMode unsupported mode "${params.operatingMode}"`);
  }
  if (!VALID_PRIORITIES.has(params.priority)) {
    issues.push(`priority unsupported priority "${params.priority}"`);
  }
  if (params.allocationOrder !== undefined) {
    checkInt(params.allocationOrder, "allocationOrder", issues);
  }
  if (!VALID_ALIGNMENTS.has(params.alignment)) {
    issues.push(`alignment unsupported alignment "${params.alignment}"`);
  }

  const profile = params.profile;
  if (typeof profile !== "object" || profile === null) {
    issues.push("profile must be an object");
  } else {
    checkInt(profile.standbyDemand, "profile.standbyDemand", issues);
    checkInt(profile.operationalDemand, "profile.operationalDemand", issues);
    checkInt(profile.activeDemand, "profile.activeDemand", issues);
    checkInt(profile.burstDemand, "profile.burstDemand", issues);
    checkInt(profile.minimumSustainableDemand, "profile.minimumSustainableDemand", issues);

    if (
      isSafeNonNegativeInt(profile.standbyDemand) &&
      isSafeNonNegativeInt(profile.operationalDemand) &&
      isSafeNonNegativeInt(profile.activeDemand) &&
      isSafeNonNegativeInt(profile.burstDemand) &&
      isSafeNonNegativeInt(profile.minimumSustainableDemand) &&
      VALID_MODES.has(params.operatingMode)
    ) {
      const requested = demandForMode(params.operatingMode, profile);
      if (requested < profile.minimumSustainableDemand) {
        issues.push(
          `requested demand (${requested}) is below minimum sustainable demand (${profile.minimumSustainableDemand})`,
        );
      }
    }
  }

  if (issues.length > 0) {
    throw new EnergyGridValidationError(`facility energy request invalid: ${params.instanceId}`, issues);
  }

  return {
    instanceId: params.instanceId,
    archetypeId: params.archetypeId,
    operatingMode: params.operatingMode,
    priority: params.priority,
    allocationOrder: params.allocationOrder,
    alignment: params.alignment,
    profile: {
      standbyDemand: profile.standbyDemand,
      operationalDemand: profile.operationalDemand,
      activeDemand: profile.activeDemand,
      burstDemand: profile.burstDemand,
      minimumSustainableDemand: profile.minimumSustainableDemand,
    },
  };
}

// ---------------------------------------------------------------------------
// Simulation core
// ---------------------------------------------------------------------------

interface Work {
  consumer: EnergyConsumerInput;
  requested: number;
  order: number;
}

function buildOrderKey(c: EnergyConsumerInput): number {
  return c.allocationOrder ?? Number.MAX_SAFE_INTEGER;
}

function sortWorks(works: Work[]): void {
  works.sort((a, b) => {
    const pr = PRIORITY_RANK[a.consumer.priority] - PRIORITY_RANK[b.consumer.priority];
    if (pr !== 0) return pr;
    const ao = buildOrderKey(a.consumer) - buildOrderKey(b.consumer);
    if (ao !== 0) return ao;
    if (a.consumer.instanceId < b.consumer.instanceId) return -1;
    if (a.consumer.instanceId > b.consumer.instanceId) return 1;
    return 0;
  });
}

/**
 * Simulate a single deterministic energy-grid tick. Always produces the same
 * output for the same input. No timers, randomness, DB, or clock reads.
 */
export function simulateEnergyGrid(input: EnergyGridInput): EnergyGridResult {
  const validated = validateEnergyGridInput(input);
  const { producers, consumers, storage, policy } = validated;

  const capacity = storage ? storage.capacity : 0;
  const reserveFloor = storage ? storage.reserveFloor : 0;
  const enforceReserve = storage ? policy?.enforceReserveFloor ?? true : true;

  const totalGeneration = producers.reduce((sum, p) => sum + p.generation, 0);

  const works: Work[] = consumers.map((c) => ({
    consumer: c,
    requested: demandForMode(c.operatingMode, c.profile),
    order: buildOrderKey(c),
  }));

  const totalRequested = works.reduce((sum, w) => sum + w.requested, 0);

  sortWorks(works);

  let pool = totalGeneration;
  let storageLevel = storage ? storage.initialStored : 0;
  let discharged = 0;
  let didDischarge = false;

  const deficit = totalRequested - totalGeneration;
  if (deficit > 0 && storage) {
    const reserve = enforceReserve ? reserveFloor : 0;
    const available = Math.max(0, storageLevel - reserve);
    const discharge = Math.min(storage.maxDischargeRate, available, deficit);
    if (discharge > 0) {
      discharged = discharge;
      storageLevel -= discharge;
      pool += discharge;
      didDischarge = true;
    }
  }

  const facilities: FacilityEnergyResult[] = works.map((w) => {
    const min = w.consumer.profile.minimumSustainableDemand;
    let allocated = 0;
    // Sub-minimum rule: if the remaining pool is below this facility's
    // minimum, allocate zero and leave the energy in the pool so a later
    // facility with a smaller minimum may still use it.
    if (pool >= min) {
      allocated = Math.min(pool, w.requested);
      pool -= allocated;
    }

    let powerState: FacilityPowerState;
    if (allocated >= w.requested) powerState = "fully_powered";
    else if (allocated >= min) powerState = "reduced";
    else powerState = "offline";

    return {
      instanceId: w.consumer.instanceId,
      archetypeId: w.consumer.archetypeId as FacilityArchetypeId,
      alignment: w.consumer.alignment,
      operatingMode: w.consumer.operatingMode,
      priority: w.consumer.priority,
      allocationOrder: w.consumer.allocationOrder ?? null,
      requested: w.requested,
      allocated,
      minimumSustainableDemand: min,
      powerState,
    };
  });

  let charged = 0;
  let curtailedGeneration = 0;

  if (!didDischarge && pool > 0) {
    if (storage) {
      const room = capacity - storageLevel;
      const charge = Math.min(storage.maxChargeRate, room, pool);
      charged = charge;
      storageLevel += charge;
      curtailedGeneration = pool - charge;
    } else {
      // No storage to absorb surplus generation.
      curtailedGeneration = pool;
    }
  }

  const totalAllocated = facilities.reduce((sum, f) => sum + f.allocated, 0);
  const totalUnmet = totalRequested - totalAllocated;

  const requesting = facilities.filter((f) => f.requested > 0);
  const brownout = requesting.some((f) => f.powerState !== "fully_powered");
  const anyReceivedMinimum = requesting.some((f) => f.allocated >= f.minimumSustainableDemand);
  const blackout = requesting.length > 0 && !anyReceivedMinimum;

  return {
    totalGeneration,
    totalRequested,
    totalAllocated,
    totalUnmet,
    startingStorage: storage ? storage.initialStored : 0,
    charged,
    discharged,
    endingStorage: storageLevel,
    curtailedGeneration,
    brownout,
    blackout,
    facilities,
  };
}

/**
 * Simulate a bounded caller-supplied array of ticks. The ending storage of one
 * tick is threaded into the next tick's starting storage. No timers, random
 * values, database access, or current-time reads.
 */
export function simulateEnergyTicks(ticks: EnergyGridInput[]): EnergyGridResult[] {
  if (!Array.isArray(ticks)) {
    throw new EnergyGridValidationError("ticks must be an array", ["ticks must be an array"]);
  }

  const results: EnergyGridResult[] = [];
  let carryStorage: number | null = null;

  for (const tick of ticks) {
    const effective: EnergyGridInput =
      carryStorage === null || !tick.storage
        ? tick
        : {
            ...tick,
            storage: { ...tick.storage, initialStored: carryStorage },
          };

    const result = simulateEnergyGrid(effective);
    results.push(result);
    carryStorage = result.endingStorage;
  }

  return results;
}
