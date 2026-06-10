---
name: night-shift
description: One autonomous night-shift cycle — read NIGHT_BOARD and NIGHT_QUEUE, build the top-rated item on a dedicated branch, verify, push, and update the board. Designed to run on a loop (/loop 30m /night-shift).
---

# /night-shift — Autonomous Build Cycle

Protocol: `docs/protocols/SESSION_HANDOFF_PROTOCOL.md`.

**Step 0 — read the config**: `docs/protocols/handoff.config.md` for `handoff_dir`,
`workdir`, `baseline_command`, `verify_commands`, `branch_prefix`, `pr_policy`, and
repo-specific hard rules. Spawn subagents for investigation; stay in main context
for the edits themselves.

## Hard guardrails — never violated, no exceptions

- **Never** merge to `main` or any shared branch. All work stays on `<branch_prefix>/*`.
- **Never** deploy, release, or touch production infrastructure.
- **Never** edit secrets, `.env*` files, or credentials.
- **Never** run database migrations against shared environments.
- **Never** force-push or rewrite history on a branch you didn't create tonight.
- **Never** stop a cycle with failing checks unaddressed — fix, revert, or log a blocker.
- **Never** merge a PR. Opening one is allowed only if `pr_policy` permits.
- If a step would require any of the above: stop the item, log it as a blocker on
  the board with a pre-framed multiple-choice decision, move to the next item.

## Cycle steps

1. **Read state** (board first, it's short): `NIGHT_BOARD.md` then `NIGHT_QUEUE.md`
   in `handoff_dir`. Concurrency check: if the board shows another live loop checked
   in within its cadence window, end this cycle without building. If an item is
   in-progress, continue it; otherwise pick the highest-rated unstarted item
   (HR → R → EXP) and mark it in-progress on the board **before** building. Empty
   queue: update the status line and end the cycle.

2. **Verify-first.** Check the item's claim against the actual code — plans go
   stale. If the work already shipped, mark the item done ("verified already
   shipped, no code needed") with `file:line` evidence and pick the next item.

3. **Branch.** `git fetch origin`, then create or check out `<branch_prefix>/<item>`
   from `origin/main`. Before touching dependencies, run `baseline_command` to
   establish a clean baseline.

4. **Build** the item as specced in its source doc. Resolve small ambiguities
   sensibly and note the choice on the board; architectural ambiguity is a blocker
   (guardrail above).

5. **Verify.** From `workdir`, run every command in `verify_commands`. All must
   pass. A cycle may end mid-item, but never with red checks.

6. **Push** with a descriptive commit and `git push -u origin <branch>` (retry with
   backoff on network failure). If `pr_policy` is `draft-prs`/`ready-prs`, open the
   PR per protocol §6 (spec linked, verification evidence pasted, rating in title)
   and add it to the board's PR WATCH.

7. **Update the board** (always, even on failure):
   - Status line: timestamp, current item, branch, state (building / verified / blocked).
   - One cycle-log line: `HH:MM — <item> — <what happened> — <branch>`.
   - Item status in the queue (in-progress / done / blocked).
   - Any new decision for the morning, pre-framed multiple-choice, rated options,
     Highly Recommended first.
   - If main moved during the shift, log it; rebase only branches created tonight.
   - Commit the board/queue update on the protocol working branch and push.

## Output to the user

One line: what this cycle did and the board's new status line. No prose reports —
the board and the branches are the record.
