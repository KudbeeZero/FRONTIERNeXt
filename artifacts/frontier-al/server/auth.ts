// ── Wallet-signature authentication ──────────────────────────────────────────
//
// Proves a caller actually controls the Algorand wallet they claim, then issues
// a signed, expiring session token bound to {address, playerId}. This closes the
// account-takeover hole where the server trusted a client-supplied playerId.
//
// Flow (Sign-In With Algorand, wallet-agnostic):
//   1. client POST /api/auth/nonce { address }      → server issues a one-time nonce
//   2. wallet signs a 0-ALGO self-payment whose note = FRONTIER-AUTH:v1:<nonce>
//      (every Algorand wallet — LUTE, Pera, Defly, Kibisis — can sign this; the
//       app already signs identical 0-ALGO self-pay txns for game actions)
//   3. client POST /api/auth/verify { address, signedTxn } → server verifies the
//      ed25519 signature against the address, checks the nonce, and issues a token
//
// The auth transaction is NEVER submitted to the chain — it is only a signed
// proof. Verification is fully self-contained (no external deps): ed25519 via
// Node's crypto, HMAC session tokens keyed on SESSION_SECRET.

import algosdk from "algosdk";
import { createHmac, createPublicKey, verify as cryptoVerify, randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { isRedisEnabled, setWithPx, getDel } from "./services/redis";

// ── Config ───────────────────────────────────────────────────────────────────

/** Session token lifetime. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Auth challenge (nonce) lifetime. */
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
/** Note prefix that pins a signed txn to *our* auth challenge. */
const AUTH_NOTE_PREFIX = "FRONTIER-AUTH:v1:";
/** Cookie name for the session token. */
export const SESSION_COOKIE = "frontier_session";

const isProd = (): boolean => process.env.NODE_ENV === "production";

/**
 * Whether wallet-signature auth is enforced on mutating endpoints.
 * Defaults to ON. Set WALLET_AUTH_REQUIRED=false only for a brief split-host
 * rollout window (Vercel SPA + separate API) where the new client has not yet
 * been deployed; flip back to true immediately after.
 */
export function isWalletAuthRequired(): boolean {
  return process.env.WALLET_AUTH_REQUIRED !== "false";
}

// HMAC key for session tokens. Prefer SESSION_SECRET; otherwise fall back to a
// process-lifetime random key (tokens invalidate on restart) and warn loudly in
// production so the misconfiguration is visible.
const _sessionKey: Buffer = (() => {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return Buffer.from(s, "utf8");
  if (isProd()) {
    console.warn(
      "[auth] SESSION_SECRET is unset or too short — using an ephemeral key. " +
      "Sessions will not survive restarts and cannot be shared across instances. " +
      "Set a strong SESSION_SECRET in production.",
    );
  }
  return randomBytes(32);
})();

// ── base64url helpers ──────────────────────────────────────────────────────────

function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// ── Session tokens (stateless, HMAC-signed) ────────────────────────────────────

export interface AuthInfo {
  address: string;
  playerId: string;
}

interface SessionPayload extends AuthInfo {
  iat: number;
  exp: number;
}

/** Mint a signed session token for an authenticated wallet/player. */
export function signSession(info: AuthInfo): string {
  const now = Date.now();
  const payload: SessionPayload = { ...info, iat: now, exp: now + SESSION_TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = b64url(createHmac("sha256", _sessionKey).update(body).digest());
  return `${body}.${mac}`;
}

/** Verify a session token; returns the auth info or null if invalid/expired. */
export function verifySession(token: string | undefined | null): AuthInfo | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".", 2);
  if (!body || !mac) return null;

  const expected = createHmac("sha256", _sessionKey).update(body).digest();
  const got = b64urlDecode(mac);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as SessionPayload;
    if (!payload?.address || !payload?.playerId || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return { address: payload.address, playerId: payload.playerId };
  } catch {
    return null;
  }
}

export function sessionMaxAgeSeconds(): number {
  return Math.floor(SESSION_TTL_MS / 1000);
}

// ── Nonce store (one-time, per-address, short TTL) ─────────────────────────────
//
// Redis-backed (shared across instances) when Upstash is configured; otherwise a
// per-instance in-memory Map. The in-memory path also serves as a fallback if a
// Redis write fails, so a nonce issued in either store can still be consumed.

// Outstanding nonces, keyed by the NONCE value (NOT the address) so issuing a
// new challenge for an address never invalidates an in-flight one. Value = the
// address the nonce was issued to. Single-use via getDel / delete on consume.
const _nonces = new Map<string, { address: string; exp: number }>();

function nonceKey(nonce: string): string {
  return `frontier:auth:nonce:${nonce}`;
}

function pruneNonces(): void {
  const now = Date.now();
  for (const [k, v] of _nonces) if (v.exp < now) _nonces.delete(k);
}

/** Issue a fresh one-time nonce for an address. */
export async function issueNonce(address: string): Promise<{ nonce: string; expiresAt: number }> {
  const nonce = randomBytes(24).toString("hex");
  const expiresAt = Date.now() + NONCE_TTL_MS;
  let stored = false;
  if (isRedisEnabled()) {
    stored = await setWithPx(nonceKey(nonce), address, NONCE_TTL_MS);
  }
  if (!stored) {
    // No Redis (or the write failed) — keep it in memory for this instance.
    pruneNonces();
    _nonces.set(nonce, { address, exp: expiresAt });
  }
  return { nonce, expiresAt };
}

/**
 * Consume (validate + single-use) a nonce. Race-free: keyed by the nonce, so
 * concurrent/retried challenges for the same address don't clobber each other.
 * Returns true only if the nonce was issued to exactly this address.
 */
async function consumeNonce(address: string, nonce: string): Promise<boolean> {
  if (!nonce || typeof nonce !== "string") return false;
  let storedAddress: string | null = null;

  // Redis path: GETDEL is atomic single-use; the key auto-expires (TTL).
  if (isRedisEnabled()) {
    storedAddress = await getDel(nonceKey(nonce));
  }

  // Fall back to / also check the in-memory store (covers no-Redis mode and the
  // case where the issue write landed in memory).
  if (storedAddress == null) {
    const entry = _nonces.get(nonce);
    if (entry) {
      _nonces.delete(nonce); // single-use regardless of outcome
      if (entry.exp >= Date.now()) storedAddress = entry.address;
    }
  }

  if (storedAddress == null) return false;
  // The nonce must have been issued to exactly this address (constant-time).
  const a = Buffer.from(storedAddress);
  const b = Buffer.from(address);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Ed25519 verification (no external deps) ────────────────────────────────────

// DER SubjectPublicKeyInfo prefix for an Ed25519 public key (12 bytes); the raw
// 32-byte key is appended to form a valid SPKI that Node's crypto can import.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function ed25519Verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  try {
    const der = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey)]);
    const keyObject = createPublicKey({ key: der, format: "der", type: "spki" });
    return cryptoVerify(null, Buffer.from(message), keyObject, Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify a wallet-signed auth transaction proves control of `address`.
 *
 * Checks, in order:
 *   • the blob decodes to a signed transaction with a signature
 *   • the txn sender equals the claimed address
 *   • the note equals FRONTIER-AUTH:v1:<expectedNonce>
 *   • the ed25519 signature is valid for the address over the txn's signing bytes
 *
 * The txn is never submitted. Returns true only if all checks pass.
 */
export function verifyAuthTxn(address: string, signedTxnB64: string, expectedNonce: string): boolean {
  if (!algosdk.isValidAddress(address)) return false;
  let blob: Buffer;
  try {
    blob = Buffer.from(signedTxnB64, "base64");
  } catch {
    return false;
  }

  let decoded: ReturnType<typeof algosdk.decodeSignedTransaction>;
  try {
    decoded = algosdk.decodeSignedTransaction(new Uint8Array(blob));
  } catch {
    return false;
  }

  const sig = decoded.sig;
  if (!sig || sig.length === 0) return false;

  const txn = decoded.txn;

  // Sender must be the address being claimed.
  let sender: string;
  try {
    sender = txn.sender.toString();
  } catch {
    return false;
  }
  if (sender !== address) return false;

  // Note must carry exactly our challenge for this address.
  const note = txn.note ? Buffer.from(txn.note).toString("utf8") : "";
  if (note !== `${AUTH_NOTE_PREFIX}${expectedNonce}`) return false;

  // Signature must verify against the claimed address over the txn signing bytes.
  let toSign: Uint8Array;
  try {
    toSign = txn.bytesToSign();
  } catch {
    return false;
  }
  const pubKey = algosdk.decodeAddress(address).publicKey;
  return ed25519Verify(toSign, sig, pubKey);
}

/** Full verify step: checks the signed txn AND consumes the matching nonce. */
export async function verifyAuthAndNonce(address: string, signedTxnB64: string, nonce: string): Promise<boolean> {
  if (!nonce || typeof nonce !== "string") return false;
  if (!(await consumeNonce(address, nonce))) return false;
  return verifyAuthTxn(address, signedTxnB64, nonce);
}

// ── Request helpers ────────────────────────────────────────────────────────────

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/**
 * Extract + verify the session from a request. Accepts either an
 * `Authorization: Bearer <token>` header (primary, survives third-party-cookie
 * blocking on split-host deploys) or the session cookie.
 */
export function getAuth(req: Request): AuthInfo | null {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const fromHeader = verifySession(header.slice(7).trim());
    if (fromHeader) return fromHeader;
  }
  const cookies = parseCookies(req);
  return verifySession(cookies[SESSION_COOKIE]);
}

/** Set the session cookie on a response. */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? "none" : "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

/** Clear the session cookie. */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

// Make req.auth available to handlers (declaration merging).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}
