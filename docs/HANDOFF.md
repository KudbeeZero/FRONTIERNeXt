# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `main` (clean) — **no open PR** (one-open-PR invariant restored).
- **Last unit:** PR [#27](https://github.com/KudbeeZero/FRONTIERNeXt/pull/27)
  (extend the idempotency-nonce guard to build & upgrade) — **audited PASS WITH
  NOTES (independent) + merged** (`a1dc9ab`); audit at `docs/audits/pr-27-audit.md`.
- Prior: PR #26 audited PASS + merged (`9da5f5f`), audit at
  `docs/audits/feat-actions-idempotency-nonce.md`.
- **CI gates green** on the merged head (frontier-al scope = `ci.yml`): `check` 0,
  `test:server` **236/236**, `test` **45/45**.
- **Audit status:** `READY_FOR_NEXT_UNIT` (nothing awaiting audit).

## State of idempotency (what's actually enforced)
Nonce-enforced mutating actions: `claim-frontier` (#26) + `build` + `upgrade`
(#27). Key = `${action}:${playerId}[:${target}]:${nonce}`, claim-before-spend,
fail-closed (400/409/503). **Not** guarded: `mine` (cooldown), `collect` (natural),
`attack`, others. The current nonce is generated **per client call**, so it blocks
exact-request **replay**, not application-level double-submit (see ID-003).

## Follow-up roadmap (tracked; NOT started this chat)
| ID | Title | Status | Priority | Branch |
|----|-------|--------|----------|--------|
| **ID-001** | `safeUuid()` fallback — `crypto.randomUUID?.() ?? fallbackUuid()` used by claim/build/upgrade (crypto.randomUUID is undefined in non-secure/legacy contexts → action throws) | PLANNED | Low | (fold into ID-003 or a small `chore/`) |
| **ID-002** | Structured / unambiguous `target` construction (avoid `parcelId:type` delimiter ambiguity when `parcelId` is an unconstrained string) | PLANNED | Low | (fold into ID-003) |
| **ID-003** | **Stable idempotency nonce** — generate once per logical user action (click handler / mutation instance), reuse across retries; server returns the **original 200** on duplicate (not 409) for true idempotency semantics. Client (click handlers, useMutation) + server (duplicate path, response replay/persistence). | **NEXT** | **High** | `feat/idempotency-stable-nonce` |
| **ID-004** | `action_nonces` TTL + prune (unbounded growth, amplified by per-call nonce on high-frequency build/upgrade) — TTL column + periodic prune or `DELETE WHERE created_at < now()-N` | PLANNED | Medium | `chore/action-nonces-ttl` |

## NEXT chat
- **Recommended next unit:** **ID-003 → `feat/idempotency-stable-nonce`** (High).
  It makes the guard actually stop double-submits and enables safe transparent
  retries — the correct foundation before rate-limiting. Pairs naturally with
  ID-001/ID-002 (small, can be folded in) and ID-004 (fewer rows once nonces are
  per-action).
- **Sequence (owner-directed):** 1) ID-003 stable nonce → 2) ID-004 TTL/prune →
  3) `feat/rate-limit-actions` (rate-limiting comes *after* idempotency semantics
  are correct). ID-001/ID-002 are cheap and may ride along with ID-003.
- **Other queued options (one unit each):**
  - `feat/rate-limit-actions` — per-IP/per-player limiter on `/api/actions/*`
    (do AFTER ID-003).
  - `chore/registerRoutes-testable` — inject storage/chain so a real HTTP
    route-mount test of the 400/409/503 enforcement is possible (closes the
    "no route-mount test" gap from #25/#26/#27).
  - **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
    (indexer-only today). **Funds-economic → `algo-auditor` + `/security-pass`.**
  - `chore/align-vite-types` — fix the pre-existing `mockup-sandbox` root-typecheck
    failure (vite/`@types/node` mismatch; not in CI).
- **Open risks:**
  - ⚠️ Idempotency is replay-only, not double-submit-proof (per-call nonce) — ID-003.
  - ⚠️ `action_nonces` has no TTL/prune (grows unbounded, amplified) — ID-004.
  - ⚠️ `crypto.randomUUID` can be undefined in non-secure contexts — ID-001.
  - ⚠️ `target` delimiter ambiguity (fail-safe, but unhardened) — ID-002.
  - ⚠️ No rate limit on `/api/actions/*` (do after ID-003).
  - ⚠️ No full HTTP route-mount test (guard unit-tested instead).
  - ⚠️ No `release()` on the action guard (LOW; fail-closed, no lockout).
  - ⚠️ mine/collect/attack still have no idempotency nonce (cooldown/accrual only).
  - ⚠️ `verifyAlgoPayment` finality is indexer-only.
  - ⚠️ Migrations `0005_redeemed_payments.sql` + `0006_action_nonces.sql` must be
    applied before deploying the guards.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
