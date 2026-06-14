# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `feat/idempotency-stable-nonce`
- **PR:** [#29](https://github.com/KudbeeZero/FRONTIERNeXt/pull/29) (stable
  idempotency nonce — two-phase claim/record/release + 200 replay; ID-003+001+002)
- **Audit status:** `AWAITING_AUDIT`
- **Prior merges:** PR #28 (AUTO-001 GrowPod automation-factory **architecture
  docs**, concurrent session) merged, audit `docs/audits/pr-28-audit.md`; PR #27
  (idempotency build/upgrade) merged @ `a1dc9ab` (`docs/audits/pr-27-audit.md`);
  PR #26 merged @ `9da5f5f` (`docs/audits/feat-actions-idempotency-nonce.md`).
- **CI gates green** (frontier-al scope = `ci.yml`): `check` 0,
  `test:server` **240/240** (was 236, +4), `test` **49/49** (was 45, +4).

## What this chat did (for the auditor)
Made the action idempotency guard **two-phase** so idempotency is real, not just
replay-blocking (closes ID-003). Folded in ID-001 (safeUuid) + ID-002 (escaped target).
- `server/idempotencyGuard.ts`: new `ActionNonceStore` (`claim → {inserted|response}`,
  `complete`, `remove`) + `guard.claim/record/release`; storeless `Map` fallback;
  fail-closed. `claim` returns `{ok,replay:false}` (fresh) / `{ok,replay:true,response}`
  (duplicate of completed → 200 replay) / `{ok:false, reason:"invalid_nonce"|"in_progress"|"store_unavailable"}`.
- `server/db-schema.ts` + `migrations/0007_action_nonce_response.sql`:
  `response_json` + `completed_at` columns (staged, not auto-run).
- `server/routes.ts`: DB store impl (INSERT…ON CONFLICT → SELECT response; UPDATE;
  DELETE), `in_progress→409`, shared `guardClaimOrRespond()`; `claim-frontier`/
  `build`/`upgrade` refactored to claim → (replay 200) → run mutation → `record`
  (success) / `release` (failure). claim-frontier's no-credit paths (404,
  wallet_not_opted_in) release the nonce. Build/upgrade target =
  `encodeURIComponent(parcelId):type` (ID-002).
- client: `lib/safeUuid.ts` (ID-001, never throws in non-secure ctx);
  `useBuild`/`useUpgrade` reuse a caller-passed `idempotencyKey`; `GameLayout`
  handlers generate ONE nonce per logical action, passed in `.mutate()` (stable
  across React-Query retries). No other UI change.
- Tests: `idempotencyGuard.spec.ts` rewritten (23 cases: fresh/replay/in_progress/
  release, fail-closed, best-effort record/release, target scoping, safe enums);
  `client/tests/safeUuid.spec.ts` (+4). server 236→240, client 45→49, tsc 0.
- Ran **/security-pass** → PASS; report at
  `artifacts/frontier-al/docs/audit/2026-06-14-idempotency-stable-nonce.md`.
  Replay is keyed by auth-verified playerId (no cross-player leak); claim-frontier
  replay does not re-credit/re-enqueue. No funds-logic change → no `algo-auditor`.

## Audit checklist (for the next /handoff-audit)
| Claim | How to verify |
|---|---|
| Two-phase contract | `idempotencyGuard.ts` claim/record/release + storeless Map; spec cases 1-4 |
| Completed duplicate → 200 replay | `guardClaimOrRespond` returns `res.json(JSON.parse(response))`; spec "replays original response" |
| In-flight → 409, missing → 400, store err → 503 | `idempotencyRejection`; spec in_progress/invalid_nonce/store_unavailable |
| Failed mutation releases nonce | route inner `catch → release`; spec "release → re-claim fresh" |
| No re-credit on claim replay | `record` only on success; no-credit paths call `release` |
| ID-002 escaped target / ID-001 safeUuid | `encodeURIComponent(parcelId):type`; `safeUuid.spec.ts` |
| Tests real, no deps | server 236→240, client 45→49, tsc 0; `--frozen-lockfile` clean |
| No over-claim | only claim-frontier/build/upgrade enforced; mine/collect/attack + sub-parcel build still unguarded |

## NEXT chat
- **Recommended next unit:** **ID-004 → `chore/action-nonces-ttl`** (Medium) — TTL +
  prune for `action_nonces` (now also stores `response_json`, so growth matters
  more). Then `feat/rate-limit-actions` (rate-limiting after idempotency is correct).
- **Deferred track (AUTO-001 build-out, MEDIUM):** `chore/kestra-namespace-prep`
  (nested dirs + **copy** `severity-router.yml` to `common.ops/`, zero-downtime, no
  caller change) → `chore/kestra-repoint-dispatcher`. Each its own audited unit; per
  `docs/KESTRA_EXPANSION_PLAN.md`.
- **Other queued options (one unit each):**
  - `chore/registerRoutes-testable` — inject storage/chain so a real HTTP route-mount
    test of the 400/409/503/200-replay enforcement is possible (closes the gap from #25–#29).
  - `feat/rate-limit-actions` — per-IP/per-player limiter on `/api/actions/*`.
  - Extend the guard to `/api/sub-parcels/:id/build` (`LandSheet.tsx`, currently unguarded).
  - **Port PR #10's algod-first finality check** into `verifyAlgoPayment` (indexer-only).
    **Funds-economic → `algo-auditor` + `/security-pass`.**
  - `chore/align-vite-types` — pre-existing `mockup-sandbox` root-typecheck failure.
- **Open risks:**
  - ⚠️ `action_nonces` no TTL/prune (now stores responses too) — ID-004.
  - ⚠️ Crash between mutation and `record` → that nonce 409s until pruned (no lockout; new actions use new nonces).
  - ⚠️ No HTTP route-mount test (guard unit-tested instead).
  - ⚠️ Client retry-stability is by-construction + safeUuid unit tests (no hook-render test).
  - ⚠️ No rate limit on `/api/actions/*`.
  - ⚠️ mine/collect/attack + `/api/sub-parcels/:id/build` still have no idempotency nonce.
  - ⚠️ `verifyAlgoPayment` finality is indexer-only.
  - ⚠️ Migrations `0005`/`0006`/`0007` must be applied before deploy.
  - ⚠️ AUTO-001 is **design only** — no factory beyond `frontier.ops` is implemented.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
