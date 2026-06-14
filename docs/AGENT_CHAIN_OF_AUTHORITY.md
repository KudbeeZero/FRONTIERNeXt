# GrowPod Empire — Agent Chain of Authority

> **Directive:** AUTO-001 · **Status:** `PLANNED` · **Scope:** architecture only.
> Companion to [`AUTOMATION_FACTORY_ARCHITECTURE.md`](./AUTOMATION_FACTORY_ARCHITECTURE.md).
>
> This describes a **proposed** command structure for Claude sub-agents operating
> the Automation Factory. It is a design, not a running system — **untested /
> not implemented.** It must not weaken the Session Relay Protocol or any
> mainnet gate.

## 1. Hierarchy

```
CEO                         human · strategy, approvals, irreversible decisions
  │
A00 Executive Coordinator   per-chat orchestrator (Factory 1)
  │
AU-A00 Automation Director   owns the factory floor: schedules, budgets, routing
  │
Kestra Factory              execution engine (flows, schedules, retries)
  │
Automation Workers          Kestra flows + tasks (the "shift workers")
  │
Specialized AI Agents       Claude sub-agents (≤10 active per chat)
```

- **CEO** — sets strategy and is the *only* approver for irreversible actions
  (production deploy, mainnet, real spend, destructive ops).
- **A00 Executive Coordinator** — the chat-level orchestrator. In Session Relay
  terms, A00 *is* the current chat: it reads the baton, runs the audit gate,
  allocates the agent budget, drives exactly one unit of work, and runs closeout.
- **AU-A00 Automation Director** — owns the Kestra factory floor across chats:
  schedules, the agent budget policy, namespace routing, and the overnight queue.
  Decides *how/when* work runs; A00 decides *what* this chat's unit is.
- **Workers / Agents** — execute. Agents decide within their lane; Kestra workers
  run the deterministic steps.

## 2. The 10-agent active budget

At most **10 agents are active per chat**. Everything else is an **archived
template** (defined but dormant). Default allocation:

| # | Slot | Factory | Notes |
|---|------|---------|-------|
| 1 | Executive Coordinator (A00) | F1 Executive | orchestrates the chat/unit |
| 2 | Engineering Agent | F3 Engineering | primary implementer |
| 3 | Engineering Agent | F3 Engineering | secondary implementer / pairing |
| 4 | Research Agent | F2 Research | context, releases, risk |
| 5 | QA Agent | F4 QA & Audit | audit, tests, security pass |
| 6 | Documentation Agent | F3/F1 | handoff docs, baton, registry |
| 7 | Analytics Agent | F6 Analytics | metrics, economy sims |
| 8 | Operations Agent | F5 Operations | health, incidents, alerts |
| 9 | Floating Specialist | any | surge capacity / niche skill |
| 10 | Floating Specialist | any | surge capacity / niche skill |

**Total: 10 active.** Floating Specialists are drawn from the archived template
pool as the unit demands (e.g. a blockchain specialist for a chain change, a
performance specialist for an optimization unit).

### Archived template pool

The original "Recommended Kestra Agents" roster maps to the template pool —
instantiated into an active slot only when a unit needs them:

| Template | Maps to factory | Typical active slot |
|---|---|---|
| WF-A01 Workflow Manager | F1 Executive / AU-A00 | Director-level (not a chat slot) |
| WF-A02 Scheduler Manager | F7 Night Shift | Director-level |
| WF-A03 Monitoring Manager | F5 Operations | Operations Agent |
| WF-A04 Alert Manager | F5 Operations | Operations Agent (shared) |
| WF-A05 Data Sync Manager | F6 Analytics | Floating Specialist |
| WF-A06 Documentation Manager | F3/F1 | Documentation Agent |
| WF-A07 Simulation Manager | F6 Analytics | Analytics Agent |
| WF-A08 Playtest Manager | F4 QA & Audit | Floating Specialist |
| WF-A09 Research Manager | F2 Research | Research Agent |
| WF-A10 Deployment Manager | F5 Operations / F3 | Floating Specialist (gated) |

## 3. Authority matrix

Who may decide / approve what. **Fail-closed:** if a tier is unsure it escalates
up, never down.

| Action | Agents | A00 (Exec Coord) | AU-A00 (Director) | CEO |
|---|---|---|---|---|
| Draft code / docs / reports | ✅ | ✅ | ✅ | ✅ |
| Recommend a change | ✅ | ✅ | ✅ | ✅ |
| Open a branch / draft PR | ↑ propose | ✅ | ✅ | ✅ |
| Merge a PR to `main` | ❌ | ✅ *after* F4 audit PASS | ✅ | ✅ |
| Schedule/run a Kestra flow (testnet) | ↑ propose | ↑ propose | ✅ | ✅ |
| Deploy to **staging** | ❌ | ↑ propose | ✅ | ✅ |
| Deploy to **production** | ❌ | ❌ | ❌ | ✅ **only** |
| Point anything at **mainnet** | ❌ | ❌ | ❌ | ✅ + double-gate |
| Move funds / ASA / transfer to mainnet | ❌ | ❌ | ❌ | ✅ + `/mainnet-gate` **and** `algo-auditor` |

Legend: ✅ may do · ↑ propose may propose/prepare, needs approval above · ❌ not
permitted.

**Hard gates (unchanged from existing process):**

- Nothing lands on `main` **unreviewed** — F4 (QA & Audit) must PASS first.
- **Production = CEO approval only.**
- **Mainnet = `/mainnet-gate` PASS *and* `algo-auditor` pass** for any
  funds/ASA/transfer change. No autonomous agent or overnight flow may cross this
  line.
- **Testnet only** for every `ops/kestra/` flow.

## 4. Escalation chain (severity-aligned)

Escalation reuses the **existing** SEV tiers and the single `severity-router`
dispatcher in `ops/kestra/` — no parallel scheme.

| Tier | Trigger (examples) | Routed to | Agent action |
|---|---|---|---|
| **SEV3** | latency degraded; report stale; source blocked | `#ops-sev3` digest | Operations Agent notes it; batch into morning report |
| **SEV2** | veritas FAIL; `/health` down ~2 min; audit FAIL; invariant breach (2nd open PR) | `#first-responders` + role ping | Operations/QA Agent triages; A00 halts new work if invariant breach |
| **SEV1** | veritas **DRIFT** (DB ≠ chain); `/health` down ≥5 min; harness blind | `#ops-sev1` + `@here` | immediate; A00 → CEO; (later) GitHub issue → Claude auto-triage |

Decision rule: **money-path danger or sustained outage = SEV1**; player-impacting
breakage = SEV2; degraded-but-fine = SEV3.

## 5. Mapping onto the Session Relay Protocol

The chain of authority is layered *onto* the existing chat loop — it does not
replace it:

- **A00 ≈ the chat.** One chat = one A00 session = **one unit of work = one PR**.
- A00 starts with `/handoff-audit` (F4 QA & Audit does the independent review),
  gates the previous PR, then allocates the 10-agent budget for this chat's unit.
- Agents work **within a single chat's budget**; they do not spawn unbounded
  parallel work. The "10 active" ceiling is per chat.
- A00 ends with `/closeout`: commit, green tests, **exactly one** PR into `main`
  with an Audit checklist, and a rewritten baton (`AWAITING_AUDIT`).
- **One open PR at a time** remains the top invariant. AU-A00's overnight queue
  (Night Shift, F7) must still funnel through this — overnight work produces
  reviewable PRs/reports, never unreviewed merges to `main`.

## 6. See also

- [`AUTOMATION_FACTORY_ARCHITECTURE.md`](./AUTOMATION_FACTORY_ARCHITECTURE.md)
- [`KESTRA_EXPANSION_PLAN.md`](./KESTRA_EXPANSION_PLAN.md)
- [`FACTORY_REGISTRY.md`](./FACTORY_REGISTRY.md)
- [`SESSION_PROTOCOL.md`](./SESSION_PROTOCOL.md) ·
  [`MAINNET_READINESS_FLOW.md`](./MAINNET_READINESS_FLOW.md)
