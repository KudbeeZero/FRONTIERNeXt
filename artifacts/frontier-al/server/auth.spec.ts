import { describe, it, expect } from "vitest";
import algosdk from "algosdk";
import {
  signSession,
  verifySession,
  issueNonce,
  verifyAuthTxn,
  verifyAuthAndNonce,
} from "./auth";

// Build the exact signed-transaction blob the client wallet would produce:
// a 0-ALGO self-payment whose note is the auth challenge.
function buildSignedAuth(account: algosdk.Account, nonce: string): string {
  const suggestedParams: algosdk.SuggestedParams = {
    fee: 1000,
    firstValid: 1,
    lastValid: 1001,
    genesisID: "testnet-v1.0",
    genesisHash: new Uint8Array(32).fill(7),
    flatFee: true,
    minFee: 1000,
  };
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    note: new TextEncoder().encode(`FRONTIER-AUTH:v1:${nonce}`),
    suggestedParams,
  });
  return Buffer.from(txn.signTxn(account.sk)).toString("base64");
}

const addrOf = (a: algosdk.Account): string => a.addr.toString();

describe("auth — session tokens", () => {
  it("round-trips a valid session", () => {
    const token = signSession({ address: "ADDR", playerId: "p1" });
    expect(verifySession(token)).toEqual({ address: "ADDR", playerId: "p1" });
  });

  it("rejects tampered or garbage tokens", () => {
    const token = signSession({ address: "ADDR", playerId: "p1" });
    expect(verifySession(token + "x")).toBeNull();
    expect(verifySession("not.a.token")).toBeNull();
    expect(verifySession("")).toBeNull();
    expect(verifySession(undefined)).toBeNull();
  });
});

describe("auth — wallet signature verification", () => {
  it("accepts a genuine wallet signature over the auth challenge", () => {
    const account = algosdk.generateAccount();
    const nonce = "abc123";
    const blob = buildSignedAuth(account, nonce);
    expect(verifyAuthTxn(addrOf(account), blob, nonce)).toBe(true);
  });

  it("rejects a signature whose nonce does not match", () => {
    const account = algosdk.generateAccount();
    const blob = buildSignedAuth(account, "nonce-A");
    expect(verifyAuthTxn(addrOf(account), blob, "nonce-B")).toBe(false);
  });

  it("rejects a signature claimed for a different address", () => {
    const signer = algosdk.generateAccount();
    const victim = algosdk.generateAccount();
    const nonce = "shared";
    const blob = buildSignedAuth(signer, nonce);
    // Attacker presents the signer's blob but claims to be the victim.
    expect(verifyAuthTxn(addrOf(victim), blob, nonce)).toBe(false);
  });

  it("rejects malformed blobs", () => {
    const account = algosdk.generateAccount();
    expect(verifyAuthTxn(addrOf(account), "not-base64-$$$", "n")).toBe(false);
    expect(verifyAuthTxn(addrOf(account), Buffer.from("garbage").toString("base64"), "n")).toBe(false);
  });
});

describe("auth — nonce lifecycle", () => {
  it("issues, verifies, and enforces single-use", () => {
    const account = algosdk.generateAccount();
    const address = addrOf(account);
    const { nonce } = issueNonce(address);
    const blob = buildSignedAuth(account, nonce);

    // First use succeeds.
    expect(verifyAuthAndNonce(address, blob, nonce)).toBe(true);
    // Replay with the same nonce fails (consumed).
    expect(verifyAuthAndNonce(address, blob, nonce)).toBe(false);
  });

  it("rejects a nonce that was never issued", () => {
    const account = algosdk.generateAccount();
    const blob = buildSignedAuth(account, "never-issued");
    expect(verifyAuthAndNonce(addrOf(account), blob, "never-issued")).toBe(false);
  });
});
