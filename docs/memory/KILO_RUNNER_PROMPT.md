# KILO Runner Prompt — FRONTIERNeXt

> **Copy this entire block as your first message to KILO (Claude Code / Codex) at the start of every implementation session.**
> Replace bracketed values before sending.

---

## Session Bootstrap

```
Repo: https://github.com/KudbeeZero/FRONTIERNeXt
App path: artifacts/frontier-al/
Production: https://frontierprotocol.app
Fly: https://frontiernext.fly.dev

Branch: [BRANCH_NAME]
Base: main
Active PR: [PR_URL_OR_NUMBER]
```

---

## Lane Scope

**Lane:** [LANE_TITLE — e.g., "Battle Planner Phase 2"]

**Goal:** [One sentence — what this lane accomplishes for the user journey.]

**In scope:**
- [Bullet 1]
- [Bullet 2]

**Non-goals (do not touch):**
- Treasury addresses, ASA IDs, production data
- Unrelated bug fixes (open a separate PR)
- Dependency upgrades
- Broad rewrites outside the lane

---

## Source-of-Truth Order

1. Current `main` — migrations, tests, CI, deployment evidence
2. `docs/HANDOFF.md`
3. Relevant `docs/memory/` files
4. Notion Memory Layer (`FRONTIER — Memory Layer` Drive folder)
   - `00 — Index & Current State/CURRENT — FRONTIER Memory Index`
   - Active reports in `20 — Audits & Roadmaps`
   - Completed closeouts in `10 — Completed Lanes`
5. `90 — Consolidated Archive` only for missing historical context

**Never let Drive memory override current repo evidence.**

---

## Inspect Before You Edit

1. Read all files you intend to change before touching them.
2. Trace the active behavior: `UI → client state → API → server validation → database → Algorand → client refresh`
3. Preserve valid existing work.
4. Run focused tests during development; full verification at closeout.

---

## Default Priorities

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

---

## Session Updater — Run at End of Every Session

Before closing, KILO must output the **Session Update Block** (see `docs/memory/SESSION_UPDATER.md`).

This block is used to:
- Update Notion `00 — Index & Current State` with the current commit, active blocker, and owner action
- Write a completed closeout to `10 — Completed Lanes` if the lane is merged
- Feed the next session's bootstrap context

**Do not end a session without producing this block.**

---

## Closeout Checklist

When the lane is complete, KILO outputs:

```
ASKED
[What the lane was asked to do]

DONE
[What was actually completed, file by file]

NEEDS YOU
[Any owner action required before merge]

---
Branch: [branch]
Base: main
Commits: [list]
Changed files: [list]
Uncommitted changes: [none / list]
Tests: [pass/fail + counts]
Typecheck/build: [pass/fail]
CI: [green / pending / failing]
Limitations: [any known gaps]
Restricted systems: [treasury, ASA IDs, production — not touched]
PR URL: [url]
Merge verdict: [MERGE READY / NEEDS REVIEW / DO NOT MERGE]
```

---

## Coding Mode Rules

- Use **Code mode** for focused implementation.
- Use **Debug** only for a specific reproducible failure.
- Avoid Orchestra/sub-agents unless truly necessary.
- Continue the same agent while context remains useful.
- Do not spend agent tokens on a mechanical merge when CI is green and verdict is `MERGE READY`.
- One active lane and one PR at a time.
- Separate unrelated bugs into separate PRs.
