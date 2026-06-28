/**
 * Guards the wallet connect-timeout policy and the timeout error messaging.
 *
 * Symptom this addresses: the owner reported that hitting "Connect Wallet" with
 * Lute "keeps spinning." Lute is a browser EXTENSION — its approval popup
 * surfaces instantly, so there's no QR/phone latency to wait out. The previous
 * single 90s budget meant a wedged extension handshake spun for a minute and a
 * half before surfacing anything. We now give extension wallets a tighter budget
 * so a stuck connect becomes a fast, recoverable error with extension-specific
 * guidance — while QR/mobile wallets (Pera) keep the generous scan budget.
 */
import { describe, it, expect } from "vitest";
import {
  connectTimeoutFor,
  friendlyErrorMessage,
  CONNECT_TIMEOUT_MS,
  EXTENSION_CONNECT_TIMEOUT_MS,
  CONNECT_TIMEOUT_MESSAGE,
} from "@/contexts/WalletContext";

describe("connectTimeoutFor", () => {
  it("gives extension wallets the tighter budget (Lute/Kibisis don't wait on a QR scan)", () => {
    expect(connectTimeoutFor("lute")).toBe(EXTENSION_CONNECT_TIMEOUT_MS);
    expect(connectTimeoutFor("kibisis")).toBe(EXTENSION_CONNECT_TIMEOUT_MS);
  });

  it("keeps the generous budget for QR/mobile wallets and unknown ids", () => {
    expect(connectTimeoutFor("pera")).toBe(CONNECT_TIMEOUT_MS);
    expect(connectTimeoutFor("defly")).toBe(CONNECT_TIMEOUT_MS);
    expect(connectTimeoutFor("something-else")).toBe(CONNECT_TIMEOUT_MS);
  });

  it("the extension budget is actually shorter than the QR budget (regression guard)", () => {
    expect(EXTENSION_CONNECT_TIMEOUT_MS).toBeLessThan(CONNECT_TIMEOUT_MS);
  });
});

describe("friendlyErrorMessage — connect timeout", () => {
  it("gives Lute/Kibisis extension-specific recovery guidance on timeout", () => {
    const lute = friendlyErrorMessage("lute", CONNECT_TIMEOUT_MESSAGE);
    expect(lute).toMatch(/extension/i);
    expect(lute).toMatch(/unlocked|popup/i);

    const kibisis = friendlyErrorMessage("kibisis", CONNECT_TIMEOUT_MESSAGE);
    expect(kibisis).toMatch(/extension/i);
  });

  it("gives QR/mobile wallets the popup/QR guidance on timeout", () => {
    expect(friendlyErrorMessage("pera", CONNECT_TIMEOUT_MESSAGE)).toMatch(/QR|popup/i);
  });

  it("never echoes the internal timeout sentinel back to the user", () => {
    for (const id of ["lute", "pera", "defly", "kibisis", "unknown"]) {
      expect(friendlyErrorMessage(id, CONNECT_TIMEOUT_MESSAGE)).not.toContain(CONNECT_TIMEOUT_MESSAGE);
    }
  });
});
