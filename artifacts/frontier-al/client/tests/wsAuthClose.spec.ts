/**
 * Guards the WS close-code classification that fixes the wallet
 * "flash → connection lost" loop: an auth-reject close (1008/4001) must NOT be
 * treated as a reconnectable network drop — the socket clears the stale token
 * and re-authenticates instead of hammering the server to death.
 */
import { describe, it, expect } from "vitest";
import { isAuthRejectClose } from "@/hooks/useGameSocket";

describe("isAuthRejectClose", () => {
  it("flags auth-reject close codes (server closes 1008; 4001 reserved)", () => {
    expect(isAuthRejectClose(1008)).toBe(true);
    expect(isAuthRejectClose(4001)).toBe(true);
  });

  it("does NOT flag normal/network closes — those still bounded-reconnect", () => {
    for (const code of [1000, 1001, 1006, 1011, 1012, 1013, 0]) {
      expect(isAuthRejectClose(code)).toBe(false);
    }
  });
});
