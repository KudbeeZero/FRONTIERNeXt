---
name: agent-review
description: Multi-agent review of a focus area or pull request — parallel specialist roster, findings audited against real code, rated items into the queue. E.g. "/agent-review the payment flow" or "/agent-review PR #12".
---

# /agent-review — Multi-Agent Review Cycle

Protocol: `docs/protocols/SESSION_HANDOFF_PROTOCOL.md` §7. You are the **Master
Coordinator**.

**Step 0 — read the config**: `docs/protocols/handoff.config.md` for `handoff_dir`,
`stack_profile`, `review_roster_size`, and repo-specific rules. Read
`agent-memory.md` in `handoff_dir` (create from template if missing). Verify the
target exists (directory, module, or PR) and create
`<handoff_dir>/agent-runs/<date>-<focus>/` before launching anyone.

## Roster (fixed seats + one stack seat)

Architecture · Testing · Security · UX/a11y · Performance · Docs-vs-code ·
Bug hunting (races, hostile input, network edges) · Integration/data flow ·
**Stack seat** (from `stack_profile`, e.g. chain/SDK, payments, mobile, data) —
plus the **Synthesizer/Auditor**. Shrink the roster per `review_roster_size`;
when shrinking, merge seats rather than dropping Security or Testing.

## Night shift (parallel breadth)

Launch the breadth agents simultaneously as subagents, each scoped to the target's
files relevant to their seat. Every agent must: read `agent-memory.md` first, cite
`file:line` evidence, flag uncertainty rather than speculate, and write its own
report to `agent-runs/<date>-<focus>/night-<seat>.md`:

```
## [Seat] — Night Shift Report
**Focus**: <files/modules reviewed>
**Findings Table**
| ID | Severity | Category | File(s) | Description | Impact | Suggested Fix | Test Idea |
**Key Insights** (bullets, cite standards/docs)
**Code Suggestions** (diff blocks or precise snippets)
**Confidence Score**: X/10
```

IDs are namespaced by seat initial. Reports return only a ≤10-line summary to the
coordinator; the file is the artifact.

**PR targets:** agents review the diff **plus its blast radius** (callers, shared
state, tests touching the changed surface), pinned to the PR head ref.

## Morning shift 1 — Audit

One subagent reads all night reports plus the real code and writes
`audit-report.md`: consolidated master tables (Issues, Test Gaps, Performance,
Security), a traceability matrix (finding → file:line → verified?), contradictions
resolved with evidence, inflated/unverifiable findings demoted, refuted findings
recorded as refuted (they prevent re-litigating next run).

## Morning shift 2 — Synthesis

Write `final-plan.md`: prioritized backlog in issue style with effort estimates and
suggested branches, downstream-impact notes for the top fixes, dependency ordering
(call out any item that must be **gated** behind others), and predicted future
risks. Then update `agent-memory.md` (L1 run index, L2 audited headlines, L3
predictions, L4 lessons; prune to ~150 lines).

## Coordinator rules

- Agents share one working tree (protocol §5.6): NEVER `git checkout`/`stash`/`reset`. Inspect
  other refs via `git show <ref>:<path>` or a temp `git worktree` (cleaned up).
  Pin the ref for everyone.
- One report file per agent; no agent edits another's file or any code.
- After synthesis: feed `final-plan.md`'s top items into `NIGHT_QUEUE.md` as rated
  entries (HR/R/EXP), commit the run directory + memory + queue, push.
- For PR targets: post **one** consolidated review comment from the audit (never
  per-agent comment storms), findings ordered by severity with file:line anchors.
- Protocol hard guardrails apply: no shared-branch merges, no deploys, no
  secret/env edits.

## Output to the user

≤10 lines: findings funnel (raw → verified, by severity), the headline finding,
where the artifacts live, and what entered the queue.
