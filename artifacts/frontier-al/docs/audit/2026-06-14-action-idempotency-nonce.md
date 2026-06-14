# Security pass — action idempotency-nonce guard (PR #26)

**Date:** 2026-06-14 · **Scope:** the `feat/actions-idempotency-nonce` diff — the
new `createActionIdempotencyGuard` (`server/idempotencyGuard.ts`), the
`action_nonces` table + migration `0006`, the optional `idempotencyKey` schema
field, the `claim-frontier` enforcement in `routes.ts`, and the one client caller.

**Result:** PASS — no new finding. Net-positive: a double-submit/replay of the
ASCEND claim can no longer double-credit or double-enqueue an on-chain transfer.

## Checklist

| # | Item | Verdict | Evidence / note |
|---|------|---------|-----------------|
| 1 | Auth boundaries | ✅ | `claim-frontier` remains behind the global mutation middleware (auth + ownership, PR #25). The guard adds idempotency on top; `playerId` in the key is the auth-verified player. |
| 2 | Wallet / signature verification | ✅ | Unchanged. The nonce is scoped to the authenticated player; a client cannot use it to act as or block another player (test #3). |
| 3 | API input validation | ✅ | Nonce validated `/^[A-Za-z0-9_-]{8,128}$/`; missing/malformed → 400 (`invalid_nonce`). `idempotencyKey` optional in zod, enforced by the guard. |
| 4 | Rate limits | ⚠️ | **Pre-existing, out of scope:** no limiter on `/api/actions/*`. Unchanged. |
| 5 | Secrets handling | ✅ | No secrets. The nonce is an opaque client token (not secret material) and is never logged; secret scan over the diff → none. |
| 6 | CORS + headers | ✅ (n/a) | Not touched. |
| 7 | Transaction / finality | ✅ | **Improvement:** the guard claims the nonce BEFORE crediting/enqueuing, so a replay cannot double-enqueue the ASCEND transfer. The transfer/`verifyAlgoPayment` logic itself is unchanged (indexer-only finality remains a separate, pre-existing item). |
| 8 | Replay / idempotency | ✅ | The unit itself — fail-closed, player+action scoped, DB-atomic (`key` PK) with in-proc fallback, unit-tested (8 cases, `idempotencyGuard.spec.ts`). |
| 9 | Admin endpoints | ✅ | Unchanged. |
| 10 | Logs leaking secrets | ✅ | Guard reasons are safe enums (asserted not to echo player/nonce/key, test #6). `claim-frontier` error bodies are generic; no nonce/key logged. |
| 11 | Dependency risk | ✅ | No new deps; lockfile unchanged. `crypto.randomUUID()` is built-in (browser + Node). |

## Fixes applied
None required — the diff is itself a hardening (adds a guard; no control weakened).

## Funds note (Algorand-economic)
`claim-frontier` is funds-adjacent (credits ASCEND + enqueues an on-chain
transfer). This unit **adds no new funds-movement code** — it only *restricts*
the existing path against double-application. The transfer/clawback logic is
unchanged, so no new `algo-auditor` trigger. If a future unit changes the
transfer logic itself, an `algo-auditor` pass applies.

## Accepted risks / out of scope (documented in the PR + baton)
- Only `claim-frontier` enforced; `build`/`upgrade` remain double-submittable (follow-up).
- No HTTP route-mount test of the enforcement (guard unit-tested; wiring by inspection + tsc).
- Migration `0006` staged — until applied, the guard runs single-instance (in-proc fallback).
- No TTL/prune on `action_nonces` (operational housekeeping follow-up).
- Pre-existing: no rate limit on `/api/actions/*`; indexer-only finality; schemas not `.strict()`.
