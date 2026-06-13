---
name: end-session
description: Run at the END of a working session to stop safely and leave a clean handoff. The umbrella "I'm done" command — takes stock of session state (uncommitted work, current branch, open/merged PR, CI), then routes: if this session's unit isn't wrapped yet it runs the /closeout flow (commit, green tests, exactly ONE PR into main with an Audit checklist, rewrite the baton to AWAITING_AUDIT); if the unit is already PR'd/merged it verifies state without opening a duplicate PR. Always guarantees everything is committed + pushed (the container is ephemeral), confirms tests are green (or says plainly they are red), writes a dated session note, and prints a tidy end-of-session report (what shipped + is it test-backed, PR link + status, next unit + branch, open risks, off-limits). Meant to be run every session — call it each time you finish.
---

# /end-session — safe stop + clean handoff

The one command to run when you're done for the session. The container is
**ephemeral** — anything not committed and pushed is lost when it's reclaimed.
This skill makes "stop now" safe and leaves the next chat a truthful baton.

It is the **umbrella** over the [Session Relay Protocol](../../../docs/SESSION_PROTOCOL.md):
it does not reinvent the close — it detects what state the session is in and
delegates the heavy lifting to [`/closeout`](../closeout/SKILL.md), then adds the
session-level wrap (state routing, a dated session note, and a final report).

## When to use
- At the **end of every working session** (this is a recurring command — run it
  each time you finish, even if you "didn't change much").
- When you need to step away and want a guaranteed safe stop with nothing lost.

> Not the same as `/closeout`: `/closeout` always wants to open one PR.
> `/end-session` first figures out whether that's the right move (you may have
> already PR'd or merged this session's unit) and avoids opening a duplicate.

## Steps

### 1. Take stock of the session (don't act yet)
Gather the facts first:
```bash
git status -s                 # uncommitted / untracked work?
git branch --show-current     # which branch are we on?
git log --oneline origin/main..HEAD   # unpushed / un-merged commits?
```
Then check GitHub (via the GitHub MCP tools — no `gh` in this environment):
- Is there an **open PR** for this branch? What's its **CI status**?
- Has this session's unit **already merged**?

### 2. Route on the state
- **Uncommitted or unpushed work, and no PR yet for this unit** → run the
  **`/closeout`** flow end-to-end: commit, confirm green, open **exactly one** PR
  into `main` with an `## Audit checklist`, rewrite the baton to `AWAITING_AUDIT`,
  final baton commit **without `[skip ci]`**.
- **A PR is already open for this unit** → do **not** open a second (one open PR
  at a time). Make sure all work is committed + pushed onto that PR's branch,
  confirm its CI, and that the baton points at it.
- **This session's unit already merged** → confirm the merge, ensure the baton
  reflects reality for the next chat (note owner-merged PRs as audit-waived if
  that's what happened, mirroring prior `#17`/`#18` notes), and **don't** open a
  new PR unless you started a fresh unit of work.
- **Nothing was changed this session** → say so plainly; just verify the tree is
  clean and the baton is still accurate. No PR, no empty commit.

### 3. Guarantee nothing is lost
Everything for this session must be **committed and pushed** before you stop —
the container will not survive. If the push fails on a network error, retry with
backoff (2s, 4s, 8s, 16s).

### 4. Confirm tests are GREEN (green means what CI means)
```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/frontier-al run check        # tsc typecheck
pnpm --filter @workspace/frontier-al run test:server  # vitest server suite
pnpm --filter @workspace/frontier-al run test         # vitest client suite
```
If anything is red, **say so plainly** — never report a clean stop on red, and
never claim a result "works" without a test behind it (say "untested" when it is).

### 5. Write a dated session note
Per the app convention, add a new file under
`artifacts/frontier-al/session-notes/` (e.g. `YYYY-MM-DD-<short-topic>.md`) with:
what shipped, what's verified vs untested, and any durable lesson. If the lesson
should outlive the session, also add a one-line pointer to memory. Skip only if
the session truly produced nothing worth recording.

### 6. Print the end-of-session report
End with a short, honest report:
- **Shipped:** the unit(s) this session — and is each **test-backed** or untested?
- **PR:** number + link + **CI status** (and merged/open).
- **Next:** the next unit + proposed branch (from the rewritten baton).
- **Open risks / off-limits:** anything unreviewed, unfinished, or dangerous; what
  the next chat must not touch.

## Invariants this preserves
- **Nothing lost:** committed + pushed before stopping (ephemeral container).
- **One open PR at a time:** never opens a duplicate; finishes the current relay.
- **Nothing lands on `main` unreviewed**, and the baton is left **truthful** —
  never over-claim; mark untested work as untested.

## Recurring use
This is designed to be run at the **end of every session**. If you want a
periodic status re-check while a PR is in flight (CI/review), you can drive a
recheck on an interval with [`/loop`](../loop/SKILL.md) (e.g. `/loop 30m` with a
status-check prompt) — but the safe-stop itself is a manual, once-per-session
call, not a background timer.
