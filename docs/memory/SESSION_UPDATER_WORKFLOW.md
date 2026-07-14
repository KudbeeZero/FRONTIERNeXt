# Session Updater Workflow — FRONTIERNeXt Memory Layer

This document defines the canonical session updater flow that KILO (and all coding agents) must follow at the close of every session.

Verified status: **2× green ✅** (confirmed July 14, 2026)

---

## Overview

The Memory Layer keeps the project's current state synchronized across sessions. Without it, each agent session starts blind. The session updater ensures every session closes with a written, queryable record.

---

## Memory Layer Folder Targets

| Folder | File | Trigger |
|---|---|---|
| `00 — Index & Current State` | `CURRENT — FRONTIER Memory Index` | Every session close |
| `10 — Completed Lanes` | `[PR#]-[lane-name]-closeout.md` | Post-merge only |
| `20 — Audits & Roadmaps` | Active reports | Owner-initiated only |
| `90 — Consolidated Archive` | Historical records | Do not append by default |

---

## Step-by-Step Flow

### Step 1 — Session Open

1. KILO receives the runner prompt (see `KILO_RUNNER_PROMPT.md`)
2. KILO reads `00 — Index & Current State/CURRENT — FRONTIER Memory Index` **before any implementation**
3. KILO reads relevant `docs/memory/` files and `docs/HANDOFF.md`
4. KILO verifies current GitHub `main` state (branch, last commit, open PRs, CI)

### Step 2 — Implementation

- KILO works within the defined lane scope
- KILO runs focused tests during development
- KILO does not touch restricted systems

### Step 3 — Session Close (Session Updater)

1. KILO runs full verification (tests, typecheck, build, CI check)
2. KILO writes the session update to `00 — Index & Current State/CURRENT — FRONTIER Memory Index`:

```
Current commit: [SHA]
Latest completed PR: [#PR — title]
Launch verdict: [BLOCKED / STAGED / READY]
Active blocker: [description or NONE]
Owner action now: [specific next step]
Last updated: [YYYY-MM-DD]
```

3. If the lane was merged: KILO writes a closeout record to `10 — Completed Lanes/`:

```
# [PR#] — [Lane Name] Closeout

## ASKED
[What was requested]

## DONE
[Completed work with file paths and commits]

## NEEDS YOU
[Owner action required]

---
Branch:
Base: main
Commits:
Changed files:
Tests:
Typecheck/build:
CI:
Limitations:
Restricted systems: secrets, wallet config, treasury, ASA IDs, production data
PR URL:
Merge verdict: MERGE READY
```

4. KILO outputs the full closeout block in its final response for owner review

---

## Rules

- **Never describe planned, catalog-only, contract-only, UI-only, or partial work as live.**
- **Never let Drive memory override current repo evidence.**
- The `00 — Index` update must happen every session — even if no code changed.
- The `10 — Completed Lanes` write happens **only** on confirmed merge.
- Do not append to `90 — Consolidated Archive` by default.

---

## Session Updater Status

| Run | Result | Date |
|---|---|---|
| Run 1 | ✅ Green | July 14, 2026 |
| Run 2 | ✅ Green | July 14, 2026 |

Update this table after each subsequent session updater run.
