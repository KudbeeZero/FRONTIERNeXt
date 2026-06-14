# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `chore/action-nonces-ttl`
- **PR:** _(this chat's PR — ID-004: `action_nonces` TTL + periodic prune)_
- **Audit status:** `AWAITING_AUDIT`
- **Prior merges (all audited PASS):** PR #29 (stable idempotency nonce, ID-003) —
  merged; **independently re-audited PASS this chat** (`docs/audits/feat-idempotency-stable-nonce.md`).
  PR #28 (AUTO-001 architecture docs) merged (`docs/audits/pr-28-audit.md`); #27
  merged @ `a1dc9ab`; #26 merged @ `9da5f5f`.
- **CI gates green** (frontier-al scope = `ci.yml`): `check` 0,
  `test:server` **244/244** (was 240, +4), `test` **49/49**, `build` ✓.

## What this chat did (for the auditor)
Two parts — start-of-chat audit gate, then ID-004:
1. **Audited the merged PR #29** (it had landed with green CI but no recorded
   audit) — 2 independent auditors (correctness+tests re-run, funds/security) →
   **PASS**, no funds-math change. Report in `docs/audits/`.
2. **ID-004 — `action_nonces` TTL + prune.** Since #29 the table stores
   `response_json` on every completed action, so it must be reaped.
   - `idempotencyGuard.ts`: `prune(olderThanMs)` on the store contract + guard
     (storeless `Map` gains `createdAt`); best-effort (store error → 0, no throw).
     Fixed the stale "ID-004 prune" comment (the #29 LOW finding).
   - `routes.ts`: DB `prune` (`DELETE … WHERE created_at < cutoff`), exported
     `pruneActionNonces()` + env knobs `ACTION_NONCE_TTL_MS` (24h default, **10-min
     floor**) / `ACTION_NONCE_PRUNE_INTERVAL_MS` (hourly).
   - `index.ts`: hourly, `unref`'d, error-swallowed prune interval (in startup, not
     `registerRoutes`, so tests get no timer).
   - `db-schema.ts` + `migrations/0008_action_nonces_prune_index.sql`: index on
     `created_at` (staged, not auto-run).
   - Tests +4 (server 240→244); `ENV_VARS.md` + `DEPLOYMENT_ENV_CHECKLIST.md`
     updated. **No new deps.**
   - **/security-pass → PASS** (`docs/audit/2026-06-14-action-nonces-ttl.md`); no
     funds-logic change → no `algo-auditor`.
   - **/code-review → 1 finding fixed:** 60s TTL floor could let the prune reap a
     still-in-flight claim (double-apply window) → **floor raised to 10 min**, far
     above the sub-second synchronous request window.

## Audit checklist (for the next /handoff-audit)
| Claim | How to verify |
|---|---|
| Prune reaps by age, best-effort | `idempotencyGuard.ts` `prune`; spec reap/keep/returns-0/storeless |
| DB prune = `DELETE WHERE created_at < cutoff` | `routes.ts` store `prune` + `lt(createdAt, cutoff)` |
| TTL floor ≥ 10 min (no in-flight reap) | `routes.ts` `ACTION_NONCE_TTL_MS = Math.max(600_000, …)` |
| Interval unref'd, not in test path | `index.ts` `_actionNoncePruneInterval.unref()`; index.ts not imported by specs |
| Tests real, no deps | server 240→244, tsc 0, build ✓; `--frozen-lockfile` clean |
| #29 retro-audit PASS | `docs/audits/feat-idempotency-stable-nonce.md` |
| No over-claim | only DB prune is wired; storeless prune is dev/mem; replay protection lasts the TTL |

## NEXT chat
- **Recommended next unit:** **`feat/rate-limit-actions`** — per-IP/per-player
  limiter on `/api/actions/*` (idempotency semantics are now correct, so
  rate-limiting is the right next layer; blocks mint-on-prepare / rapid
  double-click DoS).
- **Other queued options (one unit each):**
  - `chore/registerRoutes-testable` — inject storage/chain for a real HTTP
    route-mount test of the 400/409/503/200-replay enforcement (closes the
    #25–#29 wiring-untested gap).
  - Extend the guard to `/api/sub-parcels/:id/build` (`LandSheet.tsx`, unguarded).
  - **AUTO-001 build-out (MEDIUM):** `chore/kestra-namespace-prep` → 
    `chore/kestra-repoint-dispatcher` (per `docs/KESTRA_EXPANSION_PLAN.md`).
  - **Port PR #10's algod-first finality** into `verifyAlgoPayment` (indexer-only).
    **Funds-economic → `algo-auditor` + `/security-pass`.**
  - `chore/align-vite-types` — pre-existing `mockup-sandbox` root-typecheck failure.
- **Open risks:**
  - ⚠️ Replay protection now lasts the TTL (≥10 min); a forgotten >TTL nonce would
    re-execute — bounded (fresh nonce/action; claim re-credit ~0; auth expiry).
  - ⚠️ No rate limit on `/api/actions/*` — next unit.
  - ⚠️ No HTTP route-mount test (guard unit-tested instead).
  - ⚠️ mine/collect/attack + `/api/sub-parcels/:id/build` still have no idempotency nonce.
  - ⚠️ `verifyAlgoPayment` finality is indexer-only.
  - ⚠️ Migrations `0005`/`0006`/`0007`/`0008` must be applied before deploy.
  - ⚠️ AUTO-001 is **design only** — no factory beyond `frontier.ops` is implemented.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
