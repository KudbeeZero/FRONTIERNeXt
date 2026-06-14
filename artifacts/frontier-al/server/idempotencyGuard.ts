// ─────────────────────────────────────────────────────────────────────────────
// Action idempotency / replay guard.
//
// Blocks a duplicate submission of a mutating action from double-applying its
// state change (e.g. a double-click or a replayed request that would credit
// ASCEND or enqueue a transfer twice). Mirrors createPaymentReplayGuard: a
// store-backed claim-once with a deterministic key, an in-process fallback for
// dev/mem, and FAIL-CLOSED behavior when the store errors.
//
// SCOPING (security): the claim key is `${action}:${playerId}:${nonce}`, so the
// same nonce only collides for the SAME player AND the SAME action. A different
// player (or a different action) with the same nonce string gets a distinct key
// and never collides — one player can never block or replay another's action.
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionNonceRecord {
  playerId: string;
  action: string;
}

/** Store contract — `tryInsert` returns false if the key already exists. */
export interface ActionNonceStore {
  tryInsert(key: string, rec: ActionNonceRecord): Promise<boolean>;
}

export type ActionClaimResult =
  | { ok: true }
  | { ok: false; reason: "invalid_nonce" | "already_processed" | "store_unavailable" };

// Client-supplied nonce: a bounded, opaque token (UUID/nanoid-shaped). Rejecting
// anything outside this charset/length keeps the key well-formed and prevents
// oversized/structured input. Generic — no secret material.
const NONCE_RE = /^[A-Za-z0-9_-]{8,128}$/;

/** Deterministic, collision-scoped key. Exported for testing. */
export function actionNonceKey(action: string, playerId: string, nonce: string): string {
  return `${action}:${playerId}:${nonce}`;
}

export function createActionIdempotencyGuard(store: ActionNonceStore | null) {
  // Dev/mem fallback (single-process). Production injects a DB-backed store for
  // cross-instance protection (see routes.ts wiring + the action_nonces table).
  const seen = new Set<string>();

  return {
    /**
     * Claim a (player, action, nonce) tuple exactly once.
     * - invalid/missing nonce       → { ok:false, reason:"invalid_nonce" }   (caller → 400)
     * - already used (replay)        → { ok:false, reason:"already_processed" } (caller → 409)
     * - store error (fail closed)    → { ok:false, reason:"store_unavailable" } (caller → 503)
     */
    async claim(scope: ActionNonceRecord, nonce: unknown): Promise<ActionClaimResult> {
      if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) {
        return { ok: false, reason: "invalid_nonce" };
      }
      const key = actionNonceKey(scope.action, scope.playerId, nonce);

      if (store) {
        try {
          const inserted = await store.tryInsert(key, { playerId: scope.playerId, action: scope.action });
          return inserted ? { ok: true } : { ok: false, reason: "already_processed" };
        } catch {
          // Never double-apply on a broken ledger — reject rather than guess.
          return { ok: false, reason: "store_unavailable" };
        }
      }

      if (seen.has(key)) return { ok: false, reason: "already_processed" };
      seen.add(key);
      return { ok: true };
    },
  };
}
