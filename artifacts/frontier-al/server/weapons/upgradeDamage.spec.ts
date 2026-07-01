import { describe, it, expect } from "vitest";
import { EngagementStore, WEAPON_UPGRADE_DAMAGE_PER_TIER } from "./engagementStore";
import { OFFENSIVE_WEAPONS } from "@shared/weapons";

/**
 * Regression: Armory weapon upgrades must actually affect combat. Before this,
 * engagementStore.launch used spec.damage flat and ignored upgradeTier, so a
 * paid-for upgrade had zero effect. These assert tier now scales impact damage.
 */
describe("weapon upgradeTier scales impact damage", () => {
  const spec = OFFENSIVE_WEAPONS[0];
  const base = {
    weaponSpecId: spec.id,
    attackerId: "p1",
    from: { lat: 0, lng: 0 },
    to: { lat: 1, lng: 1 },
    sourceParcelId: "s",
    targetParcelId: "t",
    now: 1_000,
  };

  it("tier 0 leaves base damage unchanged", () => {
    const store = new EngagementStore();
    const e = store.launch({ ...base, upgradeTier: 0 });
    expect(e.damage).toBe(spec.damage);
  });

  it("omitting upgradeTier is equivalent to tier 0", () => {
    const store = new EngagementStore();
    const e = store.launch({ ...base });
    expect(e.damage).toBe(spec.damage);
  });

  it("a higher tier does strictly more damage than tier 0", () => {
    const store = new EngagementStore();
    const t0 = store.launch({ ...base, upgradeTier: 0 });
    const t3 = store.launch({ ...base, upgradeTier: 3 });
    expect(t3.damage).toBeGreaterThan(t0.damage);
    expect(t3.damage).toBe(Math.round(spec.damage * (1 + 3 * WEAPON_UPGRADE_DAMAGE_PER_TIER)));
  });
});
