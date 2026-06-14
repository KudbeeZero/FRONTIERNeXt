# 2026-06-14 — action_nonces TTL + prune (ID-004) + retro-audit of #29

**Branch:** `chore/action-nonces-ttl` · **Unit:** ID-004 (Medium).

## Start-of-chat gate
- Independently audited the already-merged **PR #29** (stable idempotency nonce,
  ID-003) — two auditors (correctness+tests, funds/security). **PASS**, tests
  re-run green (240/240, 49/49, tsc 0), no funds-math change. Report:
  `docs/audits/feat-idempotency-stable-nonce.md`. (It had merged with green CI but
  no recorded audit — this backfills the gate.)

## What shipped (ID-004)
TTL + periodic prune so `action_nonces` (which since #29 stores `response_json`
on every completed action) can't grow unbounded, and crash-orphaned in-flight
rows get reaped instead of 409-ing forever.
- `idempotencyGuard.ts` — `prune(olderThanMs)` on the `ActionNonceStore` contract
  + the guard; storeless `Map` now tracks `createdAt`. Best-effort (store error →
  returns 0, never throws). Fixed the stale "ID-004 prune" comment (the #29 LOW).
- `routes.ts` — DB `prune` (`DELETE … WHERE created_at < cutoff`), exported
  `pruneActionNonces()` + env knobs `ACTION_NONCE_TTL_MS` (24h default, **10-min
  floor**) / `ACTION_NONCE_PRUNE_INTERVAL_MS` (hourly).
- `index.ts` — hourly, `unref`'d, error-swallowed prune interval (started in
  startup, not `registerRoutes`, so tests don't get a timer).
- `db-schema.ts` + `migrations/0008_action_nonces_prune_index.sql` — index on
  `created_at` (staged, not auto-run).
- Tests: +4 prune cases (reap-aged+forget / keep-fresh / best-effort-returns-0 /
  storeless reap). Server 240→**244**, client 49 (unchanged), tsc 0, build ✓.

## Reviews
- **/security-pass → PASS** (`docs/audit/2026-06-14-action-nonces-ttl.md`). No
  funds-logic change → no `algo-auditor`. Documented the replay-window reasoning.
- **/code-review → 1 finding, fixed:** the original 60s TTL floor could let the
  prune reap a still-in-flight claim → concurrent double-apply. **Raised the floor
  to 10 min** (far above the sub-second synchronous request window; the ASCEND
  transfer is enqueued fire-and-forget). No correctness bugs otherwise.

## Not covered
- Replay protection now lasts the TTL (≥10 min); after it a forgotten nonce would
  re-execute — bounded (fresh nonce per action; claim re-credit ~0; auth expiry).
- No HTTP route-mount test (guard unit-tested) — `chore/registerRoutes-testable`.
- Migrations `0005`/`0006`/`0007`/`0008` must be applied before deploy.
