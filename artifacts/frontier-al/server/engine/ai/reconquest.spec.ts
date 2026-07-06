/**
 * server/engine/ai/reconquest.spec.ts
 *
 * Unit tests for the AI reconquest engine — pure functions, no I/O. Found with
 * zero test coverage during the 2026-07-06 battle/menu refactor audit; this
 * closes that gap before the module is added to the coverage gate.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateReconquest,
  shouldAbandonAfterCapture,
  deterrenceThreshold,
  FACTION_PROFILES,
  MIN_TERRITORIES_FOR_RECONQUEST,
  RECONQUEST_GRACE_PERIOD_MS,
  RECONQUEST_ATTEMPT_WINDOW_MS,
  type AiFactionState,
  type ContestedPlot,
} from "./reconquest.js";

const NOW = 1_000_000_000_000;
const ATTACK_BASE_COST = { iron: 100, fuel: 50 };

function ai(overrides: Partial<AiFactionState> = {}): AiFactionState {
  return {
    id: "ai-1",
    name: "NEXUS-7",
    behavior: "expansionist",
    iron: 10_000,
    fuel: 10_000,
    ownedTerritoryCount: 10,
    averageDefenseLevel: 5,
    moraleDebuffUntil: 0,
    attackCooldownUntil: 0,
    ...overrides,
  };
}

function plot(overrides: Partial<ContestedPlot> = {}): ContestedPlot {
  return {
    parcelId: "parcel-1",
    plotId: 1,
    richness: 50,
    capturedFromFaction: "NEXUS-7",
    capturedAt: NOW - RECONQUEST_GRACE_PERIOD_MS - 1000,
    handoverCount: 0,
    currentDefenseLevel: 1,
    ...overrides,
  };
}

describe("evaluateReconquest — gating conditions", () => {
  it("refuses when below the minimum territory floor", () => {
    const d = evaluateReconquest(
      ai({ ownedTerritoryCount: MIN_TERRITORIES_FOR_RECONQUEST - 1 }),
      [plot()],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(false);
    expect(d.reason).toBe("insufficient_territory");
  });

  it("refuses while the attack cooldown is active", () => {
    const d = evaluateReconquest(
      ai({ attackCooldownUntil: NOW + 1 }),
      [plot()],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(false);
    expect(d.reason).toBe("attack_cooldown_active");
  });

  it("refuses while a morale debuff is active", () => {
    const d = evaluateReconquest(
      ai({ moraleDebuffUntil: NOW + 1 }),
      [plot()],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(false);
    expect(d.reason).toBe("morale_debuff_active");
  });

  it("refuses when home defense is below the faction's floor (fortify first)", () => {
    const d = evaluateReconquest(
      ai({ name: "KRONOS", averageDefenseLevel: FACTION_PROFILES.KRONOS.minDefenseBeforeReconquest - 1 }),
      [plot()],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(false);
    expect(d.reason).toBe("fortifying_home_first");
  });

  it("refuses when resources are below the readiness threshold", () => {
    const d = evaluateReconquest(
      ai({ iron: 1, fuel: 1 }),
      [plot()],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(false);
    expect(d.reason).toBe("building_resources");
  });

  it("refuses when no contested plot is inside the grace/attempt window", () => {
    const tooFresh = plot({ capturedAt: NOW }); // hasn't cleared the grace period yet
    const tooOld = plot({ capturedAt: NOW - RECONQUEST_GRACE_PERIOD_MS - RECONQUEST_ATTEMPT_WINDOW_MS - 1 });
    const d = evaluateReconquest(ai(), [tooFresh, tooOld], NOW, 0.5, ATTACK_BASE_COST);
    expect(d.shouldAttempt).toBe(false);
    expect(d.reason).toBe("no_eligible_plots");
  });

  it("falls back to the NEXUS-7 profile for an unrecognized faction name", () => {
    const d = evaluateReconquest(
      ai({ name: "UNKNOWN-FACTION", averageDefenseLevel: FACTION_PROFILES["NEXUS-7"].minDefenseBeforeReconquest }),
      [plot()],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    // Same gates as NEXUS-7 apply — a well-resourced attempt should proceed.
    expect(d.shouldAttempt).toBe(true);
  });
});

describe("evaluateReconquest — target selection", () => {
  it("SPECTRE (prefersRichPlots) picks the richest eligible plot", () => {
    const poor = plot({ parcelId: "poor", richness: 70, plotId: 1 });
    const rich = plot({ parcelId: "rich", richness: 90, plotId: 2 });
    const d = evaluateReconquest(
      ai({ name: "SPECTRE", averageDefenseLevel: FACTION_PROFILES.SPECTRE.minDefenseBeforeReconquest }),
      [poor, rich],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(true);
    expect(d.targetParcelId).toBe("rich");
  });

  it("SPECTRE refuses when even the richest eligible plot is below the richness floor", () => {
    const d = evaluateReconquest(
      ai({ name: "SPECTRE", averageDefenseLevel: FACTION_PROFILES.SPECTRE.minDefenseBeforeReconquest }),
      [plot({ richness: 59 })],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(false);
    expect(d.reason).toBe("low_richness_not_worth_it");
  });

  it("non-SPECTRE factions pick a plot deterministically from randomValue", () => {
    const a = plot({ parcelId: "a", plotId: 1 });
    const b = plot({ parcelId: "b", plotId: 2 });
    const first = evaluateReconquest(ai(), [a, b], NOW, 0, ATTACK_BASE_COST);
    const second = evaluateReconquest(ai(), [a, b], NOW, 0.99, ATTACK_BASE_COST);
    expect(first.targetParcelId).toBe("a");
    expect(second.targetParcelId).toBe("b");
  });
});

describe("evaluateReconquest — commitment + escalation", () => {
  it("VANGUARD (raider) marks the decision as a raid with raid-flavored reason text", () => {
    const d = evaluateReconquest(
      ai({ name: "VANGUARD", averageDefenseLevel: FACTION_PROFILES.VANGUARD.minDefenseBeforeReconquest }),
      [plot()],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(true);
    expect(d.isRaid).toBe(true);
    expect(d.reason).toMatch(/raids plot/);
  });

  it("a non-raider faction's reason references reconquest, not raiding", () => {
    const d = evaluateReconquest(ai(), [plot()], NOW, 0.5, ATTACK_BASE_COST);
    expect(d.shouldAttempt).toBe(true);
    expect(d.isRaid).toBe(false);
    expect(d.reason).toMatch(/reconquering lost plot/);
  });

  it("never burns more resources than the faction actually has", () => {
    const d = evaluateReconquest(
      ai({ iron: 120, fuel: 40 }),
      [plot({ handoverCount: 10 })], // heavy escalation multiplier
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(true);
    expect(d.resourcesBurned.iron).toBeLessThanOrEqual(120);
    expect(d.resourcesBurned.fuel).toBeLessThanOrEqual(40);
  });

  it("escalates committed troops with the plot's handover count", () => {
    const cheap = evaluateReconquest(ai(), [plot({ handoverCount: 0 })], NOW, 0.5, ATTACK_BASE_COST);
    const escalated = evaluateReconquest(ai(), [plot({ handoverCount: 4 })], NOW, 0.5, ATTACK_BASE_COST);
    expect(cheap.shouldAttempt).toBe(true);
    expect(escalated.shouldAttempt).toBe(true);
    expect(escalated.troopsCommitted).toBeGreaterThan(cheap.troopsCommitted);
  });

  it("always commits at least one troop when attempting", () => {
    const d = evaluateReconquest(
      ai({ iron: ATTACK_BASE_COST.iron + 1, fuel: ATTACK_BASE_COST.fuel }),
      [plot()],
      NOW,
      0.5,
      ATTACK_BASE_COST,
    );
    expect(d.shouldAttempt).toBe(true);
    expect(d.troopsCommitted).toBeGreaterThanOrEqual(1);
  });
});

describe("shouldAbandonAfterCapture", () => {
  it("is true only for raider factions", () => {
    expect(shouldAbandonAfterCapture("VANGUARD")).toBe(true);
    expect(shouldAbandonAfterCapture("NEXUS-7")).toBe(false);
    expect(shouldAbandonAfterCapture("KRONOS")).toBe(false);
    expect(shouldAbandonAfterCapture("SPECTRE")).toBe(false);
  });

  it("defaults to false for an unrecognized faction (no NEXUS-7 fallback here)", () => {
    expect(shouldAbandonAfterCapture("UNKNOWN-FACTION")).toBe(false);
  });
});

describe("deterrenceThreshold", () => {
  it("decreases as handover count rises but never drops below 1", () => {
    const base = deterrenceThreshold("NEXUS-7", 0);
    const afterManyHandovers = deterrenceThreshold("NEXUS-7", 100);
    expect(afterManyHandovers).toBeLessThanOrEqual(base);
    expect(afterManyHandovers).toBeGreaterThanOrEqual(1);
  });

  it("falls back to the NEXUS-7 profile for an unrecognized faction", () => {
    expect(deterrenceThreshold("UNKNOWN-FACTION", 0)).toBe(deterrenceThreshold("NEXUS-7", 0));
  });
});
