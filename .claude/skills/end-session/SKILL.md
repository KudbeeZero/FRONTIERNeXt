---
name: end-session
description: Safe-stop + clean handoff. Describes what /ship does at exit — it is not a separate manual ritual. /ship already guarantees: everything committed + pushed (ephemeral container), tests green (or plainly red), a dated session note written, the concise baton rewritten, and main synced. Run /end-session only to VERIFY that end-state and print the report; never re-open a PR or re-merge. If unpushed work remains, push it (retry with backoff) — unpushed work is lost work.
---

# /end-session — the safe-stop guarantee (what /ship does at exit)

> **This is no longer a separate manual ritual.** It describes the end-state that
> [`/ship`](../ship/SKILL.md) already produces: a single continuous run that
> commits, verifies, PRs, merges, rewrites the baton, and pushes — then writes a
> dated session note. Run `/end-session` to **verify** that end-state, not to
> redo it.

The container is **ephemeral** — anything not committed and pushed is lost when
it is reclaimed. `/ship` ends every run in this state; `/end-session` confirms it
and prints the report.

## When to use
- At the **end of a session** to confirm the safe stop and print the report.
- Passed automatically by `/ship` at exit (the "guarantee" below is the last
  thing `/ship` does).

## What /ship already guarantees at exit (verify these)
1. **Everything committed + pushed.** No uncommitted/untracked work; the branch
   is pushed and the PR is merged into `main` (or, if the unit was parked,
   the PR is open and the baton reflects it).
2. **Tests GREEN** (or plainly red). `check` / `test:server` / `test` run and
   recorded; a result is never claimed "works" without a test behind it.
3. **Dated session note** written to
   `artifacts/frontier-al/session-notes/YYYY-MM-DD-<topic>.md`: branch, head SHA,
   PR# + link + CI status, tests run + counts, known risks, next unit + branch,
   off-limits. (If nothing changed, still write a truthful no-op note.)
4. **Concise baton rewritten** (`docs/HANDOFF.md`, ≤80 lines): Current -> NEXT,
   off-limits preserved, no `[skip ci]` on the final commit.
5. **Local == GitHub.** `git status` clean and
   `git fetch && git log origin/main..HEAD` empty — the website the owner sees is
   exactly what is local.

## Steps (verification only — do not re-PR or re-merge)

### 1. Take stock
```bash
git status -s
git branch --show-current
git fetch && git log origin/main..HEAD --oneline
```
- Clean tree + empty `origin/main..HEAD` ⇒ safe to stop.
- **Unpushed commits** ⇒ `git push` (retry with backoff 2s/4s/8s/16s). Unpushed
  work is lost work.
- **Unmerged open PR** ⇒ do not open a duplicate. Push new commits onto it and
  update its body in place; confirm CI; ensure the baton points at it.

### 2. Confirm green (green means what CI means)
```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/frontier-al run check
pnpm --filter @workspace/frontier-al run test:server
pnpm --filter @workspace/frontier-al run test
```
If red, **say so plainly** — never report a clean stop on red.

### 3. Print the end-of-session report
- **Shipped:** the unit(s) — each test-backed or untested?
- **PR:** number + link + CI status (merged/open).
- **Next:** next unit + proposed branch (from the rewritten baton).
- **Open risks / off-limits:** anything unreviewed, unfinished, or dangerous;
  what the next chat must not touch.

## Invariants this preserves
- **Nothing lost:** committed + pushed before stopping (ephemeral container).
- **One open PR at a time:** never opens a duplicate; finishes the current relay.
- **Nothing lands on `main` unreviewed**, and the baton is left **truthful** —
  never over-claim; mark untested work as untested.
