# Audit — PR #30 `chore/action-nonces-ttl` (ID-004: `action_nonces` TTL + prune)

- **Date:** 2026-06-14
- **Auditor:** independent retro-audit (start-of-chat `/handoff-audit`)
- **Verdict:** **PASS** (retro-audit — see governance note)
- **Head/merge:** `a469799` (`Merge pull request #30 …`) — **already on `origin/main`**

## Governance note (why retro-audit)
The baton (`docs/HANDOFF.md`) still showed PR #30 as `AWAITING_AUDIT`, but the PR
was **already merged** into `main` (`a469799`) and a later session had branched
past it (`feat/floating-plot-widget-clean`, commit `b26fd82` "feat: add floating
plot widget", + uncommitted changes). So the merge **gate** is moot; this is a
*retrospective* verification of the merged code against its claims, mirroring the
PR #29 retro-audit the prior chat performed. The protocol invariant "nothing
lands on `main` unreviewed" was technically bypassed for #30 (no audit was
recorded before merge); this report closes that gap. Code is sound — no harm.

Tooling caveat: `gh` is not installed on this host and the clone is **shallow**
(grafted history), so the PR diff could not be pulled via `gh pr diff` nor
reconstructed via `a469799^1`. Verification was done against the **merged working
tree** (the #30 changes are present on `main`) plus the recorded commit list.

## Claims vs. evidence (verified against merged tree)
| Claim | Evidence | Status |
|---|---|---|
| TTL floor ≥ 10 min (no in-flight reap) | `server/routes.ts:153-156` `ACTION_NONCE_TTL_MS = Math.max(600_000, env||24h)` | ✅ |
| DB prune = `DELETE WHERE created_at < cutoff` | `server/routes.ts:129-136` `db.delete(...).where(lt(createdAt, cutoff))` | ✅ |
| Best-effort (store error → 0, no throw) | `server/idempotencyGuard.ts:181-184` wraps `store.prune` | ✅ |
| Exported `pruneActionNonces()` + env knobs | `server/routes.ts:165-167`; `ACTION_NONCE_PRUNE_INTERVAL_MS` `routes.ts:157-160` | ✅ |
| Hourly prune wired in startup (not test path) | `server/index.ts:5,249` `pruneActionNonces()` | ✅ |
| Spec coverage: reap/keep/storeless/error→0 | `server/idempotencyGuard.spec.ts:49,119,171,181,192,201` | ✅ |

## Tests (re-run this chat)
- `pnpm --filter @workspace/frontier-al run check` (tsc) → **exit 0** (clean).
- `pnpm --filter @workspace/frontier-al run test:server` → **244 passed (244), 30 files**, exit 0.
  Matches the baton's claimed `test:server 244/244`.
- Client suite / `build` not re-run: PR #30 is **server-only** (idempotencyGuard,
  routes, index, db-schema, migration `0008`) — client tests are not exercised by it.

## Could not verify
- On-chain / runtime behavior of the prune interval under real Postgres + traffic
  (unit-tested via the storeless `Map` + DB-shape spec only; no live HTTP/PG run).
- Migration `0008_action_nonces_prune_index.sql` is staged, not auto-applied —
  must be applied before deploy (carried as an open risk).

## Open risks carried forward (unchanged from baton)
- Replay protection now lasts the TTL (≥10 min); a forgotten >TTL nonce would
  re-execute — bounded (fresh nonce/action; claim re-credit ~0; auth expiry).
- No rate limit on `/api/actions/*`.
- No HTTP route-mount test (guard unit-tested instead).
- Migrations `0005`/`0006`/`0007`/`0008` must be applied before deploy.
