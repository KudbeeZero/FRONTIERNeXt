---
name: morning
description: Day-shift pickup — read the NIGHT_BOARD, deliver a five-line brief of what the night shift built, and surface each waiting decision as a multiple-choice question with rated options. Run once when the day shift returns.
---

# /morning — Day-Shift Pickup

Protocol reference: `docs/protocols/OVERNIGHT_HANDOFF_PROTOCOL.md`.

## Steps

1. **Read the board**: `artifacts/frontier-al/docs/handoff/NIGHT_BOARD.md`. That file is
   the whole night in under 30 seconds; only open queue items or branches if the board
   leaves a genuine question.

2. **Brief the user in five lines or fewer:**
   - cycles run and items completed (with their `claude/night/*` branches),
   - what's still in flight,
   - what's blocked,
   - anything the night shift flagged as Experimental,
   - whether the loop is still running or needs restarting (`/loop 30m /night-shift`).

3. **Surface decisions.** For each entry in the board's "Decisions waiting" section, use
   the AskUserQuestion tool with the night shift's pre-framed options, rated tiers in the
   labels, Highly Recommended option first. Never present decisions as prose paragraphs.

4. **Apply the answers**: update the queue/board accordingly (e.g. unblock an item,
   re-rate it, or drop it), and note any branch the user wants reviewed or merged —
   merging itself stays a day-shift, human-approved action.

## Output to the user

The five-line brief, then the questions. Nothing else.
