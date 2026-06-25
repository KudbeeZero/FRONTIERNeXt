/**
 * client/tests/weaponStrike.spec.ts
 *
 * The offensive-strike eligibility logic that the StrikePanel renders from:
 * which owned weapons can fire at a target, from where, and why not. Uses real
 * catalog specs (with rangeKm overridden) so the offensive/defensive split and
 * range maths stay honest against the shared sim.
 */
import { describe, it, expect } from "vitest";
import type { WeaponSpec } from "@shared/weapons";
import { OFFENSIVE_WEAPONS, DEFENSIVE_WEAPONS } from "@shared/weapons";
import {
  eligibleStrikes,
  type CatalogEntryLike,
  type SourceParcel,
} from "../src/lib/weaponStrike";

const TARGET = { lat: 0, lng: 0 };
const offensive = OFFENSIVE_WEAPONS[0];
const defensive = DEFENSIVE_WEAPONS[0];

const parcel = (over: Partial<SourceParcel> = {}): SourceParcel => ({
  id: "p1",
  plotId: 1,
  lat: 0,
  lng: 0,
  ...over,
});
const entry = (spec: WeaponSpec, owned: boolean, fireCost = 100): CatalogEntryLike => ({
  spec,
  owned,
  fireCost,
});

describe("eligibleStrikes", () => {
  it("an owned offensive weapon with an in-range parcel can fire", () => {
    const [opt] = eligibleStrikes([entry({ ...offensive, rangeKm: 1e9 }, true)], [parcel()], TARGET);
    expect(opt.canFire).toBe(true);
    expect(opt.source?.id).toBe("p1");
    expect(opt.reason).toBeNull();
  });

  it("flags out-of-range when the nearest owned parcel exceeds the weapon's reach", () => {
    // rangeKm 0 with a non-coincident parcel → always out of range.
    const [opt] = eligibleStrikes(
      [entry({ ...offensive, rangeKm: 0 }, true)],
      [parcel({ lat: 5, lng: 5 })],
      TARGET,
    );
    expect(opt.canFire).toBe(false);
    expect(opt.source).toBeNull();
    expect(opt.reason).toMatch(/range/i);
  });

  it("reports having no territory to fire from", () => {
    const [opt] = eligibleStrikes([entry({ ...offensive, rangeKm: 1e9 }, true)], [], TARGET);
    expect(opt.canFire).toBe(false);
    expect(opt.reason).toMatch(/territory/i);
  });

  it("excludes defensive weapons (they are deployed, not fired)", () => {
    expect(eligibleStrikes([entry(defensive, true)], [parcel()], TARGET)).toHaveLength(0);
  });

  it("excludes weapons the player does not own", () => {
    expect(eligibleStrikes([entry({ ...offensive, rangeKm: 1e9 }, false)], [parcel()], TARGET)).toHaveLength(0);
  });

  it("picks the nearest owned parcel as the firing source", () => {
    const far = parcel({ id: "far", lat: 40, lng: 40 });
    const near = parcel({ id: "near", lat: 1, lng: 1 });
    const [opt] = eligibleStrikes([entry({ ...offensive, rangeKm: 1e9 }, true)], [far, near], TARGET);
    expect(opt.source?.id).toBe("near");
  });
});
