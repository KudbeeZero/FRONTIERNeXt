/**
 * server/services/chain/client.spec.ts
 *
 * Regression coverage for the 2026-07-08 "NFT image links broken" bug: a
 * scheme-less PUBLIC_BASE_URL (e.g. "frontierprotocol.app" instead of
 * "https://frontierprotocol.app") silently propagated into every metadata
 * route's `image`/`external_url` fields as `${baseUrl}/...`, producing an
 * unresolvable URL with no protocol. assertChainConfig() now normalizes the
 * scheme once, at the single point every route reads PUBLIC_BASE_URL from.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertChainConfig } from "./client";

const ENV_KEYS = ["PUBLIC_BASE_URL", "REPLIT_DOMAINS", "DATABASE_URL", "SESSION_SECRET", "NODE_ENV"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  // Satisfy the unrelated required-secrets check so assertChainConfig doesn't throw.
  process.env.DATABASE_URL = "postgres://test";
  process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
  process.env.NODE_ENV = "test";
  delete process.env.REPLIT_DOMAINS;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("assertChainConfig — PUBLIC_BASE_URL scheme normalization", () => {
  it("adds https:// to a scheme-less PUBLIC_BASE_URL", () => {
    process.env.PUBLIC_BASE_URL = "frontierprotocol.app";
    assertChainConfig();
    expect(process.env.PUBLIC_BASE_URL).toBe("https://frontierprotocol.app");
  });

  it("leaves an already-correct https:// URL untouched", () => {
    process.env.PUBLIC_BASE_URL = "https://api.frontierprotocol.app";
    assertChainConfig();
    expect(process.env.PUBLIC_BASE_URL).toBe("https://api.frontierprotocol.app");
  });

  it("leaves an http:// URL untouched (e.g. local dev) rather than double-prefixing", () => {
    process.env.PUBLIC_BASE_URL = "http://localhost:5000";
    assertChainConfig();
    expect(process.env.PUBLIC_BASE_URL).toBe("http://localhost:5000");
  });

  it("still derives from REPLIT_DOMAINS (with scheme) when PUBLIC_BASE_URL is unset", () => {
    delete process.env.PUBLIC_BASE_URL;
    process.env.REPLIT_DOMAINS = "my-app.replit.dev";
    assertChainConfig();
    expect(process.env.PUBLIC_BASE_URL).toBe("https://my-app.replit.dev");
  });
});
