# KILO Runner Prompt — FRONTIERNeXt Memory Layer Workflow

> **Copy-paste this block in full at the start of every KILO session.**
> Do not abbreviate. Do not skip the Memory Layer section.

---

## Session Bootstrap

```
Repo: KudbeeZero/FRONTIERNeXt
App path: artifacts/frontier-al/
Production: https://frontierprotocol.app
Fly: https://frontiernext.fly.dev
Mode: Code (focused implementation)
```

---

## Active Lane

```
Branch: <INSERT_BRANCH_NAME>
Base: main
Scope: <INSERT_SCOPE — one sentence max>
Non-goals: <INSERT_NON_GOALS>
Tests required: <INSERT_TEST_TARGETS>
```

> Replace all `<INSERT_*>` placeholders before sending.
> Never leave placeholders in a live prompt.

---

## Source-of-Truth Order (KILO must follow this)

1. Current GitHub `main`, PRs, commits, migrations, tests, CI
2. `docs/HANDOFF.md`
3. Relevant `docs/memory/` files
4. Drive: `00 — Index & Current State` → `20 — Audits & Roadmaps` → `10 — Completed Lanes`
5. `90 — Consolidated Archive` only for missing historical context
6. Older notes or chat summaries

> Never let Drive memory override current repo evidence.

---

## Default Priority Order

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

## Coding Rules (KILO must follow this)

- Inspect before editing
- One active lane and one PR at a time
- Preserve valid existing work
- Avoid broad rewrites and dependency upgrades
- Separate unrelated bugs into separate PRs
- Run focused tests during development; full verification at closeout
- Do not begin the next lane before the current lane is reviewed or merged
- Use Code mode for focused implementation
- Use Debug only for a specific reproducible failure
- Avoid Orchestra/sub-agents unless truly necessary
- Continue the same agent while context remains useful
- Do not spend tokens on a mechanical merge when CI is green and verdict is `MERGE READY`

---

## Memory Layer — Session Updater (MANDATORY)

### When to run

Run the Session Updater **at the end of every KILO session**, regardless of whether changes were merged.

### What to update

#### `00 — Index & Current State` → `CURRENT — FRONTIER Memory Index`

Update these fields every session:

| Field | Value |
|---|---|
| Last session date | `YYYY-MM-DD` |
| Current commit (main) | `<sha>` |
| Latest completed PR | `#<number> — <title>` |
| Active branch | `<branch>` |
| Active lane | `<one-line description>` |
| Launch verdict | `BLOCKED / STAGED / READY` |
| Active blocker | `<one-line or NONE>` |
| Owner action now | `<one-line or NONE>` |

Do **not** overwrite historical entries. Append or update in-place.

#### `10 — Completed Lanes` (only on successful merge)

Write a closeout record using this template:

```
## Lane: <title>
Branch: <branch>
Base: main
Merged: <PR #number> — <date>
Commits: <sha list or range>
Changed files: <count and key files>
Tests: <pass/fail counts>
Typecheck/build: PASS / FAIL
CI: GREEN / RED
Limitations: <any known gaps>
Restricted systems touched: <list or NONE>
Notes: <anything owner must know>
```

---

## Closeout Block (KILO must output this at end of every session)

```
## ASKED
<What was requested>

## DONE
<What was completed — file paths, functions, migrations, tests>

## NEEDS YOU
<Owner actions required — merge, env var, deploy, manual test, etc.>

---
Branch: <branch>
Base: main
Commits: <sha or range>
Changed files: <count and key paths>
Uncommitted changes: <YES — describe / NO>
Tests: <pass count> passed, <fail count> failed
Typecheck/build: PASS / FAIL
CI: GREEN / RED / PENDING
Limitations: <known gaps or NONE>
Restricted systems: <list or NONE>
PR URL: <url or N/A>
Merge verdict: MERGE READY / NEEDS REVIEW / BLOCKED
```

---

## Session Updater — Confirmation Signal

At the end of every session, KILO must output this line:

```
✅ SESSION UPDATER: Memory layer updated — 00 Index written, 10 Completed (if merged).
```

If the session updater did **not** run (e.g., session ended early), KILO must output:

```
⚠️ SESSION UPDATER: Memory layer NOT updated this session. Owner must update manually.
```

---

## System-Status Labels (use in all findings)

`LIVE` · `PARTIAL` · `CONTRACT_ONLY` · `CATALOG_ONLY` · `UI_ONLY` · `PLANNED` · `DEPRECATED` · `UNKNOWN`

## Finding Labels (use in all findings)

`CRITICAL LAUNCH BLOCKER` · `REQUIRED BEFORE PUBLIC ACCESS` · `SAFE FOR STAGED RELEASE` · `POST-LAUNCH ENHANCEMENT`

## Confidence Labels

`High` · `Medium` · `Low`  
Label every material conclusion as: `verified fact` · `code inference` · `missing evidence` · `owner verification`

---

## Evidence Standard

For every material conclusion include:
- Exact file path
- Relevant function/component/route/table/schema
- Supporting test or migration
- Commit/PR evidence
- Production/deployment evidence when available

Trace active behavior through:
```
UI → client state → API → server validation → database → Algorand → client refresh
```

Do not say a system works just because a component, type, constant, schema field, test stub, or document exists.

---

*Last updated: 2026-07-14*  
*Maintained by: Owner (KudbeeZero) + Perplexity research assistant*
