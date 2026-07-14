# KILO Runner Prompt — Memory Layer Workflow

> **Copy-paste this block at the start of every KILO / Claude Code / Codex session.**  
> Adjust bracketed fields before sending.

---

## 🔖 Session Bootstrap

```
Repo: KudbeeZero/FRONTIERNeXt
App path: artifacts/frontier-al/
Branch: [BRANCH_NAME]
Base: main
Mode: Code (focused implementation)
```

---

## 📋 Scope

**Lane:** [LANE_NAME — e.g., "Battle Planner Phase 2"]
**PR:** [PR_NUMBER or "new"]
**Goal:** [One sentence — what must be true when this lane is done]

**In scope:**
- [File / component / route / table]
- [File / component / route / table]

**Non-goals (do not touch):**
- Treasury / admin addresses
- ASA IDs, prices, production data
- Schema migrations outside this lane
- Unrelated bugs — open a separate PR
- Dependency upgrades

---

## 🧠 Memory Layer — Read First

Before writing any code, read these files in order:

1. `docs/HANDOFF.md` — current system state and active blockers
2. `docs/memory/` — any file matching the current lane topic
3. Drive: `00 — Index & Current State / CURRENT — FRONTIER Memory Index` — last verified commit, launch verdict, owner action

If any of the above contradicts the current `main` branch, **trust the repo**. Note the discrepancy in your closeout.

---

## ✅ Implementation Rules

- Inspect before editing — never overwrite valid existing work
- One active lane at a time; do not begin the next lane in this session
- Avoid broad rewrites and dependency upgrades
- Run focused tests during development
- Run full verification once at closeout
- Separate unrelated bugs into separate PRs
- Do not spend tokens on a mechanical merge when CI is green

---

## 🔄 Session Updater — Run at End of Every Session

**This is mandatory. Do not close the session without completing this block.**

After your last code change, output the following filled-in block:

```
=== SESSION UPDATER ===

Date: [YYYY-MM-DD]
Agent: KILO / Claude Code / Codex
Lane: [LANE_NAME]
Branch: [BRANCH_NAME]
Base: main

Current HEAD commit: [SHA]
Changed files:
  - [path]
  - [path]

Uncommitted changes: [yes / no — describe if yes]

Tests:
  - [test name]: [pass / fail / skipped]
  Total: [X passed, Y failed, Z skipped]

Typecheck: [pass / fail]
Build: [pass / fail]
CI status: [green / red / pending — link if available]

Limitations / known issues:
  - [describe or "none"]

Restricted systems (not touched):
  - Treasury, admin addresses, ASA IDs, production data: ✓ untouched

PR URL: [url or "not yet created"]
Merge verdict: [MERGE READY / NEEDS REVIEW / BLOCKED — reason]

=== MEMORY UPDATES ===

00 — Index (update these fields):
  current_commit: [SHA]
  latest_completed_pr: [PR # or "in progress"]
  launch_verdict: [LAUNCH READY / LAUNCH BLOCKED — reason]
  active_blocker: [describe or "none"]
  owner_action: [what the human must do next]

10 — Completed Lanes (append only if lane is merged):
  lane: [LANE_NAME]
  pr: [PR #]
  merged_commit: [SHA]
  date: [YYYY-MM-DD]
  summary: [1-2 sentences]
  files_changed: [list]

=== END SESSION UPDATER ===
```

---

## 🚦 Closeout Checklist

Before handing back to the owner:

- [ ] All in-scope changes committed to branch
- [ ] No uncommitted changes
- [ ] Focused tests pass
- [ ] Full verification complete
- [ ] Typecheck clean
- [ ] Build clean
- [ ] CI green (or failure explained)
- [ ] Session Updater block output above
- [ ] PR created or updated
- [ ] Merge verdict stated
- [ ] Memory Index fields ready for owner to paste into Drive

---

## 📐 Evidence Standard

For every material conclusion include:
- Exact file path
- Relevant function / component / route / table / schema
- Supporting test or migration
- Commit / PR evidence
- Confidence: High / Medium / Low
- Label: `verified fact` | `code inference` | `missing evidence` | `owner verification`

Trace active behavior through:
```
UI → client state → API → server validation → database → Algorand → client refresh
```

System-status labels: `LIVE` | `PARTIAL` | `CONTRACT_ONLY` | `CATALOG_ONLY` | `UI_ONLY` | `PLANNED` | `DEPRECATED` | `UNKNOWN`

Finding labels: `CRITICAL LAUNCH BLOCKER` | `REQUIRED BEFORE PUBLIC ACCESS` | `SAFE FOR STAGED RELEASE` | `POST-LAUNCH ENHANCEMENT`

---

## 🔒 Restricted Systems (Never Touch in This Lane)

- Treasury / admin wallet addresses
- Private keys, mnemonics, environment variables
- ASA IDs, land prices, NFT eligibility rules
- Production database records
- Any system outside the declared scope above
