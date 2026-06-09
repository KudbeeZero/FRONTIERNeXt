// ── Admin authentication: username + password + SMS 2FA ──────────────────────
//
// A human admin login, distinct from:
//   • wallet-signature player auth (server/auth.ts), and
//   • the static ADMIN_KEY machine gate (server/security.ts).
//
// Flow:
//   1. POST /api/admin/login { username, password }
//        → verify password (scrypt) → issue a short-lived "pending-2FA" token
//          + send a 6-digit OTP via SMS (server/services/sms.ts).
//   2. POST /api/admin/2fa { pendingToken, code }
//        → verify the pending token + OTP → issue an admin session token + cookie.
//   3. requireAdmin(req,res) gates /api/admin/* — passes on a valid admin session
//      OR the legacy ADMIN_KEY (kept for machine/veritas access).
//
// No external auth deps: scrypt password hashing + HMAC tokens via Node crypto,
// mirroring the patterns in server/auth.ts. Tokens are domain-separated from
// wallet sessions so the two can never be confused.

import { createHmac, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { adminUsers } from "./db-schema";
import { isRedisEnabled, setWithPx, getDel } from "./services/redis";
import { requireAdminKey } from "./security";

// ── Config ───────────────────────────────────────────────────────────────────
const ADMIN_SESSION_TTL_MS = Math.max(1, Number(process.env.ADMIN_SESSION_TTL_HOURS) || 8) * 60 * 60 * 1000;
const PENDING_TTL_MS = 5 * 60 * 1000;   // password → 2FA completion window
const OTP_TTL_MS     = 5 * 60 * 1000;   // SMS code lifetime
const OTP_MAX_ATTEMPTS = 5;             // wrong guesses before a code is burned
const LOGIN_MAX_FAILS  = 5;             // failed passwords before lockout
const LOCKOUT_MS       = 15 * 60 * 1000;
export const ADMIN_SESSION_COOKIE = "frontier_admin_session";

const isProd = (): boolean => process.env.NODE_ENV === "production";

// HMAC key, domain-separated from the wallet-session key so an admin token can
// never be replayed as a player token (or vice-versa). Falls back to a
// process-lifetime random key (tokens invalidate on restart) and warns in prod.
const _adminKey: Buffer = (() => {
  const s = process.env.SESSION_SECRET;
  const base = (s && s.length >= 16) ? Buffer.from(s, "utf8") : (() => {
    if (isProd()) console.warn("[adminAuth] SESSION_SECRET unset/short — admin tokens use an ephemeral key (won't survive restart).");
    return randomBytes(32);
  })();
  return createHmac("sha256", base).update("frontier-admin-session:v1").digest();
})();

// ── base64url ──────────────────────────────────────────────────────────────────
function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function ctEqStr(a: string, b: string): boolean {
  const ba = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ── Password hashing (scrypt; no external dependency) ───────────────────────────
// Stored format: scrypt$N$saltHex$hashHex
const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, SCRYPT_KEYLEN = 32;

const SCRYPT_MAXMEM = 64 * 1024 * 1024; // generous ceiling so a bad N throws fast instead of stalling
const HEX_RE = /^[0-9a-fA-F]+$/;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const [scheme, nStr, saltHex, hashHex] = parts;
    if (scheme !== "scrypt") return false;
    // Structural validation — fail CLOSED on any malformed stored hash. A blank or
    // non-hex hash segment must NOT decode to an empty buffer that trivially
    // timing-safe-equals another empty buffer (universal-password bypass).
    if (!saltHex || !hashHex || !HEX_RE.test(saltHex) || !HEX_RE.test(hashHex)) return false;
    if (saltHex.length % 2 !== 0 || hashHex.length % 2 !== 0) return false;
    const N = Number(nStr);
    if (!Number.isInteger(N) || N < 1024 || N > (1 << 20)) return false; // bounded both ends
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length < SCRYPT_KEYLEN) return false; // never compare a too-short/empty hash
    const got = scryptSync(password, salt, expected.length, { N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM });
    return got.length === expected.length && timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

// A constant-cost dummy verify target so a login attempt for a non-existent user
// takes the same time as for a real one (no username enumeration via timing).
export const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(18).toString("hex"));

// ── HMAC tokens: pending-2FA (short) + admin session ────────────────────────────
type TokenKind = "pending2fa" | "admin";
interface TokenPayload { sub: string; kind: TokenKind; username?: string; iat: number; exp: number; }

function signToken(p: TokenPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(p), "utf8"));
  const mac = b64url(createHmac("sha256", _adminKey).update(body).digest());
  return `${body}.${mac}`;
}
function verifyToken(token: string | undefined | null, kind: TokenKind): TokenPayload | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".", 2);
  if (!body || !mac) return null;
  const expected = createHmac("sha256", _adminKey).update(body).digest();
  const got = b64urlDecode(mac);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const p = JSON.parse(b64urlDecode(body).toString("utf8")) as TokenPayload;
    if (!p?.sub || p.kind !== kind || typeof p.exp !== "number") return null;
    if (Date.now() > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

export function signPendingToken(adminId: string): string {
  const now = Date.now();
  return signToken({ sub: adminId, kind: "pending2fa", iat: now, exp: now + PENDING_TTL_MS });
}
export function verifyPendingToken(token: string): { adminId: string } | null {
  const p = verifyToken(token, "pending2fa");
  return p ? { adminId: p.sub } : null;
}

export interface AdminInfo { adminId: string; username: string; }
export function signAdminSession(adminId: string, username: string): string {
  const now = Date.now();
  return signToken({ sub: adminId, username, kind: "admin", iat: now, exp: now + ADMIN_SESSION_TTL_MS });
}
export function verifyAdminSession(token: string | undefined | null): AdminInfo | null {
  const p = verifyToken(token ?? "", "admin");
  return p && p.username ? { adminId: p.sub, username: p.username } : null;
}
export function adminSessionMaxAgeMs(): number { return ADMIN_SESSION_TTL_MS; }

// ── One-time SMS code store (redis-or-memory, single-use, attempt-limited) ──────
interface OtpEntry { code: string; attempts: number; exp: number }
const _otps = new Map<string, OtpEntry>();
const otpKey = (adminId: string) => `frontier:admin:otp:${adminId}`;
function pruneOtps(): void { const now = Date.now(); for (const [k, v] of _otps) if (v.exp < now) _otps.delete(k); }

/** Generate, store, and return a fresh 6-digit code for an admin. */
export async function issueOtp(adminId: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const exp = Date.now() + OTP_TTL_MS;
  const payload = JSON.stringify({ code, attempts: 0, exp });
  let stored = false;
  if (isRedisEnabled()) stored = await setWithPx(otpKey(adminId), payload, OTP_TTL_MS);
  if (!stored) { pruneOtps(); _otps.set(adminId, { code, attempts: 0, exp }); }
  return code;
}

/** Validate a code (single-use; burns after success or OTP_MAX_ATTEMPTS wrong tries). */
export async function verifyOtp(adminId: string, code: string): Promise<boolean> {
  let entry: OtpEntry | null = null;

  if (isRedisEnabled()) {
    const raw = await getDel(otpKey(adminId));
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p && typeof p.exp === "number" && p.exp >= Date.now()) {
          entry = { code: String(p.code), attempts: Number(p.attempts) || 0, exp: p.exp };
        }
      } catch { entry = null; }
    }
  }
  if (!entry) {
    const e = _otps.get(adminId);
    if (e) { _otps.delete(adminId); if (e.exp >= Date.now()) entry = e; }
  }
  if (!entry) return false;

  if (ctEqStr(entry.code, String(code))) return true;

  // Wrong guess — re-arm with one fewer attempt, honoring the ORIGINAL deadline
  // (never extend validity), unless the per-code attempt cap is exhausted.
  const attempts = entry.attempts + 1;
  const remainingTtl = entry.exp - Date.now();
  if (attempts < OTP_MAX_ATTEMPTS && remainingTtl > 0) {
    const payload = JSON.stringify({ code: entry.code, attempts, exp: entry.exp });
    if (isRedisEnabled()) await setWithPx(otpKey(adminId), payload, remainingTtl);
    else _otps.set(adminId, { code: entry.code, attempts, exp: entry.exp });
  }
  return false;
}

// ── Admin-user DB access + lockout ──────────────────────────────────────────────
export type AdminUserRow = typeof adminUsers.$inferSelect;

export async function getAdminByUsername(username: string): Promise<AdminUserRow | null> {
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  return rows[0] ?? null;
}
export async function getAdminById(id: string): Promise<AdminUserRow | null> {
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Record a failed password attempt; lock the account after LOGIN_MAX_FAILS. */
export async function registerFailedLogin(id: string, current: number): Promise<void> {
  const attempts = (current ?? 0) + 1;
  const lockedUntil = attempts >= LOGIN_MAX_FAILS ? Date.now() + LOCKOUT_MS : 0;
  await db.update(adminUsers).set({ failedAttempts: attempts, lockedUntil }).where(eq(adminUsers.id, id));
}
export async function clearFailedLogin(id: string): Promise<void> {
  await db.update(adminUsers).set({ failedAttempts: 0, lockedUntil: 0 }).where(eq(adminUsers.id, id));
}
export async function markLoginSuccess(id: string): Promise<void> {
  await db.update(adminUsers).set({ failedAttempts: 0, lockedUntil: 0, lastLoginAt: Date.now() }).where(eq(adminUsers.id, id));
}

const E164_RE = /^\+[1-9]\d{6,14}$/;

/** Create or update an admin user (used by the seed script). Validates input. */
export async function upsertAdminUser(username: string, password: string, phone: string): Promise<"created" | "updated"> {
  if (!username || username.length > 64) throw new Error("username must be 1–64 characters");
  if (!password || password.length < 12) throw new Error("password must be at least 12 characters");
  if (!E164_RE.test(phone)) throw new Error("phone must be E.164 (e.g. +15551234567)");
  const existing = await getAdminByUsername(username);
  const passwordHash = hashPassword(password);
  if (existing) {
    await db.update(adminUsers).set({ passwordHash, phone }).where(eq(adminUsers.id, existing.id));
    return "updated";
  }
  await db.insert(adminUsers).values({
    id: randomUUID(), username, passwordHash, phone,
    twoFactorEnabled: true, failedAttempts: 0, lockedUntil: 0, lastLoginAt: null, createdAt: Date.now(),
  });
  return "created";
}

// ── Request helpers + gate ──────────────────────────────────────────────────────
function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k) out[k] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

/** Extract + verify an admin session from Bearer header or cookie. */
export function getAdminAuth(req: Request): AdminInfo | null {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const fromHeader = verifyAdminSession(header.slice(7).trim());
    if (fromHeader) return fromHeader;
  }
  return verifyAdminSession(parseCookies(req)[ADMIN_SESSION_COOKIE]);
}

export function setAdminCookie(res: Response, token: string): void {
  res.cookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    // Never "none": "lax" blocks the cookie on cross-site POSTs, killing CSRF
    // against destructive admin routes. Split-host deploys authenticate via the
    // sessionStorage Bearer token instead, so they lose nothing here.
    sameSite: "lax",
    maxAge: ADMIN_SESSION_TTL_MS,
    path: "/",
  });
}
export function clearAdminCookie(res: Response): void {
  res.clearCookie(ADMIN_SESSION_COOKIE, { path: "/" });
}

/**
 * Privileged-route gate. Passes on a valid admin SESSION, otherwise falls back to
 * the legacy static ADMIN_KEY (for machine/veritas callers). Writes the failure
 * response (401/403/503) and returns false when neither is satisfied.
 */
export function requireAdmin(req: Request, res: Response): boolean {
  if (getAdminAuth(req)) return true;
  return requireAdminKey(req, res);
}
