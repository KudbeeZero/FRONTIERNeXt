# PR #232 audit — `chore/db-indexes-ratelimit`

**Auditor:** session/agent_9e21544f (handoff-audit subagent)
**Date:** 2026-07-09
**Verdict (initial):** ⚠️ **CONCERNS** (not blocking, but real test gap)
**Verdict (post-fix):** ✅ **PASS** — see "Resolution" below.

## TL;DR

PR #232 delivers exactly what it claims (migration 0014, `strictLimiter` bound to 5 route groups, `STRICT_RATE_LIMIT` env var, `LIMIT 1000` on `queryPurchaseIntents()`, 3 new tests). All 480 server tests pass and CI is green (verified directly: `Typecheck & server tests` ✅ + `Cloudflare Pages` ✅).

The single non-blocking concern: **the third "returns 429 after exceeding limit" test does not actually exercise the exported `strictLimiter`** — it builds a fresh inline `testLimiter` with a hard-coded limit of 2 and tests that. This means the production `strictLimiter`'s actual configuration (windowMs, limit, keyFn, headers) is not directly tested for the rate-limiting behavior. Tests 1+2 cover export/existence and the happy path (next() called), but no test confirms the production limiter returns 429 when its real 60/min limit is exceeded.

## Claim verification

| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | Migration 0014 adds 6 indexes with `IF NOT EXISTS` | ✅ verified | `migrations/0014_db_indexes_purchase_funnel.sql:15-36` |
| 2 | `strictLimiter` exported from `server/security.ts` | ✅ verified | `server/security.ts:164-170` |
| 3 | `strictLimiter` bound to 5 route groups | ✅ verified | `server/routes.ts:502-510` |
| 4 | `STRICT_RATE_LIMIT` env var works | ✅ verified | `server/security.ts:166` uses `Number(process.env.STRICT_RATE_LIMIT) || 60` |
| 5 | `queryPurchaseIntents()` has `LIMIT 1000` | ✅ verified | `server/services/chain/chainEventStore.ts:94` |
| 6 | 3 new tests in `strictLimiter.spec.ts` | ⚠️ partial | Tests exist; test 3 uses a fresh inline limiter, not the exported one |

## Test results (re-run by auditor)

```
pnpm --filter @workspace/frontier-al run check
  → tsc clean (0 errors)

pnpm --filter @workspace/frontier-al run test:server
  → 480 passed | 24 skipped (504 total)
  → strictLimiter tests: 3/3 pass
```

## Scope check

- Files touched: 8 (all in-scope)
  - `migrations/0014_db_indexes_purchase_funnel.sql` (new)
  - `server/db-schema.ts` (modified — indexes added to match migration)
  - `server/routes.ts` (modified — middleware binding)
  - `server/security.ts` (modified — new `strictLimiter`)
  - `server/services/chain/chainEventStore.ts` (modified — `LIMIT 1000`)
  - `server/strictLimiter.spec.ts` (new)
  - `artifacts/frontier-al/session-notes/2026-07-09-m1-6-db-indexes-ratelimit.md` (new)
  - `docs/HANDOFF.md` (modified — baton update)
- No out-of-scope changes.

## Security / hard-rule check

- ✅ No `wip/atomic-purchase` changes
- ✅ No `ops/kestra/` changes
- ✅ No mainnet constants hardcoded
- ⚠️ `strictLimiter` uses in-memory store (same as `actionsLimiter`) — explicitly documented in code comment + session note as acceptable for single-instance Fly; flagged as future-scaling concern only.

## Concerns

### 1. Test 3 doesn't exercise the production `strictLimiter` (non-blocking but real)

`server/strictLimiter.spec.ts:27-61`:
```ts
it("returns 429 after exceeding limit", async () => {
  // Create a fresh limiter with limit of 2 for testing
  const { rateLimit } = await import("express-rate-limit");
  const testLimiter = rateLimit({ windowMs: 60_000, limit: 2, ... });

  // First two requests should pass
  await testLimiter(mockReq, mockRes, next);
  ...
  // Third request should be rate limited
  await testLimiter(mockReq, mockRes, next);
  expect(mockRes.status).toHaveBeenCalledWith(429);
});
```

This proves `express-rate-limit` v7 works as expected — not that the production `strictLimiter` does. If a future change accidentally breaks `strictLimiter` (e.g. wrong keyFn, wrong `limit` value, broken store), this test would still pass.

**Severity:** minor — the production limiter is constructed with the standard `express-rate-limit` options and the config is trivial (windowMs/limit/message). The risk of a silent regression is low. But the test title ("returns 429 after exceeding limit") implies it tests the export, which it does not.

**Fix (small, in this PR):** either (a) drop test 3 (rely on the library being well-tested), or (b) use the exported `strictLimiter` directly with a tiny limit override, or (c) split out a testable factory.

### 2. Drizzle schema vs raw SQL migration sync (informational, not blocking)

Migration 0014 uses raw SQL while `db-schema.ts` uses Drizzle's `index()` helpers. Both create the same indexes. If someone runs `drizzle-kit push` in the future (instead of the staged manual application), the indexes would be re-created as no-ops. Not a bug, but a minor consistency risk. **Recommendation:** document in `migrations/0014_*` that this migration is intentionally a one-off raw SQL and should not be regenerated from the schema.

### 3. Nullable column index on `player_faction_id` (informational)

`db-schema.ts:245` creates a btree index on `playerFactionId` which can be NULL. Postgres handles this fine (NULL values are indexed), but the index will be less selective on the NULL half. Not a bug, just worth noting if `player_faction_id` query patterns are reviewed later.

## What could not be verified

- Live PostgreSQL performance improvement from the indexes (no live prod DB in sandbox)
- Multi-instance rate-limiter bypass (memory store limitation, would require multi-instance Fly + Redis)
- Admin dashboard behavior with >1000 purchase intents (safety cap untested with real data)

## Verdict justification

PR #232 is functionally solid — the diff matches every claim, the migration is well-formed, the middleware binding is correct, and the env var works. The one real gap is the third test's vacuous use of an inline limiter, which means the production `strictLimiter`'s rate-limiting behavior is not directly tested. The other concerns are informational only.

**Recommendation:** merge as-is, with a follow-up to either fix test 3 or document the gap. The core change is correct and well-scoped.

## Resolution (2026-07-09, same session)

Follow-up commit `340ba3c` ("fix(test): strictLimiter test 3 now exercises the production factory") addresses the only blocking concern:

- Refactored `server/security.ts:160-184` to expose a `createStrictLimiter(options?)` factory. The exported `strictLimiter` is now `createStrictLimiter()` — same production behavior, no config drift.
- Rewrote test 3 in `server/strictLimiter.spec.ts` to use `createStrictLimiter({ limit: 2 })` — the test now exercises the real production code path (windowMs, headers, message) with a small limit override, rather than a parallel inline config that could silently drift.
- Re-verified: `pnpm run check` clean, `pnpm run test:server` 480 passed | 24 skipped (504 total), `pnpm exec vitest run strictLimiter` 3/3 pass. CI green on `340ba3c` (`Typecheck & server tests` ✅ + `Cloudflare Pages` ✅).

**Updated verdict:** ✅ **PASS.** Test 3 now actually tests the production limiter's 429 behavior. The other two concerns (Drizzle-vs-raw-SQL sync, nullable column index) remain informational and are out of scope for this PR.
