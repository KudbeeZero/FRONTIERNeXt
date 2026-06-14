# Security pass — stable idempotency nonce (two-phase claim/record/release + replay)

**Date:** 2026-06-14
**Surface:** `server/idempotencyGuard.ts`, the DB store + `guardClaimOrRespond` in
`server/routes.ts`, the three enforced routes (`claim-frontier`, `build`,
`upgrade`), and the client nonce generation (`client/src/lib/safeUuid.ts`,
`useGameState`, `GameLayout`).
**Unit:** `feat/idempotency-stable-nonce` (ID-003 + ID-001 + ID-002).
**Verdict:** PASS — no new vulnerability; the change strengthens duplicate
prevention and adds an idempotent replay. No code fix required beyond the feature;
its security properties are backed by the unit's tests. Accepted risks carried
forward (rate limit, HTTP-mount test, crash-window).

## What changed (security-relevant)
- Guard is now two-phase: `claim` reserves the key (response NULL = in-flight) →
  mutation runs → `record` persists the success body → later duplicates **replay**
  it (200). A failed mutation calls `release` (deletes the claim) so a retry can
  proceed. In-flight duplicate → 409; missing/malformed → 400; store error → 503.
- New `action_nonces.response_json` / `completed_at` columns (migration 0007, staged).
- Client: `safeUuid()` (never throws), nonce generated once per logical action and
  passed in `.mutate()` variables (stable across React-Query retries).

## Checklist
| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Auth boundaries | ✅ | Both routes are `/api/actions/*` POST → global mutation middleware binds `playerId` to the session; build also `assertPlayerOwnership`. Unchanged by this unit. |
| 2 | No client-id trust | ✅ | The nonce **key includes the auth-verified `playerId`**, so a replay can only ever return the requesting player's own stored response. |
| 3 | Input validation | ✅ | zod schemas unchanged (`idempotencyKey` already optional); nonce still validated by `NONCE_RE`. `record`/`release` re-validate before use. |
| 4 | Rate limits | ⚠️ accepted-risk | Still no limiter on `/api/actions/*` — pre-existing (`feat/rate-limit-actions`, scheduled AFTER this unit). The nonce guard blocks replay/retry, not volumetric spam. |
| 5 | Secrets handling | ✅ | No secret added/read. `response_json` stores the action's own success body (parcel / claimed amount / asaId) — no secret material. No `ENV_VARS.md` change. |
| 6 | CORS + headers | ✅ | Unchanged. |
| 7 | Transaction / finality | ✅ (N/A) | No payment-verification path touched. **claim-frontier on replay does NOT re-credit ASCEND and does NOT re-enqueue the on-chain transfer** — `record` runs only on the success path; the credit (`claimAscend`) + enqueue run once, on the fresh request. Replay returns the original `{claimed, asaId}` only. `fireBurn` (build) likewise runs once. |
| 8 | Replay / idempotency | ✅ (the feature) | Two-phase guard claims before the spend; duplicate of a completed action → 200 replay (no re-apply); in-flight → 409; broken store → 503 (fail closed). Tested in `idempotencyGuard.spec.ts` (23 cases). |
| 9 | Admin endpoints | ✅ | None touched. |
| 10 | Logs leaking secrets | ✅ | `guardClaimOrRespond`/`idempotencyRejection` return generic strings; never log/echo nonce/key/playerId/response. |
| 11 | Dependency risk | ✅ | No new deps; `--frozen-lockfile` clean. |

## Cross-player replay-leak analysis (the new risk)
The replayed `response_json` is returned **only** to a request whose claim key
matches — and the key is `${action}:${playerId}[:${target}]:${nonce}` with the
**auth-verified** `playerId`. A different player presenting the same nonce string
produces a different key → a fresh claim → they never read another player's stored
response. The storeless Map fallback uses the identical keying. Covered by the
cross-player / cross-action / cross-target "no collision" tests. **No leak.**

## Funds-economic note
The change can only **prevent** double-application (replay returns the original
result; no second credit/transfer/burn). It does not move funds, change pricing,
or alter finality — consistent with #26/#27 (claim-frontier shipped without
`algo-auditor`). **No `algo-auditor` pass required** for a pure
idempotency/duplicate-prevention strengthening. A change to the credit/burn
*amounts* or finality would still require `algo-auditor` + `/mainnet-gate`.

## Accepted risks (documented, not fixed)
- **Crash window (LOW):** a process crash *between* the mutation and `record`
  leaves a claimed-but-incomplete row → future duplicates of that **exact** nonce
  get 409 until ID-004 prunes it. The player's next *new* action uses a new nonce,
  so no lockout. `release` already covers the normal failure path.
- **No live-DB / HTTP-mount test:** the 400/409/503/200-replay wiring is verified
  by reading + direct guard unit tests (same `routes.ts` entanglement as
  #25/#26/#27). Runtime enforcement remains untested until
  `chore/registerRoutes-testable`.
- **No rate limit on `/api/actions/*`** (item 4) — separate scheduled unit.
- **Client retry-stability is by construction** (nonce in `.mutate()` variables,
  reused across React-Query retries) + `safeUuid` unit tests; no full hook-render
  test (no test-harness deps, consistent with existing mocked client tests).

## Tests backing this pass
- `server/idempotencyGuard.spec.ts` (rewritten, 23 cases): fresh / replay /
  in_progress / release-then-reclaim; broken-store fail-closed; best-effort
  record/release (no throw); cross-player/action/target no-collision; safe-enum
  reasons; deterministic target-scoped key.
- `client/tests/safeUuid.spec.ts` (+4): charset/length, uniqueness, fallback when
  `crypto.randomUUID`/`crypto` absent (no throw).
- `check` tsc 0 · `test:server` 236 → **240** · `test` 45 → **49**.
