# KILO Runner Prompt — Memory Layer Workflow

> **Space:** FRONTIERNeXt · **Branch:** `feat/memory-layer-kilo-runner` · **Base:** `main`
> **Purpose:** Canonical copy-paste prompt block handed to KILO (or any coding agent) at the start of every implementation lane. Embeds the Memory Layer session updater so it runs automatically at lane close.

---

## How to Use This File

1. Copy the block under **KILO Prompt Block** below.
2. Paste it at the top of your KILO session (Code mode).
3. Fill in the bracketed values for the current lane.
4. At closeout, KILO writes the Memory Layer outputs listed in the **Session Updater** section.
5. You review and approve the memory writes before the session ends.

---

## KILO Prompt Block

```
REPO:       KudbeeZero/FRONTIERNeXt
APP PATH:   artifacts/frontier-al/
BRANCH:     [feature-branch-name]
BASE:       main
MODE:       Code

## SCOPE
[One paragraph describing exactly what this lane implements — no more, no less.]

## NON-GOALS
- Do not modify schema, migrations, ASA IDs, treasury addresses, or production data.
- Do not upgrade dependencies.
- Do not touch unrelated systems or open bugs outside this lane.
- Do not begin a new lane before this one is reviewed or merged.

## IMPLEMENTATION STEPS
1. [Step 1]
2. [Step 2]
3. [Step 3]

## TESTS
- [ ] [Test 1 — describe the specific assertion]
- [ ] [Test 2]
- Run focused tests during development; full suite once at closeout.

## CLOSEOUT REQUIRED
At the end of this lane, before ending the session, you MUST:

### Agent Closeout Block
Output a closeout block in this exact format:

ASKED
[What was requested in one sentence]

DONE
- [File changed: path/to/file — what changed]
- [File changed: path/to/file — what changed]

NEEDS YOU
- [Any owner action required before merge]

BRANCH:          [branch name]
BASE:            main
COMMITS:         [count and short SHAs]
CHANGED FILES:   [list]
UNCOMMITTED:     [none | describe]
TESTS:           [passed X / failed Y / skipped Z]
TYPECHECK/BUILD: [green | errors listed]
CI:              [green | pending | failing — describe]
LIMITATIONS:     [anything left out of scope or deferred]
RESTRICTED:      [no production data, no secrets, no treasury touched]
PR URL:          [GitHub PR URL]
MERGE VERDICT:   [MERGE READY | NEEDS OWNER REVIEW | BLOCKED — reason]

### Memory Layer Session Updater
After outputting the closeout block, write the following memory files:

**1. Update `00 — Index & Current State / CURRENT — FRONTIER Memory Index`**
Set these fields to reflect the completed lane:
- `current_commit`: [latest commit SHA on this branch]
- `latest_completed_pr`: [PR number and title]
- `launch_verdict`: [unchanged | updated — describe]
- `active_blocker`: [none | describe the current blocker]
- `owner_action`: [what the owner must do right now]
- `last_updated`: [ISO date]

**2. Write `10 — Completed Lanes / [PR#]-[branch-name]-closeout.md`**
Content: the full Agent Closeout Block above, plus:
- Date completed
- Merge SHA (if merged)
- Any post-merge notes

**3. Do NOT write to:**
- `90 — Consolidated Archive` (historical only, never appended by agent)
- `20 — Audits & Roadmaps` (owner-managed)
- Any Drive file not listed above

## TOKEN EFFICIENCY
- Prefer targeted edits over full-file rewrites.
- Do not re-read files you already have in context.
- Do not explain reasoning in comments — code should be self-documenting.
- Stop and ask the owner before taking any action that touches: wallet config, ASA IDs, treasury addresses, prices, production data, secrets, or deployments.
```

---

## Session Updater — Standalone Reference

The session updater runs at the end of every KILO lane (embedded in the prompt above). It is confirmed working as of 2026-07-14 (ran twice, both green).

### Trigger Condition
Fired automatically at lane closeout — no manual step required when using the KILO Prompt Block above.

### Write Targets

| Target | Location | Fields Updated |
|---|---|---|
| Memory Index | `00 — Index & Current State/CURRENT — FRONTIER Memory Index` | `current_commit`, `latest_completed_pr`, `launch_verdict`, `active_blocker`, `owner_action`, `last_updated` |
| Lane Closeout | `10 — Completed Lanes/[PR#]-[branch]-closeout.md` | Full closeout block + merge SHA |

### Write-Protected Locations
- `90 — Consolidated Archive` — historical only, never written by agent
- `20 — Audits & Roadmaps` — owner-managed only
- Secrets, wallet config, ASA IDs, treasury addresses, production data

---

## Source-of-Truth Order (from Space Instructions)

1. Current GitHub `main`, PRs, commits, branches, migrations, tests, CI, deployment, and production evidence.
2. `docs/HANDOFF.md`
3. Relevant `docs/memory/` files (this file lives here)
4. Drive `00 — Index & Current State/CURRENT — FRONTIER Memory Index`
5. Drive `20 — Audits & Roadmaps` (active reports)
6. Drive `10 — Completed Lanes` (merged closeouts)
7. `90 — Consolidated Archive` — historical context only

---

## Default Priorities (per Space Rules)

1. Ownership and funds safety
2. Wallet/auth correctness
3. Duplicate transaction prevention
4. Plot/sub-plot purchase integrity
5. ASA/NFT delivery and reconciliation
6. Token accounting and duplicate-claim prevention
7. Database/on-chain consistency
8. Refresh/logout/reconnect persistence
9. Mobile Safari and Pera reliability
10. Upgrade and archetype correctness
11. Terraforming
12. Misleading UI/docs
13. Visual polish

---

_Last updated: 2026-07-14 · Session updater confirmed: 2× green runs_
