// ─────────────────────────────────────────────────────────────────────────────
// Action idempotency guard (two-phase: claim → record/release → replay).
//
// Blocks a duplicate submission of a mutating action from double-applying its
// state change (a double-click, a transparent retry, or a replayed request that
// would credit ASCEND, build/upgrade, or enqueue a transfer twice). Mirrors
// createPaymentReplayGuard's posture: a store-backed claim-once with a
// deterministic key, an in-process fallback for dev/mem, and FAIL-CLOSED behavior
// when the store errors.
//
// TWO-PHASE semantics (so a retried request gets the original result, not an
// error):
//   1. `claim`   — atomically reserve the key BEFORE the mutation.
//        • fresh                → run the mutation, then `record` (or `release`).
//        • duplicate + recorded → REPLAY the stored response (caller → 200).
//        • duplicate, in-flight → reason "in_progress" (caller → 409, retry).
//   2. `record`  — persist the success body so later duplicates can replay it.
//   3. `release` — drop the claim when the mutation FAILS, so a genuine retry can
//                  proceed (no permanent lockout on a failed attempt).
//
// SCOPING (security): the claim key is `${action}:${playerId}:${nonce}`, or
// `${action}:${playerId}:${target}:${nonce}` when a target is supplied (e.g. a
// build/upgrade against a specific plot+facility). The same nonce only collides
// for the SAME player AND the SAME action AND the SAME target. A different player,
// a different action, or a different target with the same nonce string gets a
// distinct key and never collides — one player can never block or replay another's
// action, and a build on plot A never collides with a build on plot B.
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionNonceRecord {
  playerId: string;
  action: string;
  /**
   * Optional target scope (e.g. `${encodeURIComponent(parcelId)}:${type}`).
   * Folded into the key so the same nonce can be claimed independently per
   * target. Omitted for target-less actions (e.g. claim-frontier) — the key is
   * then unchanged.
   */
  target?: string;
  /**
   * Optional canonical payload fingerprint. When supplied, a same-key REPLAY
   * whose stored fingerprint DIFFERS is rejected as a `conflict` (409) rather
   * than replayed — this is how the plot-attack endpoint enforces
   * "same key + different parameters → reject" while keeping the key stable
   * across retries of the SAME logical attack.
   */
  fingerprint?: string;
}

/** Result of the store's atomic claim. */
export type StoreClaimResult =
  | { inserted: true }
  | { inserted: false; response: string | null; fingerprint: string | null };

/**
 * Store contract — a durable, atomic claim-once ledger with response persistence.
 * - `claim`    inserts the key if absent (→ inserted:true); otherwise returns the
 *              row's persisted response + fingerprint (response NULL = in-flight).
 * - `complete` persists the success body (and optional fingerprint) for later replay.
 * - `remove`   deletes the claim (used when the mutation failed).
 * - `prune`    deletes claims older than `olderThanMs` (TTL housekeeping, ID-004);
 *              reaps both completed rows and crash-orphaned in-flight rows.
 *              Returns the number of rows removed.
 */
export interface ActionNonceStore {
  claim(key: string, rec: ActionNonceRecord): Promise<StoreClaimResult>;
  complete(key: string, responseJson: string, fingerprint?: string): Promise<void>;
  remove(key: string): Promise<void>;
  prune(olderThanMs: number): Promise<number>;
}

export type ActionClaimResult =
  | { ok: true; replay: false }
  | { ok: true; replay: true; response: string }
  | { ok: false; reason: "invalid_nonce" | "in_progress" | "store_unavailable" | "conflict" };

// Client-supplied nonce: a bounded, opaque token (UUID/nanoid-shaped). Rejecting
// anything outside this charset/length keeps the key well-formed and prevents
// oversized/structured input. Generic — no secret material.
const NONCE_RE = /^[A-Za-z0-9_-]{8,128}$/;

/** Deterministic, collision-scoped key. Exported for testing. */
export function actionNonceKey(action: string, playerId: string, nonce: string, target?: string): string {
  return target
    ? `${action}:${playerId}:${target}:${nonce}`
    : `${action}:${playerId}:${nonce}`;
}

export function createActionIdempotencyGuard(store: ActionNonceStore | null) {
  // Dev/mem fallback (single-process). Production injects a DB-backed store for
  // cross-instance protection (see routes.ts wiring + the action_nonces table).
  // Map value: `response` is the persisted body (null while in-flight);
  // `fingerprint` is the canonical-payload fingerprint (attacks); `createdAt`
  // is the claim time, used by `prune` for TTL housekeeping (mirrors the DB row).
  const seen = new Map<string, { response: string | null; fingerprint?: string | null; createdAt: number }>();

  function keyFor(scope: ActionNonceRecord, nonce: string): string {
    return actionNonceKey(scope.action, scope.playerId, nonce, scope.target);
  }

  return {
    /**
     * Reserve a (player, action, target, nonce) tuple, or surface a prior result.
     * - invalid/missing nonce  → { ok:false, reason:"invalid_nonce" }    (caller → 400)
     * - duplicate + recorded   → { ok:true,  replay:true, response }     (caller → 200, replay)
     * - duplicate, in-flight   → { ok:false, reason:"in_progress" }      (caller → 409, retry)
     * - store error (fail closed) → { ok:false, reason:"store_unavailable" } (caller → 503)
     * - fresh                  → { ok:true,  replay:false }              (caller runs mutation)
     */
    async claim(scope: ActionNonceRecord, nonce: unknown, fingerprint?: string): Promise<ActionClaimResult> {
      if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) {
        return { ok: false, reason: "invalid_nonce" };
      }
      const key = keyFor(scope, nonce);

      if (store) {
        try {
          const res = await store.claim(key, {
            playerId: scope.playerId,
            action: scope.action,
            target: scope.target,
            fingerprint,
          });
          if (res.inserted) return { ok: true, replay: false };
          // Completed row — if a fingerprint was provided and it differs from the
          // stored one, this is a same-key replay with DIFFERENT parameters:
          // reject as a conflict (409) instead of replaying the original body.
          if (res.response != null) {
            if (fingerprint != null && res.fingerprint != null && res.fingerprint !== fingerprint) {
              return { ok: false, reason: "conflict" };
            }
            return { ok: true, replay: true, response: res.response };
          }
          return { ok: false, reason: "in_progress" };
        } catch {
          // Never double-apply on a broken ledger — reject rather than guess.
          return { ok: false, reason: "store_unavailable" };
        }
      }

      const existing = seen.get(key);
      if (existing) {
        if (existing.response != null) {
          if (fingerprint != null && existing.fingerprint != null && existing.fingerprint !== fingerprint) {
            return { ok: false, reason: "conflict" };
          }
          return { ok: true, replay: true, response: existing.response };
        }
        return { ok: false, reason: "in_progress" };
      }
      seen.set(key, { response: null, fingerprint: null, createdAt: Date.now() });
      return { ok: true, replay: false };
    },

    /**
     * Persist the success body so a later duplicate of the same nonce replays it.
     * Best-effort: a persistence failure leaves the claim in-flight (later
     * duplicates get "in_progress"), but never throws back to the (already
     * succeeded) caller.
     */
    async record(scope: ActionNonceRecord, nonce: unknown, responseJson: string, fingerprint?: string): Promise<void> {
      if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) return;
      const key = keyFor(scope, nonce);
      if (store) {
        try {
          await store.complete(key, responseJson, fingerprint);
        } catch {
          /* best-effort: the original response is still returned to the caller */
        }
        return;
      }
      const existing = seen.get(key);
      if (existing) {
        existing.response = responseJson;
        if (fingerprint != null) existing.fingerprint = fingerprint;
      } else {
        seen.set(key, { response: responseJson, fingerprint: fingerprint ?? null, createdAt: Date.now() });
      }
    },

    /**
     * Drop the claim after a FAILED mutation so a genuine retry can proceed.
     * Best-effort: a delete failure leaves the claim in-flight (fail-closed), but
     * never throws back to the caller.
     */
    async release(scope: ActionNonceRecord, nonce: unknown): Promise<void> {
      if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) return;
      const key = keyFor(scope, nonce);
      if (store) {
        try {
          await store.remove(key);
        } catch {
          /* best-effort: claim remains in-flight; the periodic prune reaps it */
        }
        return;
      }
      seen.delete(key);
    },

    /**
     * TTL housekeeping (ID-004): drop claims older than `olderThanMs`. Reaps both
     * completed rows (which now also store `response_json`) and crash-orphaned
     * in-flight rows, so `action_nonces` cannot grow unbounded. Best-effort: a
     * store error returns 0 rather than throwing (a maintenance job, not a request
     * path). `olderThanMs` must comfortably exceed the legitimate retry window —
     * after it elapses a nonce is forgotten (replay protection lasts the TTL; normal
     * play uses a fresh nonce per action and never relies on an older one). Returns
     * the number of claims removed.
     */
    async prune(olderThanMs: number): Promise<number> {
      if (store) {
        try {
          return await store.prune(olderThanMs);
        } catch {
          return 0;
        }
      }
      const cutoff = Date.now() - olderThanMs;
      let removed = 0;
      for (const [key, rec] of seen) {
        if (rec.createdAt < cutoff) {
          seen.delete(key);
          removed++;
        }
      }
      return removed;
    },
  };
}
