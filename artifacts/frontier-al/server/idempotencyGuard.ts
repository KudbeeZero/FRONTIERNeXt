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
}

/** Result of the store's atomic claim. */
export type StoreClaimResult =
  | { inserted: true }
  | { inserted: false; response: string | null };

/**
 * Store contract — a durable, atomic claim-once ledger with response persistence.
 * - `claim`    inserts the key if absent (→ inserted:true); otherwise returns the
 *              row's persisted response (null while the first request is in-flight).
 * - `complete` persists the success body for later replay.
 * - `remove`   deletes the claim (used when the mutation failed).
 */
export interface ActionNonceStore {
  claim(key: string, rec: ActionNonceRecord): Promise<StoreClaimResult>;
  complete(key: string, responseJson: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export type ActionClaimResult =
  | { ok: true; replay: false }
  | { ok: true; replay: true; response: string }
  | { ok: false; reason: "invalid_nonce" | "in_progress" | "store_unavailable" };

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
  // Map value = persisted response, or null while the first request is in-flight.
  const seen = new Map<string, string | null>();

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
    async claim(scope: ActionNonceRecord, nonce: unknown): Promise<ActionClaimResult> {
      if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) {
        return { ok: false, reason: "invalid_nonce" };
      }
      const key = keyFor(scope, nonce);

      if (store) {
        try {
          const res = await store.claim(key, { playerId: scope.playerId, action: scope.action, target: scope.target });
          if (res.inserted) return { ok: true, replay: false };
          return res.response != null
            ? { ok: true, replay: true, response: res.response }
            : { ok: false, reason: "in_progress" };
        } catch {
          // Never double-apply on a broken ledger — reject rather than guess.
          return { ok: false, reason: "store_unavailable" };
        }
      }

      if (seen.has(key)) {
        const prior = seen.get(key) ?? null;
        return prior != null
          ? { ok: true, replay: true, response: prior }
          : { ok: false, reason: "in_progress" };
      }
      seen.set(key, null);
      return { ok: true, replay: false };
    },

    /**
     * Persist the success body so a later duplicate of the same nonce replays it.
     * Best-effort: a persistence failure leaves the claim in-flight (later
     * duplicates get "in_progress"), but never throws back to the (already
     * succeeded) caller.
     */
    async record(scope: ActionNonceRecord, nonce: unknown, responseJson: string): Promise<void> {
      if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) return;
      const key = keyFor(scope, nonce);
      if (store) {
        try {
          await store.complete(key, responseJson);
        } catch {
          /* best-effort: the original response is still returned to the caller */
        }
        return;
      }
      seen.set(key, responseJson);
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
          /* best-effort: claim remains in-flight; ID-004 prune will reap it */
        }
        return;
      }
      seen.delete(key);
    },
  };
}
