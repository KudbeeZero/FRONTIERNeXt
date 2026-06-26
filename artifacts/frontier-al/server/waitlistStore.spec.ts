/**
 * Guards the waitlist store's in-memory fallback path (no Redis in tests): a
 * repeat signup under the same key bumps the commit count and its tier rises,
 * while distinct keys are tracked separately. Never throws → signup can't block
 * entering the game.
 */
import { describe, it, expect } from "vitest";
import { recordWaitlistSignup, _memWaitlistSize } from "./waitlistStore";
import type { NormalizedWaitlistSignup } from "../shared/waitlist";

const sig = (over: Partial<NormalizedWaitlistSignup> = {}): NormalizedWaitlistSignup => ({
  faction: "KRONOS",
  address: null,
  email: "pilot@frontier.app",
  ...over,
});

describe("recordWaitlistSignup (in-memory fallback)", () => {
  it("increments commitCount and raises the tier on repeat signups", async () => {
    const key = "email:tier@frontier.app";
    const payload = sig({ email: "tier@frontier.app" });

    const first = await recordWaitlistSignup(key, payload);
    expect(first.commitCount).toBe(1);
    expect(first.tier).toBe("Recruit");

    let last = first;
    for (let i = 0; i < 2; i++) last = await recordWaitlistSignup(key, payload);
    expect(last.commitCount).toBe(3);
    expect(last.tier).toBe("Operative");
  });

  it("tracks distinct keys separately", async () => {
    const before = _memWaitlistSize();
    await recordWaitlistSignup("addr:" + "A".repeat(58), sig({ address: "A".repeat(58), email: null }));
    expect(_memWaitlistSize()).toBe(before + 1);
  });
});
