/**
 * Pins the rule that the dev/test player is never "in custody": for it, NFT-claim
 * prompts and the mining/upgrade "NFT Required" lock collapse to false; real
 * players pass through unchanged.
 */
import { describe, it, expect } from "vitest";
import { effectiveInCustody } from "@/lib/devSession";

describe("effectiveInCustody", () => {
  it("collapses to false for the dev/test player regardless of raw value", () => {
    expect(effectiveInCustody(true, true)).toBe(false);
    expect(effectiveInCustody(false, true)).toBe(false);
    expect(effectiveInCustody(null, true)).toBe(false);
  });

  it("passes the raw custody state through for a real player", () => {
    expect(effectiveInCustody(true, false)).toBe(true);
    expect(effectiveInCustody(false, false)).toBe(false);
    expect(effectiveInCustody(undefined, false)).toBe(false);
    expect(effectiveInCustody(null, false)).toBe(false);
  });
});
