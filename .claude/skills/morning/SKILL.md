---
name: morning
description: Day-shift pickup — read the NIGHT_BOARD, deliver a five-line brief of what the night shift built, and surface each waiting decision as a multiple-choice question with rated options. Run once when the day shift returns.
---

# /morning — Day-Shift Pickup

Protocol: `docs/protocols/SESSION_HANDOFF_PROTOCOL.md`.

**Step 0 — read the config**: `docs/protocols/handoff.config.md` for `handoff_dir`
and `pr_policy`.

## Steps

1. **Read the board**: `NIGHT_BOARD.md` in `handoff_dir`. That file is the whole
   night in under 30 seconds; only open queue items, branches, or PRs if the board
   leaves a genuine question.

2. **Brief the user in five lines or fewer:**
   - cycles run and items completed (with branches and any PRs opened),
   - what's still in flight,
   - what's blocked,
   - anything flagged Experimental or any PR-watch item needing attention,
   - whether the loop is still running or needs restarting (`/loop 30m /night-shift`).

3. **Surface decisions.** For each entry in "Decisions waiting", use the
   AskUserQuestion tool with the night shift's pre-framed options, rated tiers in
   the labels, Highly Recommended option first. Never present decisions as prose.

4. **Apply the answers**: update the queue/board (unblock, re-rate, or drop items),
   and note any branch or PR the user wants reviewed or merged — merging stays a
   day-shift, human-approved action. Hand watched PRs needing follow-through to
   `/pr-shepherd`.

## Output to the user

The five-line brief, then the questions. Nothing else.
