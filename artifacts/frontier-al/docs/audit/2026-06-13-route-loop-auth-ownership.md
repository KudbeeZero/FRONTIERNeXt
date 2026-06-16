# Security pass — route-loop auth/ownership decision (PR #25)

**Date:** 2026-06-13 · **Scope:** the `feat/route-loop-server` diff (centralizing
the route-loop auth/ownership decision into `server/routeOwnership.ts` and wiring
the global mutation middleware + `assertPlayerOwnership` to it) and the route-loop
surface it governs. Behavior-preserving; no API/route/schema/client change.

**Result:** PASS — no new finding. Net-positive (the real auth decision is now
unit-tested). Pre-existing items below are documented as accepted / out-of-scope,
consistent with the baton.

## Checklist

| # | Item | Verdict | Evidence / note |
|---|------|---------|-----------------|
| 1 | Auth boundaries | ✅ | Global middleware (`routes.ts:389`) + `assertPlayerOwnership` (`routes.ts:232`) both now call `evaluateOwnership` (`routeOwnership.ts`): 401 when wallet auth enforced & no session; 403 on owner≠session. Decision preserved, now centralized + tested (`routeOwnership.spec.ts`). |
| 2 | Wallet / signature verification | ✅ | Unchanged — HMAC session via `getAuth`/`verifySession`. A client `playerId` is only trusted to *match* the session, never to act as another player (test #3). |
| 3 | API input validation | ✅ / ⚠️ | Bodies parsed by zod; malformed rejection now tested (`mineActionSchema`, test #5). ⚠️ **Pre-existing (not introduced, out of scope):** schemas are not `.strict()`, so unknown fields are stripped not rejected — LOW; a global `.strict()` risks breaking client payloads, deferred. |
| 4 | Rate limits | ⚠️ | **Pre-existing, baton-flagged, out of scope:** no limiter on `/api/actions/*` (mint-on-prepare DoS). Not touched here. |
| 5 | Secrets handling | ✅ | Secret scan over the diff → none. `routeOwnership.ts` holds only static, generic error strings. |
| 6 | CORS + headers | ✅ (n/a) | Not touched by this change. |
| 7 | Transaction / finality | ⚠️ | **Pre-existing, baton-flagged:** `verifyAlgoPayment` is indexer-only (no algod cross-check). Not touched here; rider rejection (PR #18) remains in place. |
| 8 | Replay / idempotency | ✅ / ⚠️ | Paid actions (`purchase`/`mint-avatar`) use `createPaymentReplayGuard` (fail-closed; `security.spec.ts` + new test #4). ⚠️ Free actions (`mine`/`collect`/`claim-frontier`) rely on cooldown/time-accrual, not a nonce — no general double-submit guard (documented; candidate next unit, deliberately not a broad change). |
| 9 | Admin endpoints | ✅ | `requireAdminKey` unchanged (fail-closed, constant-time, no query-param key in prod — PR #18). Not touched. |
| 10 | Logs leaking secrets | ✅ | This change adds no logging. Error bodies are generic and asserted not to echo session/address/playerId/token (test #6). |
| 11 | Dependency risk | ✅ | No new deps; `pnpm install --frozen-lockfile` leaves the lockfile unchanged. |

## Fixes applied
None required — the diff is itself a hardening (centralized, tested auth
decision). No control was weakened.

## Accepted risks / out of scope (unchanged by this PR, tracked in the baton)
- Schemas not `.strict()` (LOW input-validation).
- No rate limit on `/api/actions/*` (DoS).
- `verifyAlgoPayment` indexer-only finality.
- No idempotency nonce for free/resource actions.

## Funds note
No funds-moving code added or changed → no `algo-auditor` pass required for this
unit. (The replay guard governing paid actions is unchanged.)
