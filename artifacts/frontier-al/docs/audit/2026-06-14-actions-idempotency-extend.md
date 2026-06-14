# Security pass — extend idempotency-nonce guard to build & upgrade

**Date:** 2026-06-14
**Surface:** `POST /api/actions/build`, `POST /api/actions/upgrade` (and the shared
`server/idempotencyGuard.ts`).
**Unit:** `feat/actions-idempotency-extend` — reuse PR #26's
`createActionIdempotencyGuard`, add a `target` dimension, enforce on build/upgrade.
**Verdict:** PASS — no new vulnerability; the change is itself a defensive control
(duplicate-application prevention). One LOW accepted-risk carried over from PR #26.

## What changed (scope)
- `idempotencyGuard.ts`: optional `scope.target` folded into the key →
  `${action}:${playerId}:${target}:${nonce}` (target-less key unchanged, so
  claim-frontier is byte-for-byte identical — no migration, no regression).
- `routes.ts`: build & upgrade claim the nonce **before** the spend/mutation
  (`buildImprovement` / `upgradeBase` / `fireBurn`); `target = parcelId:type`.
  Shared `idempotencyRejection()` maps reason → 400/409/503 with generic text.
- `shared/schema.ts`: optional `idempotencyKey` on build/upgrade schemas.
- client `useBuild`/`useUpgrade`: send a fresh `crypto.randomUUID()` per call.

## Checklist
| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Auth boundaries | ✅ | Both routes are `/api/actions/*` POST → global mutation middleware `routes.ts:409-427` (`evaluateOwnership`) binds body `playerId` to the session; build additionally calls `assertPlayerOwnership` `routes.ts:1646`. So the `playerId` in the nonce key is auth-verified (when `WALLET_AUTH_REQUIRED`). |
| 2 | Wallet/signature & no client-id trust | ✅ | playerId is only ever trusted to *match* the session (middleware). The guard never trusts a client id in isolation. |
| 3 | Input validation | ✅ | `buildActionSchema`/`upgradeActionSchema` zod-parsed before the claim; nonce validated by `NONCE_RE = /^[A-Za-z0-9_-]{8,128}$/` (`idempotencyGuard.ts:34`) — missing/malformed/oversized/non-string → `invalid_nonce` → 400. |
| 4 | Rate limits | ⚠️ accepted-risk | No per-IP/per-player limiter on `/api/actions/*` — **pre-existing** (baton open-risk #4, `feat/rate-limit-actions`). Out of this unit's scope; the nonce guard blocks *replay of the same request*, not volumetric spam. Flagged, not fixed here. |
| 5 | Secrets handling | ✅ | No secret added/read; nonce is opaque client-supplied, no secret material. No `ENV_VARS.md` change. |
| 6 | CORS + headers | ✅ | Unchanged by this unit. |
| 7 | Transaction / finality | ✅ (N/A) | build/upgrade spend in-game ASCEND (no on-chain payment verification path). `fireBurn` (on-chain burn, fire-and-forget) runs only *after* the guard, so a duplicate request can no longer trigger a second burn — the guard tightens funds safety, it does not change funds logic. |
| 8 | Replay / idempotency | ✅ (the fix) | Guard claims `(player, action, target, nonce)` **before** the mutation; replay → 409, broken store → 503 (fail closed). Tested: `idempotencyGuard.spec.ts` build/upgrade duplicate-blocked + fail-closed (`tryInsert` throws → `store_unavailable`). |
| 9 | Admin endpoints | ✅ | None touched. |
| 10 | Logs leaking secrets | ✅ | `idempotencyRejection()` returns generic strings only; never echoes nonce/key/playerId/target. Spec test asserts the reason matches none of `alice/550e8400/upgrade/plot-42/defense`. No new `console.*` of the nonce. |
| 11 | Dependency risk | ✅ | No new deps; `pnpm install --frozen-lockfile` clean; lockfile unchanged. |

## Key-collision analysis
- Key segments: `action` (fixed literal `build`/`upgrade`/`claim-frontier`),
  `playerId` (auth-verified), `target` (`parcelId:type`), `nonce` (charset
  excludes `:`). Cross-player, cross-action and cross-target requests always
  produce distinct keys (tests 5, 6, 6b). A theoretical target-string ambiguity
  (`parcelId`/type containing `:`) could only alias two *different targets of the
  same player+action*; the effect would be a stricter (extra) rejection, never a
  cross-player/cross-action collision and never a double-spend — fail-safe.

## Accepted risks (documented, not fixed)
- **No `release()` on the action guard (LOW)** — carried over from PR #26. If the
  spend/mutation throws *after* the nonce is claimed, the nonce stays consumed.
  Effect is fail-closed (no double-spend); the client uses a fresh UUID per call,
  so a genuine retry uses a new nonce and is never locked out. Acceptable.
- **Genuine double-submits (two independent clicks) are out of scope** — each
  generates a distinct nonce, so both proceed. The control is *replay/retry of an
  identical request* (same nonce), exactly as the unit requires. UI debounce /
  rate-limiting (#4) is the separate mitigation for rapid double-clicks.
- **No live-DB / HTTP-mount test** — same `routes.ts` import entanglement as
  PR #25/#26. The guard is unit-tested directly with the exact scopes the routes
  use; the route wiring (claim-before-spend, 400/409/503) is verified by reading.

## Funds-economic note
The change can only *reject* a duplicate; it never widens acceptance, moves funds,
or alters pricing/finality. Consistent with PR #26 (claim-frontier, audited PASS
without `algo-auditor`), no `algo-auditor` pass is required for a pure
duplicate-prevention guard. A funds-moving change to the burn/economy logic itself
would still require `algo-auditor` + `/mainnet-gate`.

## Tests backing this pass
`server/idempotencyGuard.spec.ts` (+11, server 225 → 236): build/upgrade valid
first; duplicate blocked; cross-player / cross-action / cross-target no-collision;
missing & malformed nonce rejected; safe-enum reasons + fail-closed; deterministic
target-scoped key. `pnpm --filter @workspace/frontier-al run check` → tsc 0;
`test:server` → 236/236; `test` → 45/45.
