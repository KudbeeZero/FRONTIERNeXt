# 2026-06-14 — Stable idempotency nonce (ID-003 + ID-001 + ID-002)

**Branch:** `feat/idempotency-stable-nonce`
**Head commit:** (final baton commit on this branch)
**PR:** #29 → `main` — _AWAITING_AUDIT_ (CI: "Typecheck & server tests" expected green)
(Note: PR #28 was a concurrent session's AUTO-001 docs PR, since merged; this unit is #29.)
**Prereqs done this session:** PR #26 audited PASS + merged (`9da5f5f`); PR #27
audited PASS WITH NOTES + merged (`a1dc9ab`, `docs/audits/pr-27-audit.md`).

## What shipped (test-backed)
Turned the action idempotency guard into a **two-phase** (claim → record/release →
replay) control so a duplicate of a *completed* action returns the **original 200**
instead of 409, an *in-flight* duplicate gets 409 (retry), and a *failed* action
releases its nonce so a retry can proceed. Folded in ID-001 (`safeUuid`) and
ID-002 (escaped target).
- **`server/idempotencyGuard.ts`** — new `ActionNonceStore` contract
  (`claim → {inserted|response}`, `complete`, `remove`) + `guard.claim/record/release`;
  storeless `Map` fallback mirrors it; fail-closed.
- **`server/db-schema.ts` + `migrations/0007_action_nonce_response.sql`** —
  `response_json` + `completed_at` columns (staged, not auto-run).
- **`server/routes.ts`** — DB store impl (INSERT…ON CONFLICT → SELECT response;
  UPDATE; DELETE), `in_progress→409` mapping, shared `guardClaimOrRespond()`;
  `claim-frontier`/`build`/`upgrade` refactored to claim → (replay 200) → run →
  record/release. Build/upgrade target = `encodeURIComponent(parcelId):type` (ID-002).
- **client** — `lib/safeUuid.ts` (ID-001, never throws); `useBuild`/`useUpgrade`
  reuse a caller-passed `idempotencyKey`; `GameLayout` handlers generate ONE nonce
  per logical action and pass it in `.mutate()` (stable across React-Query retries).

## Tests run (exact)
- `pnpm install --frozen-lockfile` → OK (no new deps)
- `pnpm --filter @workspace/frontier-al run check` → **tsc 0**
- `pnpm --filter @workspace/frontier-al run test:server` → **240/240 (30 files)** (was 236, +4: guard spec rewritten to 23 cases)
- `pnpm --filter @workspace/frontier-al run test` → **49/49 (8 files)** (was 45, +4 safeUuid)

Root `pnpm run typecheck` still fails only in the pre-existing `mockup-sandbox` (not in CI).

## Security
`/security-pass` → **PASS**, report at
`artifacts/frontier-al/docs/audit/2026-06-14-idempotency-stable-nonce.md`. No new
vuln; replay is keyed by auth-verified playerId (no cross-player leak); claim-frontier
replay does not re-credit/re-enqueue. No funds-logic change → no `algo-auditor`.

## Known risks / not covered
- **Crash window (LOW):** crash between mutation and `record` leaves an in-flight
  row → that exact nonce gets 409 until ID-004 prunes it; new actions use new
  nonces (no lockout).
- **No HTTP route-mount test** — guard unit-tested with the exact route scopes;
  wiring verified by reading (needs `chore/registerRoutes-testable`).
- **Client retry-stability is by construction** (nonce in mutate() variables) +
  `safeUuid` unit tests; no full hook-render test (no harness deps).
- **No rate limit on `/api/actions/*`** — next unit.
- **`action_nonces` no TTL/prune** (ID-004) — now also accumulates `response_json`.
- Migrations `0005`/`0006`/`0007` must be applied before deploy.
- `LandSheet.tsx` `/api/sub-parcels/:id/build` is a different endpoint, still unguarded.

## Next unit (proposed)
`chore/action-nonces-ttl` (ID-004) — TTL + prune for `action_nonces` (now stores
responses; pairs with this unit). Then `feat/rate-limit-actions`. Optionally
`chore/registerRoutes-testable` to close the HTTP-mount gap.

## Off-limits (unchanged)
Do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` to mainnet; no
funds/ASA/transfer to mainnet without `/mainnet-gate` + `algo-auditor`.
