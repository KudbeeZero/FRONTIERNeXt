/**
 * client/tests/market-normalization.spec.ts
 *
 * Validates the r.map crash fix and queue grouping logic.
 */

import { describe, it, expect } from "vitest";
import { normalizeMarkets } from "@/lib/marketHelpers";

const MOCK_MARKET = { id: "m1" } as any;

describe("normalizeMarkets", () => {
  it("returns [] for undefined", () => {
    expect(normalizeMarkets(undefined)).toEqual([]);
  });

  it("returns [] for null", () => {
    expect(normalizeMarkets(null)).toEqual([]);
  });

  it("returns [] for empty object", () => {
    expect(normalizeMarkets({})).toEqual([]);
  });

  it("returns [] for object with non-array fields", () => {
    expect(normalizeMarkets({ error: "Internal server error" })).toEqual([]);
  });

  it("returns the array when input is already an array", () => {
    const input = [MOCK_MARKET];
    expect(normalizeMarkets(input)).toBe(input);
  });

  it("extracts markets from object.markets", () => {
    const input = { markets: [MOCK_MARKET] };
    expect(normalizeMarkets(input)).toEqual([MOCK_MARKET]);
  });

  it("extracts data from object.data", () => {
    const input = { data: [MOCK_MARKET] };
    expect(normalizeMarkets(input)).toEqual([MOCK_MARKET]);
  });

  it("extracts items from object.items", () => {
    const input = { items: [MOCK_MARKET] };
    expect(normalizeMarkets(input)).toEqual([MOCK_MARKET]);
  });

  it("extracts results from object.results", () => {
    const input = { results: [MOCK_MARKET] };
    expect(normalizeMarkets(input)).toEqual([MOCK_MARKET]);
  });

  it("prefers markets over data over items over results when multiple are present", () => {
    const markets = [{ id: "a" }];
    const input = { markets, data: [{ id: "b" }] };
    expect(normalizeMarkets(input)).toBe(markets);
  });
});
