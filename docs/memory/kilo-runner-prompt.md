# KILO Runner Prompt — FRONTIERNeXt

> Copy-paste this block in full at the start of every KILO coding agent session.
> Do not modify non-goal sections. Update scope and branch per lane.

---

## Session Header

**Repo:** `KudbeeZero/FRONTIERNeXt`  
**App path:** `artifacts/frontier-al/`  
**Memory layer:** FRONTIER — Memory Layer (Drive folder, name reference only)  
**Mode:** Code  
**Agent:** KILO  

---

## Pre-Session Memory Load

Before writing any code, load the following from the FRONTIER — Memory Layer:

1. `00 — Index & Current State` → read current commit, latest completed PR, launch verdict, active blocker, owner action
2. `20 — Audits & Roadmaps` → read active audit or roadmap relevant to this lane
3. `10 — Completed Lanes` → scan for any prior closed work that overlaps this lane's scope
4. `90 — Consolidated Archive` → load **only** if historical context is missing from the above; do not append to this folder

> Never let Drive memory override current repo evidence. Verify GitHub `main` before acting.

---

## Lane Scope (Fill In Per Session)

**Branch:** `<!-- e.g. feat/memory-layer-runner-workflow -->`  
**Base:** `main`  
**Lane title:** `<!-- short human-readable name -->`  

**Scope:**  
`<!-- Describe what this lane implements. Be specific: file paths, functions, routes, tables. -->`

**Non-goals:**  
- No production data changes  
- No schema migrations  
- No ASA / NFT / treasury changes  
- No wallet config changes  
- No Algorand on-chain changes  
- No dependency upgrades  
- No broad rewrites  
- No changes outside the scoped files  

**Tests:**  
`<!-- Describe focused tests to run during development and full verification at closeout. -->`

---

## Development Rules

- Inspect before editing — read the file before changing it
- Preserve valid existing work
- Separate unrelated bugs into separate PRs
- Run focused tests during development; run full verification once at closeout
- Do not begin the next lane before this lane is reviewed or merged
- One active implementation lane and one PR at a time
- Avoid Orchestra / sub-agents unless truly necessary
- Continue the same agent session while context remains useful
- Do not spend agent tokens on a mechanical merge when CI is green and verdict is MERGE READY

---

## Session Updater — Trigger at Every Session End

At the end of every session, regardless of merge status, write back to the FRONTIER — Memory Layer:

### `00 — Index & Current State` (every session)

Update the following fields:

```
Current commit: <sha>
Latest completed PR: <number and title>
Launch verdict: <LAUNCH READY | BLOCKED | PARTIAL>
Active blocker: <one-line description or NONE>
Owner action now: <specific next step for the human>
```

### `10 — Completed Lanes` (post-merge only)

Append a closeout record:

```
## Lane: <title>

**ASKED:** <what was requested>
**DONE:** <what was implemented>
**NEEDS YOU:** <what requires owner action>

- Branch: <branch name>
- Base: <base branch>
- Commits: <list>
- Changed files: <list>
- Uncommitted changes: <none | describe>
- Tests: <results and totals>
- Typecheck/build: <pass | fail | skipped>
- CI: <green | red | pending>
- Limitations: <any known gaps>
- Restricted systems: <any systems not touched>
- PR URL: <link>
- Merge verdict: <MERGE READY | NEEDS REVIEW | DO NOT MERGE>
```

### `20 — Audits & Roadmaps` (read-only during session)

Do not write to this folder during a coding session. Updates to audits and roadmaps are owner-driven.

### `90 — Consolidated Archive` (read-only, fallback only)

Do not append to this folder. Load for historical context only when the above folders are insufficient.

---

## Closeout Checklist

Before ending the session, confirm:

- [ ] Branch, base, commits, and changed files listed
- [ ] Uncommitted changes noted (or confirmed none)
- [ ] Tests run and totals reported
- [ ] Typecheck / build result confirmed
- [ ] CI status confirmed (green / red / pending)
- [ ] Limitations and restricted systems documented
- [ ] PR URL included
- [ ] Merge verdict stated
- [ ] `00 — Index & Current State` updated in FRONTIER — Memory Layer
- [ ] `10 — Completed Lanes` updated (post-merge only)
- [ ] Session updater triggered ✅

---

## Evidence Standard

For every material conclusion include:

- Exact file path
- Relevant function / component / route / table / schema
- Supporting test or migration
- Commit / PR evidence
- Production / deployment evidence when available
- Confidence: High | Medium | Low
- Label: verified fact | code inference | missing evidence | owner verification

Do not say a system works just because a component, type, constant, schema field, test stub, or document exists.  
Trace active behavior through: `UI → client state → API → server validation → database → Algorand → client refresh`

---

## System-Status Labels

`LIVE` `PARTIAL` `CONTRACT_ONLY` `CATALOG_ONLY` `UI_ONLY` `PLANNED` `DEPRECATED` `UNKNOWN`

## Finding Labels

`CRITICAL LAUNCH BLOCKER` `REQUIRED BEFORE PUBLIC ACCESS` `SAFE FOR STAGED RELEASE` `POST-LAUNCH ENHANCEMENT`
