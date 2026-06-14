# GrowPod Empire — Automation Factory Architecture

> **Directive:** AUTO-001 · **Status:** `PLANNED` · **Scope:** architecture only,
> no implementation. See [`FACTORY_REGISTRY.md`](./FACTORY_REGISTRY.md).
>
> This is a **blueprint**, not running code. None of the seven factories below
> exist yet except where it explicitly maps to the **already-shipped**
> `frontier.ops` flows in [`ops/kestra/`](../ops/kestra/README.md). Every claim
> here is a design proposal — **untested / not implemented** unless it points at
> an existing artifact.

## 1. Mission

Build a **reusable, multi-project automation factory** where:

- **Humans set strategy.** The CEO decides *what* the empire does and approves
  anything irreversible (production deploys, mainnet, spend).
- **Claude sub-agents make decisions.** Agents triage, plan, draft, audit, and
  recommend — within a bounded budget and a chain of authority.
- **Kestra executes.** Kestra is the factory floor: scheduling, workflow
  execution, background jobs, retries, monitoring, and coordination of
  long-running work.

The factory must be **generic across projects** — FRONTIER-AL is the first
tenant, not the only one.

## 2. Company / system model

**GrowPod Empire** is the parent "AI Operating System." Products are *divisions*
that plug into the same factory.

```
CEO (human · strategy + approvals)
  │
GrowPod Empire  ───────────────  Parent AI OS
  │
  ├─ Division: FRONTIER-AL        ← first/only division today (Algorand game)
  ├─ Division: <future product>
  └─ Division: <future product>
        │
   ┌────┴───────────────────────────────────────────────────┐
   │  Automation Factories (function-oriented, cross-division)│
   │  F1 Executive · F2 Research · F3 Engineering · F4 QA/Audit│
   │  F5 Operations · F6 Analytics · F7 Night Shift            │
   └────┬───────────────────────────────────────────────────┘
        │
   Automation Workers (Kestra flows + tasks)
        │
   Specialized AI Agents (Claude sub-agents, ≤10 active per chat)
```

A **division** owns a product and its data/secrets (e.g. `frontier.ops`). A
**factory** is a *function* (research, QA, …) that can serve any division. The
existing `frontier.ops` flows are a division-scoped slice of the **Operations**
and **QA & Audit** factories.

## 3. Where this sits relative to existing process

This factory model is an **overlay**, not a replacement. It does **not** change
game behavior and does **not** loosen any existing gate:

- The **Session Relay Protocol** ([`SESSION_PROTOCOL.md`](./SESSION_PROTOCOL.md))
  still governs the chat loop: one chat = one reviewed PR, audited handoff.
- The **Mainnet Readiness Flow** ([`MAINNET_READINESS_FLOW.md`](./MAINNET_READINESS_FLOW.md))
  still gates the road to mainnet (`/mainnet-gate` **and** `algo-auditor`).
- The **app HARD RULES** (`artifacts/frontier-al/CLAUDE.md`) still win on app
  matters (pricing, finality, atomic delivery).

When the factory model and an existing gate conflict, **the existing gate wins.**

## 4. The seven factories

Each factory below uses the same field set: **mission · responsibilities ·
workflows · inputs · outputs · dependencies · failure handling · escalation
chain · Kestra namespace · Claude sub-agent**. Namespaces and agents are
*proposals*; see [`KESTRA_EXPANSION_PLAN.md`](./KESTRA_EXPANSION_PLAN.md) and
[`AGENT_CHAIN_OF_AUTHORITY.md`](./AGENT_CHAIN_OF_AUTHORITY.md).

The escalation chains reuse the **SEV1/SEV2/SEV3** tiers and the single
`severity-router` dispatcher that already exist in `ops/kestra/` — no new
severity model is introduced.

---

### Factory 1 — Executive Coordination

- **Mission:** Run the empire's chat loop and keep the baton honest — session
  orchestration, PR tracking, registry updates, handoff management, agent
  allocation.
- **Responsibilities:** allocate the ≤10-agent budget per chat; track the single
  open PR; update [`FACTORY_REGISTRY.md`](./FACTORY_REGISTRY.md) and the baton
  (`docs/HANDOFF.md`); enforce "one chat = one unit"; route work to factories.
- **Workflows (proposed):** `session-open` (read baton + audit gate),
  `pr-tracker` (poll the one open PR's CI/state), `registry-sync` (reconcile
  registry vs. open PRs), `agent-allocator` (assign roster slots per directive).
- **Inputs:** baton (`docs/HANDOFF.md`), open PRs, audit reports
  (`docs/audits/`), the directive registry.
- **Outputs:** updated baton, registry entries, agent-allocation manifests,
  morning executive summary (with Night Shift, F7).
- **Dependencies:** GitHub (PRs/CI), the repo, the QA & Audit factory (F4) for
  gate verdicts.
- **Failure handling:** if the single-open-PR invariant is violated, **halt new
  work** and raise SEV2; if the baton is stale/contradicts GitHub, flag and
  reconcile before allocating work.
- **Escalation chain:** invariant breach → SEV2 → CEO. Ambiguous merge/scope →
  ask the CEO (never auto-merge unreviewed).
- **Kestra namespace:** `executive.ops`.
- **Claude sub-agent:** **A00 Executive Coordinator** (the per-chat orchestrator;
  see chain of authority).

### Factory 2 — Research

- **Mission:** Keep the empire informed — market, blockchain, competitor, AI
  tooling, and documentation research.
- **Responsibilities:** scheduled and on-demand research; produce reports,
  recommendations, and risk assessments; monitor Claude/Algorand/dependency
  releases.
- **Workflows (proposed):** `daily-scan`, `weekly-digest`, `on-demand-research`,
  `release-watch` (model/SDK/dep updates).
- **Inputs:** research prompts/topics, web sources, changelogs, the existing
  `deep-research` skill.
- **Outputs:** dated research reports, recommendations, risk assessments (stored
  as docs/artifacts; **never** auto-applied to code).
- **Dependencies:** outbound web access (subject to the environment network
  policy), the `deep-research` skill.
- **Failure handling:** a failed/blocked source degrades the report to "partial,"
  it does not fail the unit; network-blocked → SEV3 digest note.
- **Escalation chain:** material risk finding (security/economic) → SEV2 →
  Executive (F1) → CEO.
- **Kestra namespace:** `research.ops`.
- **Claude sub-agent:** **Research Agent** (1 active slot).

### Factory 3 — Engineering

- **Mission:** Turn approved units of work into reviewed PRs — frontend,
  backend, blockchain, testing, and deployment *preparation* workflows.
- **Responsibilities:** branch creation, builds, lint/typecheck, test runs, PR
  drafting, handoff documents. **Deployment is prepared here but executed under
  Operations (F5) with approvals.**
- **Workflows (proposed):** `branch-bootstrap`, `build-and-check`
  (tsc + vitest, mirroring `ci.yml`), `pr-draft`, `deploy-prep` (artifacts,
  migrations, feature-flag inventory — *no* prod deploy without CEO approval).
- **Inputs:** the chat's single unit of work, the repo, CI config.
- **Outputs:** branches, build artifacts, test results, draft PRs, handoff notes.
- **Dependencies:** CI (`.github/workflows/ci.yml`), pnpm workspace, the
  Session Relay Protocol (one unit per chat).
- **Failure handling:** red build/tests block the PR (fail-closed); never claim
  "validated" without a green test backing it.
- **Escalation chain:** funds/ASA/transfer code → must route through
  `/security-pass` + `algo-auditor` (F4) before merge; mainnet → double-gate.
- **Kestra namespace:** `engineering.ops`.
- **Claude sub-agent:** **Engineering Agents** (2 active slots) + Documentation
  Agent (1) for handoff/docs.

### Factory 4 — QA & Audit

- **Mission:** Be the empire's independent check — PR audits, regression tests,
  coverage reporting, release verification, security scans.
- **Responsibilities:** run `/handoff-audit` (independent diff-vs-claims),
  `/pr-gate` (mechanical go/no-go), `/security-pass`, `/test-matrix`, and the
  `veritas-grind` verification loop; gate merges.
- **Workflows:** **existing** `veritas-grind.yml` (30 min, testnet) →
  *belongs to this factory*; plus proposed `audit-on-pr`, `regression-nightly`,
  `coverage-report`, `release-verify`.
- **Inputs:** PR diffs, claims/baton, the test suites, the live **testnet**
  backend (for veritas).
- **Outputs:** PASS/CONCERNS/FAIL verdicts, `docs/audits/<branch>.md`, coverage
  matrices, security reports (`artifacts/frontier-al/docs/audit/`), veritas JSON.
- **Dependencies:** the repo + tests, the existing veritas engine
  (`artifacts/frontier-al/server/veritas/`), `severity-router` for alerting.
- **Failure handling:** fail-closed bias — ambiguous check → CONCERNS, never a
  silent pass; any veritas **DRIFT** (DB ≠ chain) → SEV1.
- **Escalation chain:** veritas DRIFT → SEV1 (`@here`); FAIL → SEV2; audit FAIL →
  do not merge → Executive (F1) → CEO.
- **Kestra namespace:** `qa.ops` (new audit/regression flows). The existing
  `veritas-grind.yml` **stays in `frontier.ops`** until a deliberate migration
  unit (see Expansion Plan).
- **Claude sub-agent:** **QA Agent** (1 active slot); the `algo-auditor` gate is
  invoked for funds-economic changes.

### Factory 5 — Operations

- **Mission:** Keep services alive — uptime monitoring, health checks, alert
  routing, incident management, recovery.
- **Responsibilities:** poll health, route incidents by severity, manage the
  first-responder flow; (later) automated restart/recovery.
- **Workflows:** **existing** `uptime.yml` (1 min), `deep-health.yml` (5 min),
  and `severity-router.yml` (shared dispatcher subflow) → *belong to this
  factory*; proposed additions: `remediation` (Replit restart on SEV2/SEV1),
  `incident-log`.
- **Inputs:** `GET /health`, `GET /api/admin/status` (admin key), the **testnet**
  deployment URL.
- **Outputs:** Discord SEV1/2/3 alerts, recovery notes, incident records.
- **Dependencies:** Discord webhooks, admin key, KV streak counters, the target
  **testnet** deployment.
- **Failure handling:** consecutive-failure streak escalation (2→SEV2, 5→SEV1);
  harness blind → SEV1.
- **Escalation chain:** SEV1 → `#ops-sev1` + `@here` (later: GitHub issue →
  Claude auto-triage); SEV2 → `#first-responders` + role ping; SEV3 → digest.
- **Kestra namespace:** `frontier.ops` **today** (existing flows, untouched);
  cross-division ops would later use `operations.ops`. Division-scoped monitoring
  stays under the division namespace.
- **Claude sub-agent:** **Operations Agent** (1 active slot).

> ⚠️ **HARD RULE preserved:** every Operations flow targets **testnet only**.
> Nothing in `ops/kestra/` may point at mainnet.

### Factory 6 — Analytics

- **Mission:** Make the empire measurable — metrics, dashboards, economy reports,
  telemetry, trend reports.
- **Responsibilities:** aggregate metrics; produce economy/emission/inflation
  reports and balance recommendations; surface trends.
- **Workflows (proposed):** `metrics-rollup`, `economy-sim` (emission/reward
  balancing, inflation, staking projections), `dashboard-refresh`,
  `trend-report`.
- **Inputs:** game/economy data (read-only), telemetry, simulation parameters.
- **Outputs:** balance reports, simulation results, recommended adjustments,
  dashboards. **Recommendations only — economy changes ship as their own audited
  units.**
- **Dependencies:** Postgres (read replicas/exports), the economy math modules,
  the Research factory (F2) for context.
- **Failure handling:** a failed rollup degrades the dashboard to "stale," raises
  SEV3; never block gameplay.
- **Escalation chain:** economic anomaly (e.g. inflation breach) → SEV2 →
  Executive (F1) → CEO; any proposed economy change → `algo-auditor` if it
  touches funds.
- **Kestra namespace:** `analytics.ops`.
- **Claude sub-agent:** **Analytics Agent** (1 active slot).

### Factory 7 — Night Shift

- **Mission:** Let the empire work while the CEO sleeps — long-running jobs,
  batch processing, automated reports, retry queues, maintenance windows.
- **Responsibilities:** run the overnight task queue assembled by Executive (F1);
  execute agents in parallel within budget; retry failures; assemble the morning
  executive summary.
- **Workflows (proposed):** `nightly-queue` (drain the task queue),
  `batch-runner`, `retry-sweeper`, `maintenance-window`, `morning-summary`.
- **Inputs:** the task queue from A00 (F1), schedules (1 min / 15 min / hourly /
  nightly / weekly), retry policies.
- **Outputs:** completed-work log, failed-task log, risk list, PR status, a
  **morning report** with suggested next actions.
- **Dependencies:** all other factories (it orchestrates their flows overnight),
  Kestra scheduler + retries.
- **Failure handling:** automatic retry with backoff; unrecoverable failures are
  recorded (not hidden) and surfaced in the morning report; never auto-merge or
  auto-deploy to prod/mainnet overnight.
- **Escalation chain:** overnight SEV1 still pages immediately (`@here`); SEV2/3
  batch into the morning report.
- **Kestra namespace:** `nightshift.ops`.
- **Claude sub-agent:** orchestrates the roster; uses the **2 Floating
  Specialist** slots for surge work.

---

## 5. Mapping: factory model → what already exists

The factory model is conceptual until built. **Today** only the `frontier.ops`
flows exist, and they map as follows:

| Existing artifact (`ops/kestra/`) | Factory | Status |
|---|---|---|
| `severity-router.yml` (shared dispatcher) | F5 Operations (shared) | **ACTIVE** |
| `uptime.yml` (1 min health) | F5 Operations | **ACTIVE** |
| `deep-health.yml` (5 min admin status) | F5 Operations | **ACTIVE** |
| `veritas-grind.yml` (30 min verification) | F4 QA & Audit | **ACTIVE** |
| *(everything else)* | F1–F3, F6, F7 | **PLANNED** |

These flows **stay in `frontier.ops` and are not moved or modified by AUTO-001.**
Any namespace migration is a later, separately-audited unit
([`KESTRA_EXPANSION_PLAN.md`](./KESTRA_EXPANSION_PLAN.md)).

## 6. Cross-cutting guardrails (non-negotiable)

- **Testnet only** for any flow that hits a live target. Nothing in `ops/kestra/`
  may point at mainnet.
- **Production deploy requires CEO approval.** No agent and no overnight flow may
  deploy to production autonomously.
- **Mainnet requires the double-gate:** `/mainnet-gate` PASS **and** an
  `algo-auditor` pass for any funds/ASA/transfer change. No funds-moving phase
  ships without both.
- **One open PR at a time; nothing lands on `main` unreviewed.**
- **No over-claiming.** A result is "validated" only when a test backs it;
  otherwise it is "untested."

## 7. Recommended stack (from the brief)

- **Orchestrator:** Kestra (self-hosted, Docker Compose).
- **Containers:** Docker + Docker Compose.
- **Infra:** Hetzner VPS (API + workers + Kestra), Cloudflare Pages (frontend),
  Railway (early-stage deploys).
- **Storage:** PostgreSQL.
- **Notifications:** Discord webhooks (in use), Telegram bots, email alerts.

## 8. See also

- [`AGENT_CHAIN_OF_AUTHORITY.md`](./AGENT_CHAIN_OF_AUTHORITY.md) — hierarchy,
  10-agent budget, authority matrix.
- [`KESTRA_EXPANSION_PLAN.md`](./KESTRA_EXPANSION_PLAN.md) — namespace tree and
  phased, non-breaking migration.
- [`FACTORY_REGISTRY.md`](./FACTORY_REGISTRY.md) — directive AUTO-001 + factory
  and agent registries.
- [`../ops/kestra/README.md`](../ops/kestra/README.md) — the existing
  first-responder system.
