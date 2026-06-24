/**
 * client/tests/cinematics-enabled.spec.ts
 *
 * Proves the cinematics chokepoint: play only when enabled AND motion isn't
 * being reduced. Reduced-motion always wins (accessibility fail-safe).
 */
import { describe, it, expect } from "vitest";
import { shouldPlayBattleCinematics } from "../src/lib/battle/cinematicsEnabled";

describe("shouldPlayBattleCinematics", () => {
  it("plays only when enabled and motion is not reduced", () => {
    expect(shouldPlayBattleCinematics(true, false)).toBe(true);
  });

  it("reduced-motion suppresses cinematics even when enabled", () => {
    expect(shouldPlayBattleCinematics(true, true)).toBe(false);
  });

  it("disabled suppresses cinematics regardless of motion preference", () => {
    expect(shouldPlayBattleCinematics(false, false)).toBe(false);
    expect(shouldPlayBattleCinematics(false, true)).toBe(false);
  });
});
