# KILO Runner Prompt — FRONTIERNeXt Memory Layer Workflow

> **Copy-paste this entire block as the opening context for every KILO / Claude Code session.**
> Do not abbreviate. Do not skip the memory write at closeout.

---

## 1. Identity & Repo

- **Repo:** `KudbeeZero/FRONTIERNeXt`
- **App path:** `artifacts/frontier-al/`
- **Production:** https://frontierprotocol.app
- **Fly:** https://frontiernext.fly.dev
- **Agent:** KILO (Claude Code / Codex — Code mode unless debugging a specific reproducible failure)

---

## 2. Source-of-Truth Order

Always verify in this order before acting:

1. Current GitHub `main` — commits, PRs, branches, migrations, tests, CI, deployment
2. `docs/HANDOFF.md`
3. `docs/memory/` files (this folder)
4. Notion Drive: `FRONTIER — Memory Layer`
   - `00 — Index & Current State / CURRENT — FRONTIER Memory Index`
   - Active reports in `20 — Audits & Roadmaps`
   - Completed lanes in `10 — Completed Lanes`
5. `90 — Consolidated Archive` — historical context only
6. Older notes or chat summaries — lowest priority

**Never let Drive memory override current repo evidence.**

---

## 3. Current Checkpoint (Verify Before Starting)

- Last known merged PR: #259 — Battle Planner Phase 1 (`176b7b3`)
- Battle Planner flow: Target → Origin → Commander → Resources → Review → Launch
- `selectedParcelId` is the canonical battle target
- PRs #256–#258: faction identity / globe colors / battle integrity / visual Battle Target Selector
- **Do not reopen completed lanes unless current repo evidence shows a launch-blocking regression**

---

## 4. Product Direction (Land Economy Launch — Not Full War Sim)

A launch-ready user must be able to:

1. Understand the product
2. Connect an Algorand wallet
3. Authenticate with the backend
4. Select and legally buy a plot or sub-plot
5. Submit one intended payment
6. Receive correct database ownership
7. Receive the correct land ASA/NFT
8. See ownership in account and globe
9. Accumulate and claim tokens
10. Buy upgrades
11. Choose and develop an archetype
12. See intended archetype energy/grid effects
13. Terraform where permitted
14. Refresh, logout, reconnect, and return without losing progress
15. Reconcile database state with Algorand on-chain state

**Battles, Commanders, faction treasury, permanent capture, and advanced AI are post-launch.**

---

## 5. Default Priorities

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

## 6. Read-Only Default

Unless explicitly asked to implement:
- Do NOT modify source, schema, migrations, secrets, wallet config
- Do NOT change prices, treasury/admin addresses, ASA IDs
- Do NOT touch production data, PRs, or deployments

---

## 7. Development Workflow Rules

- One active implementation lane and one PR at a time
- Inspect before editing — never rewrite valid existing work
- Avoid broad rewrites and dependency upgrades
- Separate unrelated bugs into separate PRs
- Run focused tests during development; full verification at closeout
- Do not begin the next lane before the current lane is reviewed or merged

---

## 8. Evidence Standard

For every material conclusion include:
- Exact file path
- Relevant function / component / route / table / schema
- Supporting test or migration
- Commit / PR evidence
- Production / deployment evidence when available
- Confidence: **High / Medium / Low**
- Label: `verified fact` | `code inference` | `missing evidence` | `owner verification`

Trace active behavior through:
```
UI → client state → API → server validation → database → Algorand → client refresh
```

System-status labels: `LIVE` | `PARTIAL` | `CONTRACT_ONLY` | `CATALOG_ONLY` | `UI_ONLY` | `PLANNED` | `DEPRECATED` | `UNKNOWN`

Finding labels: `CRITICAL LAUNCH BLOCKER` | `REQUIRED BEFORE PUBLIC ACCESS` | `SAFE FOR STAGED RELEASE` | `POST-LAUNCH ENHANCEMENT`

---

## 9. Session Closeout (MANDATORY — Do Not Skip)

At the end of every KILO session, output a closeout block using this exact format:

```
## KILO CLOSEOUT

**ASKED:** [one-line description of the lane]

**DONE:**
- [bullet list of completed changes]

**NEEDS YOU:**
- [owner actions required before next session]

---

**Branch:** [branch name]
**Base:** [base branch]
**Commits:** [commit SHAs and messages]
**Changed files:** [list]
**Uncommitted changes:** [none | list]
**Tests:** [passed X / failed Y / skipped Z]
**Typecheck/Build:** [pass | fail | not run]
**CI:** [green | red | pending | not triggered]
**Limitations:** [anything not done and why]
**Restricted systems:** [any production/admin systems not touched]
**PR URL:** [URL or "not yet created"]
**Merge verdict:** [MERGE READY | NEEDS REVIEW | BLOCKED — reason]
```

---

## 10. Memory Layer Write (MANDATORY after every merged PR or major session)

After closeout, write the following:

### A. Update Notion — `00 — Index & Current State`

Update the `CURRENT — FRONTIER Memory Index` page with:
- Current commit (main HEAD)
- Latest completed PR number and title
- Launch verdict (update only if changed)
- Active blocker (update or clear)
- Owner action now

### B. Archive to Notion — `10 — Completed Lanes`

Create a new page titled: `[PR#] — [Lane Title] — [YYYY-MM-DD]`

Content:
```
Status: MERGED
PR: #[number] — [title]
Commit: [SHA]
Date merged: [date]
Scope: [what was built]
Non-goals: [what was explicitly out of scope]
Tests: [summary]
Limitations: [anything deferred]
Next lane: [suggested follow-on lane if any]
```

### C. Push to GitHub — `docs/memory/SESSION_LOG.md`

Append to `docs/memory/SESSION_LOG.md`:
```
## [YYYY-MM-DD] — [Lane Title]
- PR: #[number]
- Commit: [SHA]
- Status: [MERGED | IN REVIEW | DEFERRED]
- Summary: [one sentence]
- Owner action: [one sentence or "none"]
```

---

## 11. Coding Agent Prompt Format (for sub-tasks)

When preparing prompts for a sub-task:

```markdown
**Repo:** KudbeeZero/FRONTIERNeXt
**App path:** artifacts/frontier-al/
**Branch:** [branch]
**Base:** main
**Scope:** [one sentence — what to build]
**Non-goals:** [what NOT to touch]
**Tests:** [what to verify]
**Closeout:** Run full verification. Output KILO CLOSEOUT block. Write memory layer updates.
```

Use Code mode for focused implementation.
Use Debug mode only for a specific reproducible failure.
Do not use Orchestra/sub-agents unless truly necessary.
Continue the same agent session while context remains useful.
