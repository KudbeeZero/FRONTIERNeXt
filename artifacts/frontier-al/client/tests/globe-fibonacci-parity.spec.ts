/**
 * globe-fibonacci-parity.spec.ts
 *
 * The load-bearing §4.1 invariant (docs/globe/SCOPE_BRIEF.md): the client
 * regenerates plot positions at runtime for rendering + picking, while the
 * server seeds and persists them. The two generators are SEPARATE
 * implementations that MUST agree — if they drift, every tile renders in the
 * wrong place and clicks select the wrong parcel.
 *
 * This test (previously missing) pins client ≡ server: same count, same
 * ordering, same (plotId, lat, lng) for every plot.
 */
import { describe, it, expect } from "vitest";
import { generateFibonacciSphere as clientGen } from "../src/lib/globe/globeUtils";
import {
  GOLDEN_ANGLE,
  POLAR_EXCLUSION_LAT as CLIENT_POLAR,
  PLOT_COUNT,
} from "../src/lib/globe/globeConstants";
import {
  generateFibonacciSphere as serverGen,
  POLAR_EXCLUSION_LAT as SERVER_POLAR,
} from "../../server/sphereUtils";

describe("Fibonacci sphere client ≡ server parity", () => {
  it("shares the constants both generators depend on", () => {
    expect(GOLDEN_ANGLE).toBe(Math.PI * (3 - Math.sqrt(5)));
    expect(CLIENT_POLAR).toBe(SERVER_POLAR);
  });

  // Counts large enough that polar exclusion still yields exactly `count` plots
  // (tiny counts are degenerate — the spiral endpoints fall on the excluded
  // poles). PLOT_COUNT is the real production distribution rendered + picked.
  for (const count of [50, 1000, PLOT_COUNT]) {
    it(`produces identical (plotId, lat, lng) for count=${count}`, () => {
      const client = clientGen(count);
      const server = serverGen(count);

      // Same number of accepted plots (polar exclusion applied identically).
      expect(client.length).toBe(server.length);
      expect(client.length).toBe(count);

      for (let i = 0; i < count; i++) {
        const c = client[i];
        const s = server[i];
        // Index ordering + plotId mapping must be byte-identical (off-by-one
        // here = wrong-parcel selection in production).
        expect(c.plotId).toBe(s.plotId);
        expect(c.plotId).toBe(i + 1);
        // Identical formulas → identical floats. Assert exact equality so even
        // a subtle drift (a changed multiplier/constant) trips the guard.
        expect(c.lat).toBe(s.lat);
        expect(c.lng).toBe(s.lng);
      }
    });
  }

  it("keeps every plot inside the playable latitude band (no polar leak)", () => {
    const client = clientGen(PLOT_COUNT);
    for (const p of client) {
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(CLIENT_POLAR);
      expect(p.lng).toBeGreaterThanOrEqual(-180);
      expect(p.lng).toBeLessThanOrEqual(180);
    }
  });
});
