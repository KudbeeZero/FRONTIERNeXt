# KILO Runner Prompt — FRONTIERNeXt

> **Copy-paste this block in full at the start of every KILO / Claude Code / Codex session.**
> Do not paraphrase. Include repo, branch, scope, non-goals, memory layer targets, and closeout.

---

## Session Bootstrap

```
Repo: KudbeeZero/FRONTIERNeXt
App path: artifacts/frontier-al/
Production: https://frontierprotocol.app
Fly: https://frontiernext.fly.dev
Branch: <INSERT ACTIVE BRANCH>
Base: main
```

---

## Lane Scope

**Lane:** <INSERT LANE NAME — e.g., feat/battle-planner-phase-2>

**Asked (what you are building):**
- <bullet: specific deliverable 1>
- <bullet: specific deliverable 2>

**Non-goals (do not touch):**
- No production data mutations
- No schema migrations unless explicitly scoped
- No wallet config, treasury addresses, ASA IDs changes
- No unrelated bug fixes — open a separate PR
- No dependency upgrades

**Files in scope (inspect before editing):**
- <list files or directories relevant to this lane>

**Tests required:**
- <list tests to write or verify pass>

---

## Memory Layer — Read First

Before writing any code, read the following in order:

1. `docs/HANDOFF.md` — current state, last merged PR, active blockers
2. `docs/memory/` — any file relevant to this lane
3. Drive: `00 — Index & Current State / CURRENT — FRONTIER Memory Index` — current commit, launch verdict, owner action
4. Drive: `20 — Audits & Roadmaps` — active reports only

> **Source-of-truth order:** GitHub main > HANDOFF.md > memory/ > Drive 00 > Drive 20 > Drive 90 (archive, last resort only).
> Never let Drive memory override current repo evidence.

---

## Workflow Rules

- One active lane at a time. Do not begin the next lane before this one is reviewed or merged.
- Inspect before editing. Preserve valid existing work.
- Avoid broad rewrites and dependency upgrades.
- Separate unrelated bugs into their own PRs.
- Run focused tests during development; full verification once at closeout.
- Use Code mode for focused implementation. Debug mode only for a specific reproducible failure.
- Avoid Orchestra/sub-agents unless truly necessary.
- Continue the same agent while context remains useful.
- Do not spend agent tokens on a mechanical merge when CI is green and verdict is MERGE READY.

---

## Closeout Block (fill in at session end)

```
ASKED
<what was asked>

DONE
<what was completed>

NEEDS YOU
<what requires owner action — approvals, wallet config, production ops, etc.>

---
Branch: <branch>
Base: main
Commits: <list of commit SHAs and messages>
Changed files: <list>
Uncommitted changes: <none | list>
Tests: <test results and totals>
Typecheck/build: <pass | fail | N/A>
CI: <green | red | pending>
Limitations: <any known gaps or deferred items>
Restricted systems: <wallet config | treasury | ASA IDs | production data — untouched>
PR URL: <GitHub PR URL>
Merge verdict: <MERGE READY | NEEDS FIXES | OWNER REVIEW REQUIRED>
```

---

## Memory Layer — Write on Session End

After closeout, the **session updater** must run. See `docs/memory/SESSION_UPDATER.md` for the full workflow.

Minimum writes per session:

| Target | What to write |
|---|---|
| Drive: `00 — Index & Current State` | Current commit SHA, last PR merged, launch verdict, active blocker, owner action now |
| Drive: `10 — Completed Lanes` | Full closeout block (if lane is merged this session) |
| `docs/HANDOFF.md` | Updated current state, active branch, last known good SHA |

> **Never describe planned, catalog-only, contract-only, UI-only, or partial work as live.**
> Use system-status labels: `LIVE`, `PARTIAL`, `CONTRACT_ONLY`, `CATALOG_ONLY`, `UI_ONLY`, `PLANNED`, `DEPRECATED`, `UNKNOWN`.
