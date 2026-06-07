/**
 * server/engine/battle/random.spec.ts
 *
 * Determinism + range tests for the engine's PRNG primitives. These underpin
 * reproducible battle resolution, so they must be exact and stable.
 */

import { describe, it, expect } from "vitest";
import { mulberry32, hashSeed, randInt } from "./random.js";

describe("hashSeed", () => {
  it("is deterministic for identical parts", () => {
    expect(hashSeed("battle-1", 1000)).toBe(hashSeed("battle-1", 1000));
  });

  it("is order-sensitive and part-sensitive", () => {
    expect(hashSeed("a", "b")).not.toBe(hashSeed("b", "a"));
    expect(hashSeed("battle-1", 1000)).not.toBe(hashSeed("battle-1", 1001));
  });

  it("always returns a non-negative integer", () => {
    for (let i = 0; i < 1000; i++) {
      const h = hashSeed("plot", i, "x");
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("mulberry32", () => {
  it("produces a reproducible stream for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("yields floats within [0, 1)", () => {
    const rng = mulberry32(98765);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("diverges for different seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("randInt", () => {
  it("stays within the inclusive [min, max] range", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 10_000; i++) {
      const v = randInt(rng, -10, 10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("can reach both bounds over a large sample", () => {
    const rng = mulberry32(7);
    let sawMin = false;
    let sawMax = false;
    for (let i = 0; i < 20_000 && !(sawMin && sawMax); i++) {
      const v = randInt(rng, 0, 3);
      if (v === 0) sawMin = true;
      if (v === 3) sawMax = true;
    }
    expect(sawMin).toBe(true);
    expect(sawMax).toBe(true);
  });
});
