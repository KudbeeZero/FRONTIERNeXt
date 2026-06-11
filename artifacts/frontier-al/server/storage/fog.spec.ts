import { describe, it, expect } from "vitest";
import { computeVisiblePlotIndices } from "../../shared/fog.js";

// 4 plots laid out on the x-axis at 0, 0.1, 0.5, 1.0
const positions = [
  0.0, 0, 0,
  0.1, 0, 0,
  0.5, 0, 0,
  1.0, 0, 0,
];

describe("computeVisiblePlotIndices", () => {
  it("returns an empty set when the player owns nothing", () => {
    expect(computeVisiblePlotIndices(positions, [], 0.2).size).toBe(0);
  });

  it("always includes owned plots", () => {
    const vis = computeVisiblePlotIndices(positions, [3], 0.05);
    expect(vis.has(3)).toBe(true);
  });

  it("reveals plots within the radius and hides those outside", () => {
    const vis = computeVisiblePlotIndices(positions, [0], 0.2);
    expect(vis.has(0)).toBe(true);  // owned
    expect(vis.has(1)).toBe(true);  // 0.1 away → within 0.2
    expect(vis.has(2)).toBe(false); // 0.5 away → outside
    expect(vis.has(3)).toBe(false); // 1.0 away → outside
  });

  it("unions reveal areas from multiple owned plots", () => {
    const vis = computeVisiblePlotIndices(positions, [0, 3], 0.15);
    expect(vis.has(0)).toBe(true);
    expect(vis.has(1)).toBe(true);  // near plot 0
    expect(vis.has(3)).toBe(true);
    expect(vis.has(2)).toBe(false); // 0.5 from plot0, 0.5 from plot3 → still hidden
  });

  it("ignores out-of-range owned indices safely", () => {
    expect(() => computeVisiblePlotIndices(positions, [99], 0.2)).not.toThrow();
    expect(computeVisiblePlotIndices(positions, [99], 0.2).size).toBe(0);
  });
});
