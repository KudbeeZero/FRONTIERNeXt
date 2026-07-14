# KILO Runner Prompt — Memory Layer Workflow

> **Confidential — FRONTIERNeXt proprietary workflow.**  
> Do not share outside the project. No secrets, private keys, or wallet credentials here.

---

## Purpose

This document defines the canonical **KILO runner prompt structure** for FRONTIERNeXt coding-agent sessions, including the **Memory Layer session updater workflow**. Every agent session that touches source, schema, migrations, or deployment MUST follow this workflow so the Memory Layer stays current.

---

## Memory Layer Map

| Folder | Purpose | Write Trigger |
|---|---|---|
| `00 — Index & Current State` | Current commit, active PR, launch verdict, active blocker, owner action | Every session closeout |
| `10 — Completed Lanes` | Merged lane closeouts, one file per lane | After merge confirmed |
| `20 — Audits & Roadmaps` | Full audits, roadmaps, severity findings | After major audit |
| `90 — Consolidated Archive` | Historical context only | Read-only by default |

**Source-of-truth order:** GitHub main → `docs/HANDOFF.md` → `docs/memory/` → Drive folders above.  
Never let Drive memory override current repo evidence.

---

## Session Updater Workflow

The **session updater** runs automatically at the end of every KILO agent session. You confirmed it ran twice green ✅ on 2026-07-14 — this is the canonical trigger flow:

```
[Agent closeout block received]
        │
        ▼
[Session Updater fires]
        │
        ├─► Write: 00 — Index & Current State
        │         • Current commit SHA
        │         • Latest completed/active PR
        │         • Launch verdict
        │         • Active blocker
        │         • Owner action now
        │
        └─► If PR merged → Write: 10 — Completed Lanes
                  • Lane name
                  • Branch + base
                  • Commits + changed files
                  • Test/typecheck/CI summary
                  • Limitations
                  • Merge verdict
```

**The updater must never write to `90 — Consolidated Archive` automatically.** That folder is read-only except by deliberate owner action.

---

## KILO Runner Prompt Template

Copy-paste the block below when starting a new KILO / Claude Code / Codex session. Fill in the `[LANE]`, `[BRANCH]`, `[BASE]`, `[SCOPE]`, and `[NON-GOALS]` fields before sending.

---

````markdown
## KILO Session — FRONTIERNeXt

**Repo:** `KudbeeZero/FRONTIERNeXt`  
**App path:** `artifacts/frontier-al/`  
**Branch:** `[BRANCH]` (base: `[BASE]`)  
**Lane:** [LANE]

### Scope
[SCOPE — one clear paragraph. What must be implemented, fixed, or verified. Reference exact file paths, functions, routes, or schema tables.]

### Non-goals
- [NON-GOALS — explicit list of what NOT to touch in this session]
- Do not modify: secrets, wallet config, prices, treasury/admin addresses, ASA IDs, production data
- Do not begin the next lane before this one is reviewed or merged

### Source-of-truth order
1. Current GitHub `main`, this branch, PRs, commits, migrations, tests, CI
2. `docs/HANDOFF.md`
3. `docs/memory/` files
4. Drive: `FRONTIER — Memory Layer`

### Implementation rules
- Inspect before editing. Preserve valid existing work.
- Avoid broad rewrites and dependency upgrades.
- Separate unrelated bugs into separate PRs.
- Run focused tests during development; full verification at closeout.

### Tests
[List specific test files or commands to run — e.g., `yarn test src/path/to/file.test.ts`]

### Closeout (required — do not skip)
When complete, output the full agent closeout block:

```
ASKED
[What was requested]

DONE
[What was implemented]

NEEDS YOU
[Owner actions required before merge]

Branch: [branch]
Base: [base]
Commits: [list]
Changed files: [list]
Uncommitted changes: [none | description]
Tests: [pass/fail counts]
Typecheck/build: [pass | fail | skipped]
CI: [green | red | pending]
Limitations: [any known gaps]
Restricted systems: [none touched | list]
PR URL: [url]
Merge verdict: [MERGE READY | NEEDS REVIEW | BLOCKED]
```

### Memory Layer — Session Updater
After outputting the closeout block, trigger the session updater:
1. **Always write** `00 — Index & Current State` with current commit, PR status, launch verdict, active blocker, owner action.
2. **If PR was merged** → also write a closeout record to `10 — Completed Lanes`.
3. **Do not** write to `90 — Consolidated Archive` automatically.
````

---

## Running the Session Updater Manually

If the updater did not fire automatically, run the manual trigger:

1. Open the FRONTIERNeXt Memory Layer in Drive: `FRONTIER — Memory Layer`
2. Navigate to `00 — Index & Current State`
3. Open `CURRENT — FRONTIER Memory Index`
4. Update all fields from the agent closeout block:
   - **Current commit:** SHA from closeout
   - **Latest PR:** PR number and URL
   - **Launch verdict:** current status
   - **Active blocker:** highest-severity open finding
   - **Owner action now:** next single required action
5. If lane was merged, create a new file in `10 — Completed Lanes` with the closeout block content.

---

## Evidence Standard for Agent Outputs

Every material conclusion in a KILO closeout must include:

- Exact file path
- Relevant function / component / route / table / schema
- Supporting test or migration
- Commit / PR evidence
- Production/deployment evidence when available
- **Confidence:** High | Medium | Low
- **Label:** verified fact | code inference | missing evidence | owner verification

System-status labels: `LIVE` | `PARTIAL` | `CONTRACT_ONLY` | `CATALOG_ONLY` | `UI_ONLY` | `PLANNED` | `DEPRECATED` | `UNKNOWN`

Finding labels: `CRITICAL LAUNCH BLOCKER` | `REQUIRED BEFORE PUBLIC ACCESS` | `SAFE FOR STAGED RELEASE` | `POST-LAUNCH ENHANCEMENT`

---

## Default Priorities (carried into every session)

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

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-14 | Initial creation — runner prompt + session updater workflow | Research assistant |
