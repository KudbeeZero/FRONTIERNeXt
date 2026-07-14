# KILO Runner Prompt — FRONTIERNeXt

> **Copy-paste this block in full when starting a new KILO lane.**
> Update the bracketed fields for each lane. Do not modify the closeout or memory sections.

---

## Lane Brief

```
Repo:        KudbeeZero/FRONTIERNeXt
App path:    artifacts/frontier-al/
Branch:      feat/[lane-slug]
Base:        main
Mode:        Code

Scope
------
[One paragraph. What exactly is being built or fixed. Be specific.]

Non-goals (do not touch)
-------------------------
- Production data, schema migrations, ASA IDs, treasury/admin addresses
- Wallet config, private keys, environment variables
- Unrelated bugs (open a separate PR)
- Broad rewrites or dependency upgrades

Files expected to change
------------------------
[List the files or directories in scope. Everything else is out of scope.]

Tests required
--------------
[List the specific tests that must pass. Include any new tests to write.]

Closeout (required before you stop)
-------------------------------------
When your lane is complete, output the closeout block below in full.
Do not skip fields. Do not summarize — fill every field.
```

---

## Memory Layer — Session Updater Trigger

At the end of every session (whether or not the lane is complete), KILO must output a **Session Update block** using the format below. This block is used to keep the memory layer current between sessions.

```
## SESSION UPDATE

Date:              [YYYY-MM-DD]
Session:           [brief description of what was worked on]
Branch:            [current branch]
Last commit:       [short SHA + message]
Uncommitted:       [yes / no — describe if yes]
CI status:         [green / red / pending / unknown]
Active blocker:    [one sentence, or NONE]
Owner action now:  [one sentence — what the owner must do next, or NONE]
Lane status:       [IN PROGRESS / READY FOR REVIEW / MERGE READY]
```

> This block is consumed by the SESSION_UPDATER_WORKFLOW. Do not omit it.

---

## Closeout Block Format

Output this in full at lane completion:

```
## CLOSEOUT

ASKED
[Restate the original scope in one sentence.]

DONE
[Bullet list of everything completed.]

NEEDS YOU
[Bullet list of owner actions required before merge.]

---
Branch:             [branch name]
Base:               [main]
Commits:            [list short SHAs + messages]
Changed files:      [list files changed]
Uncommitted:        [yes / no]
Tests:              [pass count / total — or describe]
Typecheck/build:    [pass / fail / skipped]
CI:                 [green / red / pending]
Limitations:        [anything not done or deferred]
Restricted systems: [list any systems intentionally not touched]
PR URL:             [URL or PENDING]
Merge verdict:      [MERGE READY / NEEDS OWNER ACTION / DO NOT MERGE]
```

---

## Agent Rules (remind KILO at session start)

- One active lane and one PR at a time.
- Inspect before editing. Preserve valid existing work.
- Avoid broad rewrites and dependency upgrades.
- Separate unrelated bugs into their own PRs.
- Run focused tests during development; full verification at closeout.
- Do not begin the next lane before this one is reviewed or merged.
- Do not spend tokens on a mechanical merge when CI is green and verdict is MERGE READY.
- Continue the same agent session while context remains useful.
- Use Debug mode only for a specific reproducible failure.
- Avoid Orchestra/sub-agents unless truly necessary.
