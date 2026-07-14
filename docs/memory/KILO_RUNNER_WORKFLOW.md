# KILO Runner Prompt — Memory Layer Workflow

> **Repo:** KudbeeZero/FRONTIERNeXt  
> **App path:** `artifacts/frontier-al/`  
> **Drive folder:** `FRONTIER — Memory Layer`  
> **Branch:** `feat/memory-layer-runner-workflow`  
> **Base:** `main`

---

## Purpose

This document defines the canonical runner prompt structure for KILO (and other coding agents) operating on FRONTIERNeXt. It ensures every agent session:

1. Reads the correct memory layer before starting.
2. Executes work inside the scoped lane.
3. Writes an accurate session update to the memory layer on closeout.
4. Triggers the workflow session updater so state is never stale between sessions.

---

## Memory Layer Source of Truth

Drive folder: `FRONTIER — Memory Layer`

| Folder | Purpose | Read on start | Write on closeout |
|---|---|---|---|
| `00 — Index & Current State` | Current commit, latest PR, launch verdict, active blocker, owner action | ✅ Always | ✅ Always |
| `10 — Completed Lanes` | Merged lane closeouts | Only if referencing past work | ✅ On merge |
| `20 — Audits & Roadmaps` | Full audits and active roadmaps | If lane touches audited system | On major audit update |
| `90 — Consolidated Archive` | Historical context only | Only when `00` is missing context | Never — read only |

**Rule:** Never let Drive memory override current repo evidence. GitHub `main` is always source of truth.

---

## Runner Prompt Template (copy-paste for KILO)

```
REPO: KudbeeZero/FRONTIERNeXt
APP PATH: artifacts/frontier-al/
BRANCH: feat/<lane-name>
BASE: main
DRIVE FOLDER: FRONTIER — Memory Layer

## PRE-SESSION — Memory Layer Read
Before writing a single line of code:
1. Read `FRONTIER — Memory Layer / 00 — Index & Current State` → confirm current commit, active blocker, owner action.
2. Read any relevant file in `20 — Audits & Roadmaps` if this lane touches an audited system.
3. Do NOT load `90 — Consolidated Archive` unless `00` has a gap you cannot fill from repo evidence.

## SCOPE
<describe the single lane goal here>

## NON-GOALS
- No broad rewrites or dependency upgrades.
- No unrelated bug fixes (open a separate PR).
- No schema migrations unless this lane requires them.
- No changes to treasury addresses, ASA IDs, wallet config, or production data.

## IMPLEMENTATION RULES
- One active lane, one PR.
- Inspect before editing. Preserve valid existing work.
- Separate unrelated bugs into separate PRs.
- Run focused tests during development.
- Run full verification once at closeout.

## TESTS
- List specific test files and commands relevant to this lane.

## SESSION UPDATER — Run on Every Significant Checkpoint
After each meaningful commit or decision point, write a brief update to:
`FRONTIER — Memory Layer / 00 — Index & Current State`

Update fields:
- Current commit SHA
- Active blocker (if any)
- Owner action now
- Session summary (1–2 sentences)

The session updater must run automatically at:
- First meaningful commit
- Any blocker discovered
- Closeout (mandatory)

## CLOSEOUT — Memory Layer Write
When the lane is complete and CI is green:

### ASKED
<what was requested>

### DONE
<what was implemented — file paths, functions, migrations, tests>

### NEEDS YOU
<owner actions required — review, merge, deploy, verify>

**Required closeout fields:**
- Branch:
- Base:
- Commits:
- Changed files:
- Uncommitted changes:
- Tests (passing/total):
- Typecheck/build:
- CI status:
- Limitations:
- Restricted systems (not touched):
- PR URL:
- Merge verdict: [ ] MERGE READY / [ ] NEEDS REVIEW / [ ] BLOCKED

After merge, write the full closeout to:
`FRONTIER — Memory Layer / 10 — Completed Lanes / <lane-name>-closeout.md`

Update `00 — Index & Current State` with:
- New current commit (post-merge SHA)
- Latest completed PR number
- Revised launch verdict
- Cleared blocker (if resolved)
- New owner action
```

---

## Workflow Session Updater — Integration Notes

The session updater ran twice green as of **2026-07-14**, confirming the mechanism is functional. Key integration points:

- **Trigger:** Every significant commit and at mandatory closeout.
- **Target:** `FRONTIER — Memory Layer / 00 — Index & Current State` (Drive folder — not a direct URL reference in code).
- **Fields written:** Current commit SHA, active blocker, owner action, session summary.
- **Idempotent:** Running twice green is expected and correct — second run should detect no delta and exit cleanly.
- **Do not hardcode Drive URLs** in source or CI. Reference the folder by name only: `FRONTIER — Memory Layer`.

---

## Agent Mode Guidance

| Mode | When to use |
|---|---|
| **Code** | Focused implementation of a scoped lane |
| **Debug** | Specific reproducible failure only |
| **Orchestra/sub-agents** | Avoid unless the lane genuinely requires parallel isolated workstreams |

- Continue the same agent while context remains useful.
- Do not spend agent tokens on a mechanical merge when CI is green and verdict is `MERGE READY`.
- Do not begin the next lane before the current lane is reviewed or merged.

---

## Session Updater — Workflow Run Log

| Date | Run # | Status | Notes |
|---|---|---|---|
| 2026-07-14 | 1 | ✅ Green | Initial run confirmed |
| 2026-07-14 | 2 | ✅ Green | Second run confirmed idempotent |

---

*Last updated: 2026-07-14 by owner via Perplexity Space audit.*
