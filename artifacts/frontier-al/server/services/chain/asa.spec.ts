/**
 * server/services/chain/asa.spec.ts
 *
 * Regression coverage for M1-4: ASCEND ASA ID pinning via ASCEND_ASA_ID env var.
 * Tests the startup assert in assertChainConfig() and the getPinnedAscendAsaId() helper.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertChainConfig } from "./client";
import { getPinnedAscendAsaId } from "./asa";

const ENV_KEYS = [
  "PUBLIC_BASE_URL",
  "DATABASE_URL",
  "SESSION_SECRET",
  "NODE_ENV",
  "ASCEND_ASA_ID",
] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.DATABASE_URL = "postgres://test";
  process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
  process.env.NODE_ENV = "test";
  process.env.PUBLIC_BASE_URL = "https://test.example.com";
  delete process.env.ASCEND_ASA_ID;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("ASCEND_ASA_ID env var — startup assert", () => {
  it("accepts a valid positive integer ASA ID", () => {
    process.env.ASCEND_ASA_ID = "755818217";
    expect(() => assertChainConfig()).not.toThrow();
  });

  it("accepts when ASCEND_ASA_ID is unset (optional)", () => {
    delete process.env.ASCEND_ASA_ID;
    expect(() => assertChainConfig()).not.toThrow();
  });

  it("rejects a non-numeric value", () => {
    process.env.ASCEND_ASA_ID = "not-a-number";
    expect(() => assertChainConfig()).toThrow(/ASCEND_ASA_ID.*invalid/i);
  });

  it("rejects zero", () => {
    process.env.ASCEND_ASA_ID = "0";
    expect(() => assertChainConfig()).toThrow(/ASCEND_ASA_ID.*invalid/i);
  });

  it("rejects negative numbers", () => {
    process.env.ASCEND_ASA_ID = "-123";
    expect(() => assertChainConfig()).toThrow(/ASCEND_ASA_ID.*invalid/i);
  });

  it("rejects floating-point numbers", () => {
    process.env.ASCEND_ASA_ID = "123.45";
    expect(() => assertChainConfig()).toThrow(/ASCEND_ASA_ID.*invalid/i);
  });

  it("rejects empty string", () => {
    process.env.ASCEND_ASA_ID = "";
    expect(() => assertChainConfig()).not.toThrow();
  });
});

describe("getPinnedAscendAsaId() helper", () => {
  it("returns null when env var is unset", () => {
    delete process.env.ASCEND_ASA_ID;
    expect(getPinnedAscendAsaId()).toBeNull();
  });

  it("returns the parsed integer when env var is set to a valid ID", () => {
    process.env.ASCEND_ASA_ID = "755818217";
    expect(getPinnedAscendAsaId()).toBe(755818217);
  });

  it("throws when env var is non-numeric", () => {
    process.env.ASCEND_ASA_ID = "invalid";
    expect(() => getPinnedAscendAsaId()).toThrow(/ASCEND_ASA_ID.*invalid/i);
  });

  it("throws when env var is zero", () => {
    process.env.ASCEND_ASA_ID = "0";
    expect(() => getPinnedAscendAsaId()).toThrow(/ASCEND_ASA_ID.*invalid/i);
  });

  it("throws when env var is negative", () => {
    process.env.ASCEND_ASA_ID = "-1";
    expect(() => getPinnedAscendAsaId()).toThrow(/ASCEND_ASA_ID.*invalid/i);
  });

  it("throws when env var is a float", () => {
    process.env.ASCEND_ASA_ID = "123.456";
    expect(() => getPinnedAscendAsaId()).toThrow(/ASCEND_ASA_ID.*invalid/i);
  });
});
