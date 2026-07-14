# Session Updater Workflow — FRONTIERNeXt Memory Layer

> **This workflow runs at the END of every KILO / Claude Code / Codex session.**
> It is the authoritative record of what happened and what the current state is.
> The session updater ran green (×2) as of 2026-07-14 — workflow confirmed operational.

---

## Trigger

Run the session updater when **any** of the following occur:
- A PR is merged to `main`
- A lane closeout block is produced
- The owner explicitly requests a memory update
- A CRITICAL LAUNCH BLOCKER is identified or resolved

---

## Step-by-Step Workflow

### Step 1 — Verify Current Repo State

```
GitHub: HEAD commit SHA on main
Last merged PR: number + title
Active branch: <branch name or none>
CI status: green | red | pending
```

Source: GitHub `main` branch. Never infer from Drive without GitHub confirmation.

---

### Step 2 — Write `00 — Index & Current State`

File: Drive → `FRONTIER — Memory Layer / 00 — Index & Current State / CURRENT — FRONTIER Memory Index`

Update the following fields:

```
Last updated: <ISO date>
Current commit: <SHA>
Last PR merged: #<number> — <title>
Launch verdict: <LAUNCH READY | BLOCKED | STAGED | PARTIAL>
Active blocker: <description or NONE>
Active branch: <branch or NONE>
Owner action now: <specific action required or NONE>
```

> Write verified facts only. Do not describe planned or partial work as live.

---

### Step 3 — Write `10 — Completed Lanes` (if lane merged this session)

File: Drive → `FRONTIER — Memory Layer / 10 — Completed Lanes / <lane-name>-CLOSEOUT.md`

Include the full closeout block:

```
Lane: <name>
Merged PR: #<number>
Merge commit: <SHA>
Date: <ISO date>

ASKED
<what was asked>

DONE
<what was completed>

NEEDS YOU
<owner action items>

Tests: <results>
CI: green
Limitations: <any known gaps>
Restricted systems: <untouched systems>
```

---

### Step 4 — Update `docs/HANDOFF.md`

File: `docs/HANDOFF.md` in repo on `main`

Update:
- Current state summary (1–2 sentences)
- Last known good commit SHA
- Active branch (or NONE)
- Active blocker (or NONE)
- Owner action now

Commit directly to `main` post-merge, or include in the lane PR.

---

### Step 5 — Confirm Session Updater Complete

Output this block at end of every session:

```
SESSION UPDATER — COMPLETE

Timestamp: <ISO datetime>
Commit: <SHA>
Drive 00 updated: YES | NO
Drive 10 updated: YES | NO | N/A (no merge this session)
HANDOFF.md updated: YES | NO
Active blocker: <description or NONE>
Owner action now: <specific action or NONE>
```

---

## Status Labels

Always label system state with one of:

| Label | Meaning |
|---|---|
| `LIVE` | Verified working in production or staging |
| `PARTIAL` | Partially implemented; some paths work |
| `CONTRACT_ONLY` | Schema/type defined but no active behavior |
| `CATALOG_ONLY` | Registered but not integrated |
| `UI_ONLY` | Visible in UI but not wired to backend |
| `PLANNED` | Designed but not yet built |
| `DEPRECATED` | Removed or superseded |
| `UNKNOWN` | Cannot verify without owner or production access |

---

## Finding Labels

Use these in audit reports and session notes:

| Label | Meaning |
|---|---|
| `CRITICAL LAUNCH BLOCKER` | Blocks public access; must fix before launch |
| `REQUIRED BEFORE PUBLIC ACCESS` | Not a hard blocker but must ship at launch |
| `SAFE FOR STAGED RELEASE` | Safe to ship in a controlled rollout |
| `POST-LAUNCH ENHANCEMENT` | Deferred; does not affect launch |

---

## Notes

- The session updater confirmed running **green ×2** as of 2026-07-14. Workflow is operational.
- Do not skip Step 5. The confirmation block is the signal to the owner that memory is current.
- If Drive is inaccessible, note it in Step 5 and complete Steps 1 and 4 (GitHub-only) instead.
- Never overwrite a Completed Lane record — append a new file per lane.
