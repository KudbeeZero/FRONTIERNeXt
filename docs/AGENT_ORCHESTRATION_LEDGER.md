# Agent Orchestration Ledger

> **Directive:** REC-004 · **Status:** `LIVE` · **Class:** 🔒 PROTECTED SURFACE
>
> This ledger is **authoritative** for how agents coordinate work in this repo:
> who may do what (Employee vs Sub-Agent), how work is handed off (the Mandatory
> Work Order format), and which surfaces are off-limits without an explicit claim.
> It is a **governance overlay** on top of the
> [Session Relay Protocol](./SESSION_PROTOCOL.md) and the
> [Agent Chain of Authority](./AGENT_CHAIN_OF_AUTHORITY.md) — when this ledger and
> those conflict, the Session Relay Protocol wins on the chat loop, the app
> `CLAUDE.md` wins on app behavior, and this ledger wins on **orchestration**
> (roles, handoffs, surface claims).
>
> ⚠️ **Recovery note (2026-06-15):** this file was referenced as `REC-004` in the
> baton but was **never committed** to any tracked git ref. It has been
> **recreated** from the governing docs and the standing working agreement. If an
> older authoritative copy surfaces, reconcile against it and keep the stricter
> rule.

---

## 0. Why this exists

The repo is worked on by many short-lived chats, each of which may spawn its own
ephemeral helper agents. Without a written contract, two failure modes recur:

1. **Untracked scope** — an agent touches a load-bearing surface (the globe,
   funds/ASA, the baton) that another agent or the protocol assumed was frozen.
2. **Lossy handoffs** — work is passed between agents/chats as prose, so intent,
   guardrails, and "done" criteria get dropped (see the #32 retro-**FAIL**:
   an undisclosed second feature plus stray agent artifacts rode in on a nav PR).

This ledger fixes both: a **claim before you touch** rule for protected surfaces,
and a **5-field Work Order** that makes every handoff a checkable artifact.

---

## 1. Employee vs Sub-Agent Rules

Two kinds of agent operate here. They have **different authority**.

### 1.1 Employees (roster agents)

An **Employee** is a roster role from the
[Agent Chain of Authority](./AGENT_CHAIN_OF_AUTHORITY.md) 10-agent active budget —
the Executive Coordinator (A00), Engineering, Research, QA, Documentation,
Analytics, Operations, and the two Floating Specialists. In practice, **the chat
itself is the A00 Employee**: it reads the baton, runs the audit gate, owns the
one unit of work, and runs closeout.

Employees **may**:

- Own a **unit of work** end-to-end (one unit = one branch = one PR).
- **Claim** surfaces in the Studio Agent Registry (§4) and work them.
- Open a branch and a **draft** PR; request the F4 audit.
- Write/rewrite the baton, audits, session notes, and **this ledger** — but only
  as the explicit unit of work, and the change is itself audited.
- Issue **Work Orders** (§3) to Sub-Agents and to the next chat.

Employees **may not**:

- Merge to `main` without a **PASS** from an independent F4 audit.
- Hold more than **one open PR** at a time (top invariant).
- Cross a hard gate (production / mainnet / funds) — that is **CEO-only** with
  `/mainnet-gate` **and** `algo-auditor` (see §5 and the authority matrix).

### 1.2 Sub-Agents (ephemeral helpers)

A **Sub-Agent** is a Claude subagent spawned *within* a chat (e.g. the
independent auditor, an `Explore` search agent, a focused implementer). It is
**scoped, bounded, and disposable** — it exists only for the task it was given.

Sub-Agents **may**:

- Do exactly the task in their **Work Order** (§3) — research, search, draft,
  audit, test — and return a result to the Employee that spawned them.
- Read freely; write only inside the surface(s) their Work Order claims.

Sub-Agents **may not**:

- **Expand their own scope.** No work outside the Work Order's surfaces. If the
  task needs more, they report back and ask — they do not self-authorize.
- **Claim new protected surfaces.** Only the owning Employee claims surfaces; a
  Sub-Agent inherits the claim from its Work Order.
- **Commit, push, merge, or open/close PRs.** Git history and PR state are the
  Employee's responsibility, never a Sub-Agent's.
- **Spawn unbounded further agents.** The "≤10 active per chat" ceiling is hard.
- **Touch funds/ASA/auth/secrets or anything mainnet-facing.** Money-path and
  irreversible actions never delegate downward.

### 1.3 The one rule that binds both

> **Refute, don't rubber-stamp.** An auditing Sub-Agent's job is to *disprove*
> the claims it is given (diff vs. claims, run the tests, hunt scope creep). An
> Employee may not mark work "validated" without a test that backs it — say
> "untested" when it is untested.

---

## 2. Pre-work checklist (mandatory)

Before any implementation work in a chat, the owning Employee MUST, in order:

1. **Read the baton** (`docs/HANDOFF.md`) and memory. The baton is the single
   source of truth for what's next.
2. **Run `/handoff-audit`** on the previous PR and gate it
   (PASS → merge; CONCERNS → ask; FAIL → don't merge). One open PR at a time.
3. **Read this ledger** and confirm it is present and treated as a protected
   surface (it is REC-004; if missing, restore it before proceeding).
4. **Claim the surface(s)** you will touch in the **Studio Agent Registry** (§4)
   — *before* writing code. Refuse to start if a surface you need is already
   claimed by an open unit.
5. **Write the Work Order** (§3) for the unit (and one per Sub-Agent you spawn).
6. Only then: do the **one** unit of work on its branch.
7. End with **`/closeout`** — green tests, exactly one PR into `main` with an
   Audit checklist, rewrite the baton to `AWAITING_AUDIT`, release your claim.

---

## 3. Mandatory Work Order format (5 fields)

Every handoff — Employee → Sub-Agent, and chat → next chat — uses **exactly these
five fields**. No field may be empty; "none" is a valid value but must be stated.

| # | Field | What it captures |
|---|-------|------------------|
| 1 | **Objective** | The single outcome this unit delivers, in one sentence. One unit only. |
| 2 | **Surface(s) & Claim** | The exact files/dirs to be touched, and the Studio Agent Registry claim that covers them. Anything not listed is **out of scope**. |
| 3 | **Constraints / Guardrails** | What must NOT change or be touched (protected surfaces, no mock data, no funds/mainnet, no second feature), plus any HARD RULES that apply. |
| 4 | **Acceptance criteria** | Definition of done — the concrete, checkable results (which tests pass, what the audit must be able to verify with `file:line` evidence). |
| 5 | **Verification & Handoff** | How it was proven (commands run + actual results, or honestly "untested"), the PR, and the baton update / next Work Order. |

### Template (copy this)

```
WORK ORDER
1. Objective:        <one sentence; one unit>
2. Surface(s) & Claim: <files/dirs> · registry claim: <branch/agent>
3. Constraints:      <protected surfaces & rules NOT to break; "none" if none>
4. Acceptance:       <tests/results that must hold; what the auditor verifies>
5. Verification:     <commands + actual results OR "untested">; PR <#>; next: <baton/WO>
```

A Work Order that over-claims in field 5 (says "works"/"validated" without a test)
is **invalid** — fail it back.

---

## 4. Studio Agent Registry — claim before you touch

A surface may be worked by **at most one open unit at a time**. Claim it here at
the start of the unit; release it at `/closeout` (when the PR is opened) or on
abandonment. This mirrors the "one open PR at a time" invariant at the file level.

### How to claim

Add a row before writing code; set status to `RELEASED` (and let the next
closeout prune it) once your PR is opened/merged or the work is dropped.

| Surface (files/dirs) | Claimed by (branch / agent) | Unit / Work Order objective | Status | Claimed (UTC) |
|----------------------|-----------------------------|-----------------------------|--------|---------------|
| `docs/AGENT_ORCHESTRATION_LEDGER.md`, `docs/audits/<this branch>.md`, `docs/HANDOFF.md` | `claude/pr34-audit-ledger-recovery-m3xpvm` | Retrospective audit of PR #34 + recreate REC-004 ledger | **CLAIMED** | 2026-06-15 |

> Claims are advisory but **binding by convention**: if you find a surface you
> need already `CLAIMED` by an open unit, stop and coordinate (ask the user) —
> do not double-work it. Stale claims (PR merged/closed) are pruned at the next
> `/closeout`.

---

## 5. Protected surface declaration

The following surfaces are **protected**. Touching one requires (a) an explicit
**claim** in §4, (b) a Work Order whose Constraints field acknowledges the
protection, and for the hard-gated rows (🚫) the named gate(s). When in doubt,
**fail closed**: treat it as protected and ask.

| Surface | Protection | Why |
|---------|-----------|-----|
| **This ledger** — `docs/AGENT_ORCHESTRATION_LEDGER.md` | 🔒 Claim + audited change only | It is the orchestration contract (REC-004). Edits are themselves an audited unit. |
| **The baton** — `docs/HANDOFF.md` | 🔒 Closeout-only rewrite | Single source of truth for "what's next"; rewritten only at `/closeout`. |
| **The audit trail** — `docs/audits/**`, `artifacts/frontier-al/docs/audit/**` | 🔒 Append-only | The record that nothing landed unreviewed. Don't rewrite history. |
| **The 3D globe** — `artifacts/frontier-al/client/src/components/game/globe/**` | 🔒 Off-limits unless the unit IS the globe | Load-bearing, easily regressed; do not touch incidentally. |
| **Combat / canvas / weapons FX** — `.../components/game/weapons/**`, canvas/FX code | 🔒 Off-limits unless the unit IS that | Heavy runtime surface; not to be ported in piecemeal. |
| **Funds / ASA / transfers / treasury** — `artifacts/frontier-al/server/services/chain/**` (money path) | 🚫 CEO-only + `/mainnet-gate` **and** `algo-auditor` | Irreversible, real value. No autonomous or overnight crossing. |
| **Auth / signature / secrets** — `server/auth.ts`, `server/security.ts`, env/mnemonics | 🚫 `/security-pass` (fix + test + document) | Security boundary; every fix needs a failing→passing test. |
| **Mainnet / production config** — `ops/kestra/**`, network/ASA/app IDs, deploy env | 🚫 Testnet-only for agents; CEO-only for prod/mainnet | Hard gate. Nothing in `ops/kestra/` may point at mainnet. |
| **Plot / HUD data surfaces** | ⚠️ No mock/demo data | Bind real props only — the #32 FAIL lesson; never reintroduce mock stats. |

Legend: 🔒 claim + audited change · 🚫 hard gate (named approval/gate required) ·
⚠️ standing rule.

---

## 6. See also

- [`SESSION_PROTOCOL.md`](./SESSION_PROTOCOL.md) — the chat loop this overlays.
- [`AGENT_CHAIN_OF_AUTHORITY.md`](./AGENT_CHAIN_OF_AUTHORITY.md) — the roster &
  authority matrix Employees are drawn from.
- [`FACTORY_REGISTRY.md`](./FACTORY_REGISTRY.md) — directives, factories, agents.
- [`MAINNET_READINESS_FLOW.md`](./MAINNET_READINESS_FLOW.md) — the mainnet gates.
- [`../CLAUDE.md`](../CLAUDE.md) ·
  [`../artifacts/frontier-al/CLAUDE.md`](../artifacts/frontier-al/CLAUDE.md) —
  chat-loop and app rules.
</content>
</invoke>
