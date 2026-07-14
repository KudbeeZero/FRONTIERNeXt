# KILO Runner Prompt — FRONTIERNeXt

> Copy this block in full when starting a KILO (or Claude Code / Codex) session.
> Replace bracketed values before sending.

---

## Runner Prompt Template

```
Repo: KudbeeZero/FRONTIERNeXt
App path: artifacts/frontier-al/
Branch: [BRANCH_NAME]
Base: main
Mode: Code

### Context
Load context from the following sources in order:
1. Current GitHub `main`, active PRs, recent commits, migrations, tests, CI, deployment.
2. docs/HANDOFF.md
3. Relevant docs/memory/ files in this repo.
4. FRONTIER — Memory Layer (Drive folder, by name only):
   - 00 — Index & Current State → current commit, verdict, active blocker, owner action
   - 10 — Completed Lanes → merged lane closeouts (read for prior context)
   - 20 — Audits & Roadmaps → active audits and roadmaps
   - 90 — Consolidated Archive → historical context ONLY, do not append by default
Do NOT let Drive memory override current repo evidence.

### Scope
[DESCRIBE THE LANE — one focused implementation task]

### Non-Goals
- No production data changes
- No schema migrations unless explicitly scoped
- No ASA / NFT / treasury changes
- No wallet config changes
- No Algorand on-chain changes
- No dependency upgrades
- No unrelated bug fixes (open a separate PR)

### Tests
[DESCRIBE FOCUSED TESTS TO RUN DURING DEVELOPMENT]
Run full verification once at closeout.

### Closeout (required before stopping)
Report the following:

ASKED
[Restate the task in one sentence]

DONE
[List every file changed, what was done, and why]

NEEDS YOU
[List anything blocked, uncertain, or requiring owner decision]

---
- Branch:
- Base: main
- Commits: [list]
- Changed files: [list]
- Uncommitted changes: [yes/no — describe if yes]
- Tests: [results and totals]
- Typecheck/build: [pass/fail]
- CI: [green/red/pending]
- Limitations: [anything the agent could not verify]
- Restricted systems: [list any systems not touched — treasury, ASA, wallet, on-chain]
- PR URL: [link]
- Merge verdict: [MERGE READY / NEEDS FIXES / NEEDS OWNER REVIEW]

### Session Updater (run at every session end)
After closeout, write back to FRONTIER — Memory Layer:
1. 00 — Index & Current State
   - Current commit (SHA + message)
   - Latest completed PR number and title
   - Launch verdict (BLOCKED / STAGED / READY)
   - Active blocker (one line)
   - Owner action now (one line)
2. 10 — Completed Lanes (only if a lane was merged this session)
   - Full closeout record from the ASKED / DONE / NEEDS YOU block above
Do NOT write to 90 — Consolidated Archive unless explicitly instructed.
```

---

## Session Updater Status

- Confirmed operational: ran twice, both green ✅ (2026-07-14)
- No corrective action needed — updater is wired and flowing
- Trigger is embedded in the closeout block above; do not remove it

---

## Memory Layer Folder Reference (Name Only)

| Folder | Purpose | When to Write |
|--------|---------|---------------|
| `00 — Index & Current State` | Current commit, verdict, blocker, owner action | Every session end |
| `10 — Completed Lanes` | Merged lane closeout records | Post-merge only |
| `20 — Audits & Roadmaps` | Active audits and roadmaps | Read-only during session |
| `90 — Consolidated Archive` | Historical context only | Read-only, fallback only |

**Drive folder name:** FRONTIER — Memory Layer  
Do not reference this folder by direct URL — use the folder name only.

---

## Agent Rules

- One active lane and one PR at a time.
- Inspect before editing. Preserve valid existing work.
- Avoid broad rewrites and dependency upgrades.
- Separate unrelated bugs into separate PRs.
- Run focused tests during development; full verification at closeout.
- Do not begin the next lane before current lane is reviewed or merged.
- Do not spend agent tokens on a mechanical merge when CI is green and verdict is `MERGE READY`.
- Use Code mode for focused implementation. Debug mode only for a specific reproducible failure.
- Avoid Orchestra/sub-agents unless truly necessary.
- Continue the same agent while context remains useful.
