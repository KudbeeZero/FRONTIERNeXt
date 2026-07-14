# KILO Runner Prompt — FRONTIERNeXt Memory Layer Workflow

> **Copy-paste this block in full at the start of every KILO session.**  
> Do not summarize or abbreviate. The agent must receive the complete context.

---

## Session Bootstrap

```
Repo:        KudbeeZero/FRONTIERNeXt
App path:    artifacts/frontier-al/
Branch:      <INSERT ACTIVE BRANCH>
Base:        main
CI:          GitHub Actions (must be green before merge verdict)
Production:  https://frontierprotocol.app
Fly:         https://frontiernext.fly.dev
```

---

## Source-of-Truth Order (enforce strictly)

1. Current GitHub `main` — commits, PRs, migrations, tests, CI, deployment evidence
2. `docs/HANDOFF.md`
3. `docs/memory/` files (this folder)
4. Notion Drive: `FRONTIER — Memory Layer`
   - `00 — Index & Current State / CURRENT — FRONTIER Memory Index`
   - Active reports in `20 — Audits & Roadmaps`
   - Completed lanes in `10 — Completed Lanes`
5. `90 — Consolidated Archive` — historical context only
6. Older chat summaries — lowest priority

**Never let Notion memory override current repo evidence.**

---

## Lane Scope (fill in per session)

```
Lane:          <INSERT LANE NAME>
Scope:         <ONE paragraph — what changes, what files, what systems>
Non-goals:     <Explicit list of what this PR will NOT touch>
Tests:         <Which tests must pass or be added>
Closeout gate: <What proves this lane is done>
```

---

## Coding Mode Rules

- **One active lane. One PR at a time.** Do not begin the next lane before this one is reviewed or merged.
- **Inspect before editing.** Read the file, understand the structure, then change only what is in scope.
- **Preserve valid existing work.** Avoid broad rewrites and dependency upgrades.
- **Separate unrelated bugs** into separate PRs — do not bundle.
- **Run focused tests during development.** Full verification once at closeout.
- **Do not spend tokens on a mechanical merge** when CI is green and verdict is `MERGE READY`.
- **Token efficiency:** Prefer targeted edits over full-file rewrites. Ask if uncertain rather than guess.

---

## Evidence Tracing Standard

For every material conclusion, provide:

| Field | Required |
|---|---|
| File path | Exact path in repo |
| Function / component / route / table | Specific identifier |
| Supporting test or migration | File name + test name |
| Commit / PR evidence | SHA or PR number |
| Production / deployment evidence | When available |
| Confidence | High / Medium / Low |
| Label | Verified fact / Code inference / Missing evidence / Owner verification |

Trace active behavior through:  
`UI → client state → API → server validation → database → Algorand → client refresh`

System-status labels: `LIVE`, `PARTIAL`, `CONTRACT_ONLY`, `CATALOG_ONLY`, `UI_ONLY`, `PLANNED`, `DEPRECATED`, `UNKNOWN`  
Finding labels: `CRITICAL LAUNCH BLOCKER`, `REQUIRED BEFORE PUBLIC ACCESS`, `SAFE FOR STAGED RELEASE`, `POST-LAUNCH ENHANCEMENT`

---

## Session Updater Trigger (MANDATORY at closeout)

At the end of every session — whether the lane is complete or paused — the agent **must** write the Session Update block below and hand it back for the owner to post to Notion.

See: `docs/memory/SESSION_UPDATER.md` for the exact format and Notion write targets.

**The session is not closed until the updater block is delivered.**

---

## Agent Closeout Format

```
## ASKED
<What the owner asked for this session>

## DONE
<Bullet list of completed work — file paths, commits, PRs>

## NEEDS YOU
<Explicit list of owner actions required before next session>

---
Branch:              <branch name>
Base:                main
Commits:             <SHAs or count>
Changed files:       <list>
Uncommitted changes: <none / list>
Tests:               <pass count / fail count / skipped>
Typecheck / Build:   <pass / fail>
CI:                  <green / red / pending>
Limitations:         <anything the agent could not verify>
Restricted systems:  <Algorand mainnet, treasury, production DB — not touched>
PR URL:              <GitHub PR link>
Merge verdict:       <MERGE READY / NEEDS REVIEW / BLOCKED — reason>
```

---

## Default Priorities (never deprioritize 1–3)

1. Ownership and funds safety
2. Wallet / auth correctness
3. Duplicate transaction prevention
4. Plot / sub-plot purchase integrity
5. ASA / NFT delivery and reconciliation
6. Token accounting and duplicate-claim prevention
7. Database / on-chain consistency
8. Refresh / logout / reconnect persistence
9. Mobile Safari and Pera reliability
10. Upgrade and archetype correctness
11. Terraforming
12. Misleading UI / docs
13. Visual polish
