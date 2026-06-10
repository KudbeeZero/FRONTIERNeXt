import { describe, it, expect, beforeEach } from "vitest";
import { EngagementStore, ENGAGEMENT_FADE_MS } from "./engagementStore";
import type { GeoPoint } from "@shared/weapons";

const FROM: GeoPoint = { lat: 0, lng: 0 };
const TARGET: GeoPoint = { lat: 0, lng: 5 }; // ~105 km away

function launchCruise(store: EngagementStore, attackerId = "p1", now = 1000) {
  return store.launch({
    weaponSpecId: "msl_cruise_1",
    attackerId,
    from: FROM,
    to: TARGET,
    sourceParcelId: "src",
    targetParcelId: "dst",
    now,
  });
}

describe("EngagementStore", () => {
  let store: EngagementStore;
  beforeEach(() => {
    store = new EngagementStore();
  });

  it("launches an in-flight engagement when undefended", () => {
    const e = launchCruise(store);
    expect(e.status).toBe("in_flight");
    expect(e.impactTs).toBe(e.launchTs + e.tof);
    expect(store.active(1000)).toHaveLength(1);
  });

  it("expires engagements after the fade window", () => {
    const e = launchCruise(store);
    expect(store.active(e.impactTs + 1)).toHaveLength(1);
    expect(store.active(e.impactTs + ENGAGEMENT_FADE_MS + 1)).toHaveLength(0);
    expect(store.prune(e.impactTs + ENGAGEMENT_FADE_MS + 1)).toBe(1);
    expect(store.get(e.id)).toBeUndefined();
  });

  it("ignores the attacker's own batteries", () => {
    const battery = store.deployDefense({ specId: "def_aegis", ownerId: "p1", parcelId: "dst", at: TARGET });
    const e = launchCruise(store, "p1");
    expect(e.status).toBe("in_flight");
    expect(store.listBatteries()[0].magazineRemaining).toBe(battery.magazineRemaining); // untouched
  });

  it("a far-away enemy battery cannot engage", () => {
    const battery = store.deployDefense({
      specId: "def_cram", ownerId: "p2", parcelId: "x", at: { lat: 60, lng: 60 },
    });
    const before = battery.magazineRemaining;
    launchCruise(store, "p1");
    expect(store.listBatteries()[0].magazineRemaining).toBe(before); // never fired
  });

  it("an enemy battery on the target intercepts most incoming fire", () => {
    let intercepted = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      // Fresh store/battery each trial so a finite magazine doesn't cap attempts.
      const trial = new EngagementStore();
      trial.deployDefense({ specId: "def_aegis", ownerId: "p2", parcelId: "dst", at: TARGET });
      const e = launchCruise(trial, "p1", 1000 + i);
      if (e.status === "intercepted") {
        intercepted++;
        expect(e.interceptedBySpecId).toBe("def_aegis");
        expect(e.interceptAt).toBeDefined();
        expect(e.pk).toBeGreaterThan(0);
      }
    }
    // Aegis vs a slow cruise missile should hit well over half the time.
    expect(intercepted).toBeGreaterThan(N * 0.5);
  });

  it("depletes a battery's magazine as it engages", () => {
    const battery = store.deployDefense({ specId: "def_aegis", ownerId: "p2", parcelId: "dst", at: TARGET });
    const full = battery.magazineRemaining;
    launchCruise(store, "p1", 1000);
    expect(store.listBatteries()[0].magazineRemaining).toBeLessThan(full); // an interceptor was expended
  });

  it("rejects deploying an offensive weapon as a defense", () => {
    expect(() => store.deployDefense({ specId: "msl_ballistic_1", ownerId: "p2", parcelId: "x", at: TARGET }))
      .toThrow();
  });
});
