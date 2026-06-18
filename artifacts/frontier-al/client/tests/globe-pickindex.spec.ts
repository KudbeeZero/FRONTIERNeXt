/**
 * globe-pickindex.spec.ts
 *
 * Proves the spatial pick-index (client/src/lib/globe/pickIndex.ts) returns the
 * EXACT same plot index the old O(n) brute-force scan did — so globe selection
 * behavior is unchanged, only faster. Also covers determinism, index→plot
 * mapping (off-by-one prevention), and the awkward pole / dateline regions.
 */
import { describe, it, expect } from "vitest";
import { buildPickIndex } from "../src/lib/globe/pickIndex";
import { generateFibonacciSphere, latLngToVec3 } from "../src/lib/globe/globeUtils";
import { GLOBE_RADIUS, PLOT_COUNT } from "../src/lib/globe/globeConstants";

// Build the same flat xyz array GlobeParcels maintains (plotPositions3D).
function buildPositions(count: number): Float32Array {
  const coords = generateFibonacciSphere(count);
  const arr = new Float32Array(coords.length * 3);
  for (let i = 0; i < coords.length; i++) {
    const v = latLngToVec3(coords[i].lat, coords[i].lng, GLOBE_RADIUS);
    arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
  }
  return arr;
}

// The exact previous implementation — our reference oracle.
function bruteNearest(pos: Float32Array, n: number, px: number, py: number, pz: number): number {
  let minD2 = Infinity, best = 0;
  for (let i = 0; i < n; i++) {
    const dx = pos[i * 3] - px, dy = pos[i * 3 + 1] - py, dz = pos[i * 3 + 2] - pz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < minD2) { minD2 = d2; best = i; }
  }
  return best;
}

// Deterministic PRNG so the random sweep is reproducible across runs/CI.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("globe pick-index ≡ brute-force nearest", () => {
  for (const count of [200, PLOT_COUNT]) {
    it(`matches brute force for ${count} random surface queries (count=${count})`, () => {
      const pos = buildPositions(count);
      const n = count;
      const index = buildPickIndex(pos);
      const rng = mulberry32(0xC0FFEE ^ count);

      const QUERIES = 400;
      for (let q = 0; q < QUERIES; q++) {
        // A uniformly-ish random direction. Vary the radius so we cover the
        // on-surface case (what the click handler feeds nearestPlot), plus
        // off-radius and well-out-of-bounds points that exercise the cell
        // clamp + expanding search beyond the grid bounds.
        let x = rng() * 2 - 1, y = rng() * 2 - 1, z = rng() * 2 - 1;
        const len = Math.hypot(x, y, z) || 1;
        // radius factor: ~half on-surface, the rest from deep-inside to far-outside
        const rf = q % 2 === 0 ? 1 : 0.3 + rng() * 4; // 0.3R .. ~4.3R
        const s = (GLOBE_RADIUS * rf) / len;
        x *= s; y *= s; z *= s;

        const got = index.nearest(x, y, z);
        const want = bruteNearest(pos, n, x, y, z);
        expect(got).toBe(want);
      }
    });
  }

  it("breaks exact-distance ties by lowest index, matching brute force", () => {
    // Synthetic colinear points at integer coords force exact d2 ties — the
    // Fibonacci distribution almost never does, so this is the only real
    // exercise of the `i < best` tie-break branch.
    const pts = [0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0]; // indices 0&2 identical, 1&3 identical
    const pos = new Float32Array(pts);
    const index = buildPickIndex(pos);
    // Equidistant to all four (x=1 is 1 unit from x=0 and x=2): brute keeps the
    // lowest index (0). Index must agree.
    expect(index.nearest(1, 0, 0)).toBe(bruteNearest(pos, 4, 1, 0, 0));
    expect(index.nearest(1, 0, 0)).toBe(0);
    // Exactly on the duplicate at x=0 (indices 0 and 2) → lowest index 0.
    expect(index.nearest(0, 0, 0)).toBe(0);
    // Exactly on the duplicate at x=2 (indices 1 and 3) → lowest index 1.
    expect(index.nearest(2, 0, 0)).toBe(1);
  });

  it("returns the exact index when the query sits on a plot (index→plot mapping)", () => {
    const pos = buildPositions(PLOT_COUNT);
    const index = buildPickIndex(pos);
    // first, last, and a spread of interior plots — guards off-by-one mapping
    const probes = [0, 1, 2, 123, 5000, 10500, 17777, PLOT_COUNT - 2, PLOT_COUNT - 1];
    for (const i of probes) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      expect(index.nearest(x, y, z)).toBe(i);
      expect(index.nearest(x, y, z)).toBe(bruteNearest(pos, PLOT_COUNT, x, y, z));
    }
  });

  it("is deterministic — identical query yields identical result", () => {
    const pos = buildPositions(PLOT_COUNT);
    const index = buildPickIndex(pos);
    const x = 1.234, y = -0.987, z = 1.0;
    const a = index.nearest(x, y, z);
    const b = index.nearest(x, y, z);
    expect(a).toBe(b);
    expect(a).toBe(bruteNearest(pos, PLOT_COUNT, x, y, z));
  });

  it("handles pole-band and dateline-seam plots (edge regions)", () => {
    const coords = generateFibonacciSphere(PLOT_COUNT);
    const pos = buildPositions(PLOT_COUNT);
    const index = buildPickIndex(pos);

    // Highest-|lat| plot (closest to the excluded polar cap) and the plot whose
    // lng is nearest the ±180 dateline seam.
    let poleIdx = 0, seamIdx = 0;
    for (let i = 0; i < coords.length; i++) {
      if (Math.abs(coords[i].lat) > Math.abs(coords[poleIdx].lat)) poleIdx = i;
      if (Math.abs(coords[i].lng) > Math.abs(coords[seamIdx].lng)) seamIdx = i;
    }

    for (const i of [poleIdx, seamIdx]) {
      // Exact hit.
      expect(index.nearest(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])).toBe(i);
      // Tiny perturbations around it must still agree with brute force.
      for (const d of [1e-4, -1e-4, 5e-3, -5e-3]) {
        const x = pos[i * 3] + d, y = pos[i * 3 + 1] - d, z = pos[i * 3 + 2] + d;
        expect(index.nearest(x, y, z)).toBe(bruteNearest(pos, PLOT_COUNT, x, y, z));
      }
    }
  });

  it("degenerate inputs do not throw (empty / single point)", () => {
    expect(buildPickIndex(new Float32Array(0)).nearest(1, 1, 1)).toBe(0);
    const one = new Float32Array([GLOBE_RADIUS, 0, 0]);
    expect(buildPickIndex(one).nearest(0, 5, 0)).toBe(0);
  });
});
