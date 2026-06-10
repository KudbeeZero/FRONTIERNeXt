---
name: night-shift
description: One autonomous night-shift cycle — read NIGHT_BOARD and NIGHT_QUEUE, build the top-rated item on a claude/night/* branch, verify with check/test/build, push, and update the board. Designed to run on a loop (/loop 30m /night-shift).
---

# /night-shift — Autonomous Build Cycle

Protocol reference: `docs/protocols/OVERNIGHT_HANDOFF_PROTOCOL.md`.
Keep context lean per CLAUDE.md: spawn subagents for investigation; stay in main
context for the edits themselves.

## Hard guardrails — never violated, no exceptions

- **Never** merge to `main` or any shared branch. All work stays on `claude/night/*`.
- **Never** deploy, release, or touch production infrastructure.
- **Never** edit secrets, `.env*` files, or credentials.
- **Never** run database migrations against shared environments.
- **Never** force-push or rewrite history on a branch you didn't create tonight.
- **Never** stop a cycle with failing checks unaddressed — fix, revert, or log a blocker.
- If a step would require any of the above, stop that item, log it as a blocker on the
  board with a pre-framed multiple-choice decision, and move to the next queue item.

## Cycle steps

1. **Read state** (board first, it's short): `artifacts/frontier-al/docs/handoff/NIGHT_BOARD.md`
   then `NIGHT_QUEUE.md`. If an item is marked in-progress on the board, continue it.
   Otherwise pick the highest-rated unstarted item (Highly Recommended → Recommended →
   Experimental). If the queue is empty, update the board's status line and end the cycle.

2. **Branch.** `git fetch origin`, then create or check out the item's
   `claude/night/<item>` branch from `origin/main`.

3. **Build.** Implement the item as specced in its source LUT/doc. Resolve small
   ambiguities sensibly and note the choice on the board; if the ambiguity is
   architectural, treat it as a blocker (guardrail above).

4. **Verify.** From `artifacts/frontier-al/`: `pnpm check`, `pnpm test:server`,
   `pnpm build`. All must pass. A cycle may end mid-item, but never with red checks.

5. **Push.** Commit with a descriptive message and `git push -u origin <branch>`.

6. **Update the board** (always, even on failure):
   - Status line: timestamp, current item, branch, state (building / verified / blocked).
   - Append one line to the cycle log: `HH:MM — <item> — <what happened> — <branch>`.
   - Mark the item's status in the queue (in-progress / done / blocked).
   - Add any new decision for the morning, pre-framed as a multiple-choice question
     with rated options (Highly Recommended option first).
   - Commit the board/queue update on the protocol working branch and push.

## Output to the user

One line: what this cycle did and the board's new status line. No prose reports —
the board and the branches are the record.
