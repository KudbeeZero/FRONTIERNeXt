/**
 * Pins the dashboard feature-flag resolution: the new draggable HUD is OFF by
 * default and only turns on via an explicit `?dashboard=1` or a persisted "1".
 * Keeps the live game's layout untouched unless the owner opts in.
 */
import { describe, it, expect } from "vitest";
import { resolveDashboardFlag } from "@/lib/dashboard/flag";

describe("resolveDashboardFlag", () => {
  it("is OFF by default (no query, nothing persisted)", () => {
    expect(resolveDashboardFlag("", null)).toBe(false);
  });

  it("turns on with ?dashboard=1 or =true", () => {
    expect(resolveDashboardFlag("?dashboard=1", null)).toBe(true);
    expect(resolveDashboardFlag("?dashboard=true", null)).toBe(true);
  });

  it("an explicit ?dashboard=0 overrides a persisted on-state", () => {
    expect(resolveDashboardFlag("?dashboard=0", "1")).toBe(false);
    expect(resolveDashboardFlag("?dashboard=false", "1")).toBe(false);
  });

  it("honors the persisted flag when the query is absent", () => {
    expect(resolveDashboardFlag("", "1")).toBe(true);
    expect(resolveDashboardFlag("?foo=bar", "0")).toBe(false);
  });
});
