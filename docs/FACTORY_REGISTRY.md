# GrowPod Empire — Factory Registry

> The registry of automation **directives**, **factories**, and **agents**.
> This is the index for the Automation Factory architecture. It tracks *intent
> and status* — it does not run anything.

## Directives

| ID | Title | Status | Scope | Docs |
|----|-------|--------|-------|------|
| **AUTO-001** | GrowPod Empire Automation Factory Architecture | **PLANNED** | Architecture only. No implementation. | [Architecture](./AUTOMATION_FACTORY_ARCHITECTURE.md) · [Authority](./AGENT_CHAIN_OF_AUTHORITY.md) · [Expansion](./KESTRA_EXPANSION_PLAN.md) |

### AUTO-001 — detail

- **Title:** GrowPod Empire Automation Factory Architecture
- **Status:** `PLANNED`
- **Scope:** Architecture only. **No implementation.** No code, no Kestra flows,
  no changes under `ops/kestra/`, no new namespaces created.
- **Owner:** A00 Executive Coordinator (CEO-directed).
- **Delivered by:** branch `claude/kestra-automation-factory-06fr1h` — the four
  docs in this directory.
- **Preserves:** the existing testnet-only `frontier.ops` first-responder system
  is untouched.
- **Gating context:** opened after PR #26 (idempotency-nonce guard) **merged**
  to `main`. One open PR at a time; nothing lands on `main` unreviewed.

## Factory registry

`namespace` and the new flows are **proposals** (see the Expansion Plan). Only
the `frontier.ops` rows have live artifacts today.

| ID | Factory | Proposed namespace | Owning agent | Status | Live artifacts |
|----|---------|--------------------|--------------|--------|----------------|
| F1 | Executive Coordination | `executive.ops` | A00 Executive Coordinator | PLANNED | — |
| F2 | Research | `research.ops` | Research Agent | PLANNED | — |
| F3 | Engineering | `engineering.ops` | Engineering Agents (×2) + Documentation Agent | PLANNED | — |
| F4 | QA & Audit | `qa.ops` | QA Agent (+ `algo-auditor` gate) | **PARTIALLY ACTIVE** | `ops/kestra/veritas-grind.yml` |
| F5 | Operations | `frontier.ops` (division) | Operations Agent | **ACTIVE** | `uptime.yml`, `deep-health.yml`, `severity-router.yml` |
| F6 | Analytics | `analytics.ops` | Analytics Agent | PLANNED | — |
| F7 | Night Shift | `nightshift.ops` | AU-A00 Director (+ Floating Specialists) | PLANNED | — |

Status legend: **ACTIVE** = flows running today · **PARTIALLY ACTIVE** = one live
flow, more planned · **PLANNED** = design only.

## Agent roster registry

Active budget is **10 per chat** (see [Authority](./AGENT_CHAIN_OF_AUTHORITY.md)).
Everything else is an archived template, instantiated only when a unit needs it.

### Active slots (10)

| # | Slot | Factory |
|---|------|---------|
| 1 | Executive Coordinator (A00) | F1 |
| 2 | Engineering Agent | F3 |
| 3 | Engineering Agent | F3 |
| 4 | Research Agent | F2 |
| 5 | QA Agent | F4 |
| 6 | Documentation Agent | F3 / F1 |
| 7 | Analytics Agent | F6 |
| 8 | Operations Agent | F5 |
| 9 | Floating Specialist | any |
| 10 | Floating Specialist | any |

### Archived templates (instantiate on demand)

| Template | Maps to |
|----------|---------|
| WF-A01 Workflow Manager | F1 / AU-A00 Director |
| WF-A02 Scheduler Manager | F7 Night Shift / Director |
| WF-A03 Monitoring Manager | F5 Operations |
| WF-A04 Alert Manager | F5 Operations |
| WF-A05 Data Sync Manager | F6 Analytics |
| WF-A06 Documentation Manager | F3 / F1 |
| WF-A07 Simulation Manager | F6 Analytics |
| WF-A08 Playtest Manager | F4 QA & Audit |
| WF-A09 Research Manager | F2 Research |
| WF-A10 Deployment Manager | F5 / F3 (gated) |

## Status conventions

- A directive moves `PLANNED → IN PROGRESS → DONE` as its units ship; each unit
  is its own audited PR (Session Relay Protocol).
- A factory moves `PLANNED → PARTIALLY ACTIVE → ACTIVE` as its flows land.
- This registry is updated by the Documentation Agent during `/closeout`; it must
  agree with GitHub (open PRs) and the baton (`docs/HANDOFF.md`). When they
  disagree, GitHub is the source of truth for PR state.

## See also

- [`AUTOMATION_FACTORY_ARCHITECTURE.md`](./AUTOMATION_FACTORY_ARCHITECTURE.md) —
  the seven factories in full.
- [`AGENT_CHAIN_OF_AUTHORITY.md`](./AGENT_CHAIN_OF_AUTHORITY.md) — hierarchy +
  authority matrix.
- [`KESTRA_EXPANSION_PLAN.md`](./KESTRA_EXPANSION_PLAN.md) — namespace tree +
  phased migration.
- [`../ops/kestra/README.md`](../ops/kestra/README.md) — the live first-responder
  system.
- [`SESSION_PROTOCOL.md`](./SESSION_PROTOCOL.md) ·
  [`MAINNET_READINESS_FLOW.md`](./MAINNET_READINESS_FLOW.md) — the governing
  process this overlay defers to.
