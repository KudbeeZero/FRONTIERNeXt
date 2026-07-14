# KILO Runner Prompt — FRONTIERNeXt Memory Layer Workflow

> **Copy-paste this block at the start of every KILO / Claude Code / Codex session.**
> Replace bracketed values before sending.

---

## Session Bootstrap

```
Repo:       KudbeeZero/FRONTIERNeXt
App path:   artifacts/frontier-al/
Branch:     [BRANCH NAME]
Base:       main
Mode:       Code  (switch to Debug only for a specific reproducible failure)
```

## Context Snapshot (fill before sending)

| Field | Value |
|---|---|
| Last merged PR | [PR # — from Memory Index] |
| Current commit (main) | [SHA — from Memory Index] |
| Active blocker | [one-line — from Memory Index] |
| Lane goal | [one sentence] |
| Non-goals | [list anything explicitly out of scope] |

## Scope

[Describe the lane in 3–5 bullet points. Be specific about files, routes, components, and tables.]

## Non-Goals (Repeat for clarity)

- No schema migrations unless this lane explicitly requires one
- No broad refactors or dependency upgrades
- No changes to treasury/admin addresses, ASA IDs, or production config
- No unrelated bug fixes — open a separate PR

## Memory Layer — REQUIRED Before You Write Code

1. Read `docs/HANDOFF.md`
2. Read `docs/memory/MEMORY_INDEX.md` (current commit, last PR, active blocker, owner action)
3. Read any relevant `docs/memory/` files for this lane
4. If a completed lane closeout exists in `docs/memory/completed/`, read it before touching that system

## Tests

- Run focused tests during development: `[test command]`
- Run full verification once at closeout: `[full test command]`
- Typecheck: `[typecheck command]`
- Build: `[build command]`

## Closeout — REQUIRED Before Handing Back

When the lane is complete, write a closeout block **in this exact format**:

```
ASKED
[one-line restatement of the original goal]

DONE
- [bullet: what was implemented, with file paths]
- [bullet: tests added or updated]
- [bullet: migrations run, if any]

NEEDS YOU
- [anything requiring owner action before merge]
- [any restricted system not touched]

Branch:             [branch name]
Base:               main
Commits:            [count]
Changed files:      [list]
Uncommitted:        [none | list]
Tests:              [X passed, Y skipped, Z failed]
Typecheck:          [pass | fail]
Build:              [pass | fail]
CI:                 [green | pending | red]
Limitations:        [anything not done and why]
Restricted systems: [treasury, ASA IDs, prod data — confirm untouched]
PR URL:             [URL]
Merge verdict:      [MERGE READY | NEEDS OWNER REVIEW | BLOCKED]
```

## Session Updater — REQUIRED at End of Every Session

Before ending the session, update the Memory Index at `docs/memory/MEMORY_INDEX.md`:

1. Set **Current commit** to the latest SHA on this branch
2. Set **Latest completed PR** if a PR was merged this session
3. Update **Active blocker** — clear it if resolved, add new one if found
4. Update **Owner action now** — one clear next step
5. Set **Last updated** to today's date
6. If the lane is complete and merged, write the closeout to `docs/memory/completed/[PR#]_[lane-slug].md`

> The session updater runs as a final commit on the branch before the PR is marked ready.
> Confirm it ran by checking the last commit message includes `chore: update memory index`.

---

## Priority Order (always)

1. Ownership and funds safety
2. Wallet/auth correctness
3. Duplicate transaction prevention
4. Plot/sub-plot purchase integrity
5. ASA/NFT delivery and reconciliation
6. Token accounting
7. Database/on-chain consistency
8. Refresh/logout/reconnect persistence
9. Mobile Safari and Pera reliability
10. Upgrade and archetype correctness
