# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `main` (clean) — **no open PR** (one-open-PR invariant restored).
- **Last unit:** PR [#28](https://github.com/KudbeeZero/FRONTIERNeXt/pull/28)
  (AUTO-001 — GrowPod Empire Automation Factory **architecture docs**) —
  **audited PASS (independent panel) + merged**; audit at
  `docs/audits/pr-28-audit.md`. CI green on the merged head
  (`Typecheck & server tests` ✅ + `Cloudflare Pages` ✅).
- **Prior:** PR #27 (idempotency build/upgrade) merged @ `a1dc9ab`, audited PASS
  (`docs/audits/pr-27-audit.md` + `docs/audits/claude-actions-idempotency-extend-2qpwrn.md`);
  PR #26 merged @ `9da5f5f` (`docs/audits/feat-actions-idempotency-nonce.md`).
- **Audit status:** `READY_FOR_NEXT_UNIT` (nothing awaiting audit).

## What AUTO-001 delivered (architecture only — no implementation)
Blueprint for a reusable, multi-project **GrowPod Empire Automation Factory**
(Kestra = execution engine, Claude sub-agents = decisions, humans = strategy),
FRONTIER-AL framed as one division. Docs: `AUTOMATION_FACTORY_ARCHITECTURE.md`
(7 factories), `AGENT_CHAIN_OF_AUTHORITY.md` (CEO→A00→AU-A00→…, 10-agent budget,
authority matrix), `KESTRA_EXPANSION_PLAN.md` (non-breaking namespace migration),
`FACTORY_REGISTRY.md` (directive AUTO-001 = PLANNED). No code, no YAML, no
`ops/kestra/` changes, no deps. The testnet-only `frontier.ops` first-responder
system is preserved.

## State of idempotency (what's actually enforced)
Nonce-enforced mutating actions: `claim-frontier` (#26) + `build` + `upgrade`
(#27). Key = `${action}:${playerId}[:${target}]:${nonce}`, claim-before-spend,
fail-closed (400/409/503). **Not** guarded: `mine` (cooldown), `collect`
(natural), `attack`, others. The nonce is generated **per client call**, so it
blocks exact-request **replay**, not application-level double-submit → ID-003.

## NEXT chat
- **Active next unit (exactly one):** **ID-003 → `feat/idempotency-stable-nonce`**
  (Priority **HIGH**). Generate the idempotency nonce **once per logical user
  action** (click handler / mutation instance), reuse across retries; on a
  duplicate the server **replays the original 200** (true idempotency) instead of
  409. Touches client (click handlers / `useMutation`) + server (duplicate path,
  response replay/persistence). Closes the top open risk (replay-only → genuine
  double-submit defense). Cheap riders ID-001 (`safeUuid()` fallback) + ID-002
  (unambiguous `target`) may fold in. **Funds-adjacent (guards an ASCEND burn
  path) → run `/security-pass`; `algo-auditor` if transfer logic is touched.**
- **Then (sequence, owner-directed):** ID-004 `chore/action-nonces-ttl` (TTL/prune,
  MEDIUM) → `feat/rate-limit-actions` (rate-limit AFTER idempotency is correct).
- **Deferred track (AUTO-001 build-out, MEDIUM):** `chore/kestra-namespace-prep`
  (nested dirs + **copy** `severity-router.yml` to `common.ops/`, zero-downtime,
  no caller change) → `chore/kestra-repoint-dispatcher` (Phase 2). Each its own
  audited unit; per `KESTRA_EXPANSION_PLAN.md`.
- **Other queued options:** `chore/registerRoutes-testable` (real HTTP route-mount
  test of 400/409/503 — closes the #25/#26/#27/#28 wiring-untested gap); port PR
  #10's algod-first finality into `verifyAlgoPayment` (**funds-economic →
  `algo-auditor` + `/security-pass`**); `chore/align-vite-types`.
- **Open risks:**
  - ⚠️ Idempotency is replay-only, not double-submit-proof (per-call nonce) — ID-003.
  - ⚠️ `action_nonces` has no TTL/prune (unbounded) — ID-004.
  - ⚠️ `crypto.randomUUID` can be undefined in non-secure contexts — ID-001.
  - ⚠️ `target` delimiter ambiguity (fail-safe, unhardened) — ID-002.
  - ⚠️ No rate limit on `/api/actions/*` (do after ID-003).
  - ⚠️ No full HTTP route-mount test (guard unit-tested instead).
  - ⚠️ No `release()` on the action guard (LOW; fail-closed, no lockout).
  - ⚠️ mine/collect/attack still have no idempotency nonce (cooldown/accrual only).
  - ⚠️ `verifyAlgoPayment` finality is indexer-only.
  - ⚠️ Migrations `0005_redeemed_payments.sql` + `0006_action_nonces.sql` must be
    applied before deploying the guards.
  - ⚠️ AUTO-001 is **design only** — no factory beyond the existing `frontier.ops`
    flows is implemented; namespace migration must update the hardcoded subflow
    `namespace:` refs in `uptime`/`deep-health`/`veritas-grind` in lockstep.
- **Off-limits:** do not merge `wip/atomic-purchase`; **nothing in `ops/kestra/`
  may point at mainnet**; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
