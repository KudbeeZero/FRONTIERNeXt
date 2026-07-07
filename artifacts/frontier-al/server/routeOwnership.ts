// ─────────────────────────────────────────────────────────────────────────────
// Route-loop ownership/auth decision — the single source of truth for "is this
// mutating request allowed to act on this player?", shared by the global
// mutation middleware and assertPlayerOwnership in routes.ts.
//
// Pure and side-effect-free so the decision can be unit-tested directly (the
// middleware/handler then just maps the verdict to an HTTP response). Error
// strings are deliberately generic — they never echo the session, address,
// playerId, token, or any internal detail.
// ─────────────────────────────────────────────────────────────────────────────
import type { AuthInfo } from "./auth";

export type OwnershipVerdict =
  | { ok: true }
  | { ok: false; status: 401; error: string }
  | { ok: false; status: 403; error: string; code: typeof SESSION_MISMATCH_CODE };

/** Generic, non-leaking error strings (kept as constants so tests can assert exact, safe copy). */
export const AUTH_REQUIRED_ERROR = "Authentication required — connect your wallet";
export const NOT_OWNER_ERROR = "Forbidden — session does not own this player";
/**
 * Machine-readable code for the 403 branch — lets the client tell "session is
 * stale/mismatched, clear it and re-auth" apart from other 403s without
 * string-matching the human-readable error copy.
 */
export const SESSION_MISMATCH_CODE = "SESSION_MISMATCH";

/**
 * Decide whether a mutating route-loop request may proceed.
 *
 * - When wallet auth is enforced and there is no verified session → 401.
 * - When a session exists and the request carries a player-identity field that
 *   does NOT match the session's player → 403 (you cannot act as someone else).
 * - Otherwise allow. (A client-supplied `ownerId` is only trusted to *match* the
 *   session; resolution of the authoritative player id happens in the caller.)
 */
export function evaluateOwnership(opts: {
  authRequired: boolean;
  auth: AuthInfo | null;
  ownerId: string | null | undefined;
}): OwnershipVerdict {
  const { authRequired, auth, ownerId } = opts;

  if (authRequired && !auth) {
    return { ok: false, status: 401, error: AUTH_REQUIRED_ERROR };
  }
  if (auth && ownerId && ownerId !== auth.playerId) {
    return { ok: false, status: 403, error: NOT_OWNER_ERROR, code: SESSION_MISMATCH_CODE };
  }
  return { ok: true };
}
