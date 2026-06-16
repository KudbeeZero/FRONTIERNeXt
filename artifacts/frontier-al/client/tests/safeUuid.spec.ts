/**
 * client/tests/safeUuid.spec.ts
 *
 * safeUuid() must always return a token matching the server's nonce charset
 * (`^[A-Za-z0-9_-]{8,128}$`), even when `crypto.randomUUID` is unavailable (plain
 * HTTP / older WebViews) — otherwise build/upgrade/claim would throw before they
 * could send their idempotency nonce.
 */
import { describe, it, expect, afterEach } from "vitest";
import { safeUuid } from "../src/lib/safeUuid";

const NONCE_RE = /^[A-Za-z0-9_-]{8,128}$/; // mirrors server/idempotencyGuard.ts

const realCrypto = globalThis.crypto;
afterEach(() => {
  // Restore whatever the environment provided.
  Object.defineProperty(globalThis, "crypto", { value: realCrypto, configurable: true });
});

describe("safeUuid", () => {
  it("returns a token matching the server nonce charset/length", () => {
    const id = safeUuid();
    expect(id).toMatch(NONCE_RE);
  });

  it("returns distinct values across calls", () => {
    const a = safeUuid();
    const b = safeUuid();
    expect(a).not.toBe(b);
  });

  it("falls back (no throw) when crypto.randomUUID is undefined", () => {
    // Simulate a non-secure context: getRandomValues present, randomUUID missing.
    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a) },
      configurable: true,
    });
    const id = safeUuid();
    expect(id).toMatch(NONCE_RE);
  });

  it("falls back to Math.random when crypto is entirely absent", () => {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    const id = safeUuid();
    expect(id).toMatch(NONCE_RE);
  });
});
