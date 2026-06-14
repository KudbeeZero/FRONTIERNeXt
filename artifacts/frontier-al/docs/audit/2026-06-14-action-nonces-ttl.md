# Security pass — action_nonces TTL + periodic prune (ID-004)

**Date:** 2026-06-14 · **Branch:** `chore/action-nonces-ttl` · **Verdict: PASS**
(1 finding fixed — env docs; 1 accepted-risk documented). No code vulnerability.

## Scope
The two-phase idempotency guard (#29) persists `response_json` on every completed
action, so `action_nonces` grows with traffic and crash-orphaned in-flight rows
never get reaped. This unit adds a TTL + periodic prune. Files: `idempotencyGuard.ts`
(`prune` on store + guard, Map gains `createdAt`), `routes.ts` (DB `prune`
`DELETE … WHERE created_at < cutoff` + `pruneActionNonces` + env knobs),
`index.ts` (`unref`'d hourly interval), `db-schema.ts` + `migrations/0008` (index
on `created_at`), spec (+4 prune tests).

## Checklist
| # | Item | Verdict | Evidence / note |
|---|------|---------|------|
| 1 | Auth boundaries | ✅ | No new route. `prune` is an internal maintenance op, not request-reachable. |
| 2 | Wallet/signature | ✅ | Untouched. |
| 3 | Input validation | ✅ | `prune(olderThanMs: number)` takes no user input. Env knobs parsed `Number()` with a `Math.max(60_000, …)` floor → no sub-minute/NaN/negative TTL. |
| 4 | Rate limits | ✅ (n/a) | No new endpoint. `/api/actions/*` limiter unchanged (`feat/rate-limit-actions` is a separate unit). |
| 5 | Secrets handling | ⚠️→fixed | The two new knobs are **config, not secrets**, but were undocumented. **Fixed:** added `ACTION_NONCE_TTL_MS` + `ACTION_NONCE_PRUNE_INTERVAL_MS` to `ENV_VARS.md` and `docs/DEPLOYMENT_ENV_CHECKLIST.md`. No secret added. |
| 6 | CORS + headers | ✅ | Untouched. |
| 7 | Transaction/finality | ✅ | `verifyAlgoPayment` untouched (still indexer-only — pre-existing, tracked). |
| 8 | Replay / idempotency | ✅ (accepted-risk) | See below — prune defines the replay-protection window; the guard stays fail-closed and prune is best-effort. |
| 9 | Admin endpoints | ✅ | Untouched. |
| 10 | Logs leaking secrets | ✅ | Prune logs only a row **count** (`pruned N expired row(s)`) — no key/nonce/playerId/response body. |
| 11 | Dependency risk | ✅ | No new deps (`pnpm-lock.yaml`/`package.json` unchanged); `lt` is an existing `drizzle-orm` export. |

## Item 8 — replay/idempotency analysis (the load-bearing item)
Pruning a completed nonce row **forgets** it, so a replay of that exact nonce
*after the TTL* would be treated as fresh and re-execute. Why this is safe:

- **TTL ≫ legitimate retry window.** Default 24h, hard floor 60s. Browser/network
  retries resolve in seconds; nothing legitimate replays a >TTL-old nonce.
- **Fresh nonce per logical action (#29).** The client mints a new nonce per
  action, so normal play never resubmits an aged nonce — replay protection is for
  transient retries, which live far inside the TTL.
- **Bounded blast radius even on a deliberate >TTL replay.** `claim-frontier`
  re-credit is ~0 (the accumulator is zeroed in-transaction; see the #29 funds
  audit); a `build`/`upgrade` replay after the TTL would require an attacker
  resubmitting a >24h-old *authenticated* request, which is bounded by session/auth
  expiry (a separate control, `WALLET_AUTH_REQUIRED`).
- **Guard stays fail-closed; prune is best-effort.** `claim` still rejects on a
  broken store (503). `prune` swallows store errors and returns 0 — a prune failure
  can never open a double-apply on the request path. Covered by tests
  (`prune` best-effort returns 0; fresh rows survive; aged rows reaped).

**In-flight reap race — MITIGATED (was the one finding from `/code-review`).**
The prune reaps purely by `created_at` age and does not exclude in-flight
(`response_json IS NULL`) rows — intentional, so it also reaps crash-orphaned
claims. The risk: if a request is still running *and* older than the TTL, the
prune could delete its in-flight row and let a concurrent duplicate re-claim and
double-apply. The original 60s floor left this reachable under an aggressive
misconfiguration (a request stalling ~60s on slow on-chain confirmation / DB
contention). **Fix:** the TTL floor is raised to **10 min** (`routes.ts`
`ACTION_NONCE_TTL_MS`), far above the synchronous request window (claim→mutation→
record is sub-second; the ASCEND transfer is enqueued fire-and-forget, not
awaited). No reachable configuration now lets the prune reap a live claim. The
default remains 24h. Backed by the existing prune tests (reap-aged / keep-fresh /
best-effort) + the raised constant bound.

## Funds / algo-auditor
No funds math, amount, recipient, burn, or transfer logic changed — this only
reaps old idempotency rows. **`algo-auditor` not warranted** (consistent with the
#29 funds audit, which found no funds-logic change).

## Fixes (each test-backed where it is code)
- **Env docs** (finding #5) — doc-only, no test needed.
- **Prune behavior** — backed by 4 new tests in `server/idempotencyGuard.spec.ts`
  (reap-aged + forget; keep-fresh; best-effort-returns-0; storeless reap). Suite
  236→**244** server, client unchanged at 49, `tsc` 0.

No broad refactor; changes are centralized in the existing guard + store wiring.
