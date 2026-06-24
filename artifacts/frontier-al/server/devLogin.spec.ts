/**
 * server/devLogin.spec.ts
 *
 * Pins the security-critical property: dev quick-auth is OFF unless
 * DEV_LOGIN_ENABLED is exactly "true" (fail-closed for every other value), and
 * the dev address defaults to a non-wallet sentinel.
 */
import { describe, it, expect } from "vitest";
import { isDevLoginEnabled, devLoginAddress } from "./devLogin";

describe("isDevLoginEnabled", () => {
  it("is true only for the exact string 'true'", () => {
    expect(isDevLoginEnabled({ DEV_LOGIN_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("fails closed for unset / any other value", () => {
    for (const v of [undefined, "", "false", "1", "TRUE", "yes", "on"]) {
      expect(isDevLoginEnabled({ DEV_LOGIN_ENABLED: v } as unknown as NodeJS.ProcessEnv)).toBe(false);
    }
  });
});

describe("devLoginAddress", () => {
  it("defaults to a non-wallet sentinel (cannot move real funds)", () => {
    expect(devLoginAddress({} as NodeJS.ProcessEnv)).toBe("DEV-TEST-COMMANDER");
  });

  it("honours an explicit override, trimmed", () => {
    expect(devLoginAddress({ DEV_LOGIN_ADDRESS: "  MYADDR  " } as NodeJS.ProcessEnv)).toBe("MYADDR");
  });

  it("falls back to the sentinel for a blank override", () => {
    expect(devLoginAddress({ DEV_LOGIN_ADDRESS: "   " } as NodeJS.ProcessEnv)).toBe("DEV-TEST-COMMANDER");
  });
});
