import { describe, it, expect } from "vitest";
import {
  ATTRIBUTE_BUDGET,
  ATTRIBUTE_SOFT_CAP,
  ZERO_ATTRIBUTES,
  validateBuild,
  effectiveAttributes,
  totalSpent,
  type AttributeBuild,
} from "./attributes";
import { deriveArchetype, ARCHETYPES } from "./archetypes";
import {
  computeBadges,
  badgeTierForScore,
  tierAtLeast,
  EMPTY_WEAPON_STATS,
  BADGE_TIER_THRESHOLDS,
} from "./badges";
import { isWeaponUnlocked, resolveUnlockedWeapons, emptyBadges } from "./unlocks";
import { getWeapon, ALL_WEAPONS } from "./catalog";
import { createDefaultProfile, recomputeDerived } from "./profile";

function build(p: Partial<AttributeBuild>): AttributeBuild {
  return { ...ZERO_ATTRIBUTES, ...p };
}

describe("attribute budget + tradeoff", () => {
  it("accepts a build within budget and rejects over-budget / over-cap", () => {
    expect(validateBuild(build({ firepower: 14, range: 14, guidance: 14 })).ok).toBe(true);
    const over = build({ firepower: 20, range: 20, guidance: 20, interception: 20 });
    expect(totalSpent(over)).toBeGreaterThan(ATTRIBUTE_BUDGET);
    expect(validateBuild(over).ok).toBe(false);
    expect(validateBuild(build({ firepower: 21 })).ok).toBe(false);
  });

  it("applies the tradeoff penalty past the soft cap", () => {
    // firepower over the soft cap taxes logistics (tension pair)
    const raw = build({ firepower: 18, logistics: 10 });
    const eff = effectiveAttributes(raw);
    expect(eff.firepower).toBe(18);
    expect(eff.logistics).toBeLessThan(10); // taxed by firepower overage
  });

  it("never penalizes a build that stays at/under the soft cap", () => {
    const raw = build({ firepower: ATTRIBUTE_SOFT_CAP, logistics: ATTRIBUTE_SOFT_CAP });
    expect(effectiveAttributes(raw)).toEqual(raw);
  });
});

describe("archetype derivation", () => {
  it("defaults when empty and specializes by top attributes", () => {
    expect(deriveArchetype(ZERO_ATTRIBUTES).id).toBe(ARCHETYPES.siege_baron.id);
    const aegis = deriveArchetype(build({ interception: 16, guidance: 10 }));
    expect(aegis.id).toBe("aegis_interceptor");
    const hyper = deriveArchetype(build({ firepower: 16, guidance: 12 }));
    expect(hyper.id).toBe("hypersonic_striker");
  });
});

describe("logistics / quartermaster discipline has a real payoff", () => {
  // Regression guard: before the loitering line + Swarm Commodore archetype existed,
  // a logistics build had NO archetype identity and the quartermaster badge unlocked
  // ZERO weapons. Both assertions reference symbols that did not exist before, so they
  // fail on the pre-change tree and pass after.
  it("derives a logistics-primary archetype (Swarm Commodore)", () => {
    expect(deriveArchetype(build({ logistics: 16, firepower: 10 })).id).toBe("swarm_commodore");
    expect(deriveArchetype(build({ logistics: 16 })).id).toBe("swarm_commodore");
  });

  it("makes the quartermaster badge unlock loitering munitions", () => {
    const qm = computeBadges(build({ logistics: 20 }), { ...EMPTY_WEAPON_STATS, shotsFired: 200 });
    expect(tierAtLeast(qm.quartermaster, "gold")).toBe(true);
    const unlocked = resolveUnlockedWeapons(qm);
    expect(unlocked.some((w) => w.category === "loitering")).toBe(true);
    // every loitering weapon is gated behind quartermaster — the discipline's payoff
    const loiter = ALL_WEAPONS.filter((w) => w.category === "loitering");
    expect(loiter.length).toBeGreaterThan(0);
    expect(loiter.every((w) => w.unlock.badge === "quartermaster")).toBe(true);
  });
});

describe("badges + unlocks", () => {
  it("climbs tiers by score thresholds", () => {
    expect(badgeTierForScore(0)).toBe("none");
    expect(badgeTierForScore(BADGE_TIER_THRESHOLDS.bronze)).toBe("bronze");
    expect(badgeTierForScore(BADGE_TIER_THRESHOLDS.hall_of_fame + 50)).toBe("hall_of_fame");
    expect(tierAtLeast("gold", "silver")).toBe(true);
    expect(tierAtLeast("bronze", "gold")).toBe(false);
  });

  it("gates weapons behind the right badge tier", () => {
    const apex = getWeapon("msl_hyper_4")!; // requires demolition: hall_of_fame
    expect(isWeaponUnlocked(apex, emptyBadges())).toBe(false);

    const maxFirepower = computeBadges(
      build({ firepower: 20 }),
      { ...EMPTY_WEAPON_STATS, kills: 200 },
    );
    expect(maxFirepower.demolition).toBe("hall_of_fame");
    expect(isWeaponUnlocked(apex, maxFirepower)).toBe(true);

    // base-tier weapon is available with no badges
    expect(isWeaponUnlocked(getWeapon("msl_ballistic_1")!, emptyBadges())).toBe(true);
  });

  it("resolves more weapons as badges grow", () => {
    const none = resolveUnlockedWeapons(emptyBadges()).length;
    const loaded = resolveUnlockedWeapons(
      computeBadges(build({ firepower: 20, interception: 20, range: 20 }), {
        ...EMPTY_WEAPON_STATS,
        kills: 300,
        intercepts: 300,
        longRangeHits: 300,
      }),
    ).length;
    expect(loaded).toBeGreaterThan(none);
  });
});

describe("player profile", () => {
  it("creates a consistent default profile and recomputes derived fields", () => {
    const p = createDefaultProfile(1000);
    expect(p.archetypeId).toBe(ARCHETYPES.siege_baron.id);
    expect(p.ownedWeapons).toEqual([]);
    expect(Object.values(p.badges).every((t) => t === "none")).toBe(true);

    const built = recomputeDerived({
      ...p,
      attributes: build({ interception: 18, guidance: 12 }),
      stats: { ...EMPTY_WEAPON_STATS, intercepts: 40 },
    });
    expect(built.archetypeId).toBe("aegis_interceptor");
    expect(tierAtLeast(built.badges.aegis, "silver")).toBe(true);
    expect(built.unlockedAnimations).toContain("intercept_kinetic_flash");
  });
});
