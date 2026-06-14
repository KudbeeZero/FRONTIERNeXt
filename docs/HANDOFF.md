# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `claude/kestra-automation-factory-06fr1h`
- **PR:** _(this chat's PR — GrowPod Empire Automation Factory architecture,
  directive AUTO-001)_
- **Audit status:** `AWAITING_AUDIT`
- **Prev PRs (both merged + audited PASS):**
  - PR [#27](https://github.com/KudbeeZero/FRONTIERNeXt/pull/27) (extend
    idempotency guard to build & upgrade) — merged into `main`; audited PASS by
    its own chat (`docs/audits/pr-27-audit.md`) **and independently re-audited
    PASS this chat** (`docs/audits/claude-actions-idempotency-extend-2qpwrn.md`,
    tests re-run green: `check` 0, `test:server` 236/236, `test` 45/45).
  - PR #26 merged @ `9da5f5f` (audit `docs/audits/feat-actions-idempotency-nonce.md`).

## What this chat did (for the auditor)
Two things — a start-of-chat audit gate, then **architecture-only** work:
1. **Audited the open PR #27** independently (`/handoff-audit`) before starting:
   refuted each claim against the diff, re-ran the full suite → **PASS** (report
   in `docs/audits/`). #27 merged while the audit ran; the audit confirms the
   merge was sound.
2. **Directive AUTO-001** (`PLANNED`) — the blueprint for a reusable,
   multi-project **GrowPod Empire Automation Factory** (Kestra = execution
   engine, Claude sub-agents = decisions, humans = strategy), FRONTIER-AL framed
   as one division. Four new docs under `docs/`:
   - `AUTOMATION_FACTORY_ARCHITECTURE.md` — 7 factories, each with
     mission/responsibilities/workflows/inputs/outputs/dependencies/failure
     handling/escalation chain/Kestra namespace/Claude sub-agent; maps the
     **existing** `frontier.ops` flows onto F5 Operations / F4 QA & Audit.
   - `AGENT_CHAIN_OF_AUTHORITY.md` — CEO → A00 → AU-A00 → Kestra → Workers →
     Agents; 10-agent active budget + archived templates; authority matrix;
     SEV-tier escalation; mapping onto the Session Relay Protocol.
   - `KESTRA_EXPANSION_PLAN.md` — flat `frontier.ops` → nested namespace tree;
     **non-breaking** phased migration keyed on the hardcoded subflow
     `namespace: frontier.ops` refs.
   - `FACTORY_REGISTRY.md` — AUTO-001 directive entry + factory/agent registries.

**Untouched / honest scope:** no code, no YAML flows, no `ops/kestra/` changes,
no new namespaces created, no new deps. The testnet-only `frontier.ops`
first-responder system is preserved. Docs-only → `ci.yml` (frontier-al scope) is
not triggered; AUTO-001 claims are design proposals, marked "untested / not
implemented" in the docs themselves.

## State of idempotency (carried from #27 — what's actually enforced)
Nonce-enforced mutating actions: `claim-frontier` (#26) + `build` + `upgrade`
(#27). Key = `${action}:${playerId}[:${target}]:${nonce}`, claim-before-spend,
fail-closed (400/409/503). **Not** guarded: `mine` (cooldown), `collect`
(natural), `attack`, others. The nonce is generated **per client call**, so it
blocks exact-request **replay**, not application-level double-submit (see ID-003).

## Idempotency follow-up roadmap (carried from #27; NOT started)
| ID | Title | Status | Priority | Branch |
|----|-------|--------|----------|--------|
| **ID-001** | `safeUuid()` fallback (`crypto.randomUUID` undefined in non-secure/legacy contexts) | PLANNED | Low | fold into ID-003 / small `chore/` |
| **ID-002** | Unambiguous `target` construction (avoid `parcelId:type` delimiter ambiguity) | PLANNED | Low | fold into ID-003 |
| **ID-003** | **Stable idempotency nonce** — one per logical action, reuse across retries; server replays original 200 on duplicate | **NEXT** | **High** | `feat/idempotency-stable-nonce` |
| **ID-004** | `action_nonces` TTL + prune (unbounded growth) | PLANNED | Medium | `chore/action-nonces-ttl` |

## NEXT chat
- **First:** `/handoff-audit` **this** AUTO-001 PR (docs-only; verify scope =
  4 docs + 1 audit report + baton, no code, `ops/kestra/` untouched).
- **Two viable tracks (pick one unit):**
  - **Idempotency (owner-directed sequence):** ID-003 `feat/idempotency-stable-nonce`
    (High) → ID-004 TTL/prune → `feat/rate-limit-actions` (rate-limit *after*
    idempotency semantics are correct). ID-001/ID-002 are cheap, can ride along.
  - **Kestra factory build-out (AUTO-001 Phase 1):** `chore/kestra-namespace-prep`
    — nested dirs + **copy** `severity-router.yml` into `common.ops/` (leave the
    `frontier.ops` copy active → zero downtime; no caller changes), then
    `chore/kestra-repoint-dispatcher` (Phase 2).
- **Other queued options:** `chore/registerRoutes-testable` (real HTTP route-mount
  test of 400/409/503 — closes the #25/#26/#27 wiring-untested gap); port PR #10's
  algod-first finality into `verifyAlgoPayment` (**funds-economic → `algo-auditor`
  + `/security-pass`**); `chore/align-vite-types` (pre-existing `mockup-sandbox`).
- **Open risks:**
  - ⚠️ AUTO-001 is **design only** — none of F1–F3/F6/F7 implemented; not validated.
  - ⚠️ Idempotency is replay-only, not double-submit-proof (per-call nonce) — ID-003.
  - ⚠️ `action_nonces` has no TTL/prune (unbounded) — ID-004.
  - ⚠️ `crypto.randomUUID` can be undefined in non-secure contexts — ID-001.
  - ⚠️ `target` delimiter ambiguity (fail-safe, unhardened) — ID-002.
  - ⚠️ No rate limit on `/api/actions/*` (do after ID-003); no full HTTP
    route-mount test; no `release()` on the action guard (LOW, fail-closed).
  - ⚠️ `verifyAlgoPayment` finality is indexer-only.
  - ⚠️ Migrations `0005_redeemed_payments.sql` + `0006_action_nonces.sql` must be
    applied before deploying the guards (now covers build/upgrade too).
  - ⚠️ Kestra namespace migration must update hardcoded subflow `namespace:` refs
    in `uptime.yml`/`deep-health.yml`/`veritas-grind.yml` in lockstep.
- **Off-limits:** do not merge `wip/atomic-purchase`; **nothing in `ops/kestra/`
  may point at mainnet**; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
  AUTO-001 changes **no** game behavior.
