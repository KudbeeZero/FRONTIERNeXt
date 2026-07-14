# KILO Runner Prompt — Memory Layer Workflow

> **FRONTIERNeXt · Confidential · Do not expose secrets, keys, or treasury credentials.**

This document is the canonical copy-paste runner prompt for KILO (Claude Code / Codex agent). It includes the Memory Layer session updater workflow and must be used at the start of every implementation lane.

---

## 1. Pre-Session Checklist (Owner, before handing to KILO)

Before starting KILO, verify:

- [ ] `main` is green (CI passing)
- [ ] No other lane PR is open and unreviewed
- [ ] Memory Index (`00 — Index & Current State/CURRENT — FRONTIER Memory Index`) reflects latest merged commit
- [ ] Active blocker and owner action are current in the Index

---

## 2. KILO Runner Prompt Template

Copy the block below. Fill in `[LANE_NAME]`, `[BRANCH]`, `[BASE]`, `[SCOPE]`, and `[NON_GOALS]` before pasting.

```
Repo: KudbeeZero/FRONTIERNeXt
App path: artifacts/frontier-al/
Branch: [BRANCH]  ← create from [BASE]
Mode: Code

## Lane
[LANE_NAME]

## Scope
[SCOPE — bullet list of exactly what changes]

## Non-Goals
[NON_GOALS — bullet list of what NOT to touch]
- Do NOT modify production data, schema migrations, treasury addresses, ASA IDs, or wallet config
- Do NOT open sub-agents or Orchestra unless explicitly required
- Do NOT upgrade dependencies
- Do NOT rewrite unrelated code

## Memory Layer — READ FIRST
Before writing a single line of code:
1. Read `docs/HANDOFF.md`
2. Read the relevant `docs/memory/` file for this lane (if exists)
3. Check `00 — Index & Current State/CURRENT — FRONTIER Memory Index` (Drive) for:
   - Current commit
   - Latest completed PR
   - Active launch blocker
   - Owner action now

## Memory Layer — WRITE AT CLOSEOUT
At the end of the session, before stopping:
1. Append a completed-lane record to `docs/memory/COMPLETED_LANES.md`
   Format:
   ```
   ## [LANE_NAME] — [DATE]
   Branch: [BRANCH]
   PR: #[NUMBER]
   Merged commit: [SHA]
   Summary: [1–2 sentence description]
   Files changed: [list]
   Tests: [passed/failed/skipped]
   Limitations: [any known gaps]
   ```
2. Output a **Memory Index update block** for the owner to paste into Drive:
   ```
   Current commit: [SHA]
   Latest completed PR: #[NUMBER] — [LANE_NAME]
   Launch verdict: [PASS / BLOCKED — reason]
   Active blocker: [blocker or NONE]
   Owner action now: [specific next step]
   Last updated: [DATE]
   ```

## Session Updater Workflow
The session updater runs automatically at the end of each KILO session via CI.
It is confirmed GREEN (ran twice successfully — July 14 2026).

Do NOT manually edit the Drive Memory Index during an active KILO session.
Wait for the session updater to complete, then verify the index reflects the new state.
If the updater fails, output the Memory Index update block manually (see above).

## Tests
- Run only tests relevant to changed files
- Full verification suite once at closeout
- Report: passed / failed / total

## Closeout Format
KILO must output a structured closeout block before ending:

---
ASKED: [what was requested]
DONE: [what was completed]
NEEDS YOU: [what requires owner action]

Branch: [BRANCH]
Base: [BASE]
Commits: [list of SHAs and messages]
Changed files: [list]
Uncommitted changes: [none / list]
Tests: [X passed / Y failed / Z total]
Typecheck/build: [PASS / FAIL]
CI: [GREEN / RED / PENDING]
Limitations: [any known gaps or skipped items]
Restricted systems: [any systems not touched per non-goals]
PR URL: [link or PENDING]
Merge verdict: [MERGE READY / NEEDS REVIEW / BLOCKED]
---
```

---

## 3. Memory Layer File Map

| Purpose | Location |
|---|---|
| Current state (commit, blocker, action) | Drive: `00 — Index & Current State/CURRENT — FRONTIER Memory Index` |
| Completed lane closeouts | `docs/memory/COMPLETED_LANES.md` (repo) + Drive: `10 — Completed Lanes` |
| Full audits and roadmaps | Drive: `20 — Audits & Roadmaps` |
| Historical context only | Drive: `90 — Consolidated Archive` |
| Handoff reference | `docs/HANDOFF.md` |

**Source-of-truth order:**
1. Current GitHub `main` (repo always wins)
2. `docs/HANDOFF.md`
3. `docs/memory/` files
4. Drive `00 — Index & Current State`
5. Drive `20 — Audits & Roadmaps`
6. Drive `90 — Consolidated Archive` (historical only)

Never let Drive memory override current repo evidence.

---

## 4. One-PR-At-a-Time Rule

- One active implementation lane and one PR at a time.
- Do not begin the next lane before the current PR is reviewed or merged.
- Do not spend agent tokens on a mechanical merge when CI is green and verdict is `MERGE READY` — hand that step back to the owner.

---

## 5. Session Updater — Technical Notes

- Confirmed running and green as of July 14 2026 (ran twice, both green).
- The updater fires at end-of-session via CI workflow.
- It writes the Memory Index update block to the designated Drive location.
- If it runs twice in a session, both runs being green is expected and correct — idempotent by design.
- Owner should verify the Drive index after each session to confirm the updater output is accurate.

---

*Last updated: 2026-07-14 by Perplexity / FRONTIERNeXt Space assistant.*
