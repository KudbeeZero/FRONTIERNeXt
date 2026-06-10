---
name: handoff
description: End-of-day handoff — summarize the day's commits, update PROJECT MEMORY, populate the rated NIGHT_QUEUE, and reset the NIGHT_BOARD for tonight's autonomous shift. Run once when the day shift wraps.
---

# /handoff — End-of-Day Handoff

Protocol reference: `docs/protocols/OVERNIGHT_HANDOFF_PROTOCOL.md`.
Keep context lean per CLAUDE.md: spawn subagents for any step that reads more than 3 files.

## Steps

1. **Summarize the day.** `git log --oneline` since the last handoff date recorded on
   `artifacts/frontier-al/docs/handoff/NIGHT_BOARD.md` (or since this morning if none).
   Distill to 3-6 bullet points of what actually shipped.

2. **Update PROJECT MEMORY.** In `artifacts/frontier-al/docs/PROJECT MEMORY.md`, refresh
   the current-state and next-steps sections to reflect today's work. Edit in place,
   matching the file's existing style; do not grow it with a daily log.

3. **Populate the queue.** Rewrite `artifacts/frontier-al/docs/handoff/NIGHT_QUEUE.md`:
   - Carry over unfinished items from the previous queue (re-rate them if today's work
     changed their risk).
   - Add new candidates from the LUTs in `artifacts/frontier-al/docs/` and
     `docs/backlog/`. A candidate qualifies only if it is self-contained, specced well
     enough to build without human input, and verifiable with the repo's check/test/build.
   - Rate every item **Highly Recommended / Recommended / Experimental** and order the
     table top-tier-first. Each row: item, one-line description, rating, source doc +
     section, suggested `claude/night/<item>` branch name.

4. **Reset the board.** Rewrite `artifacts/frontier-al/docs/handoff/NIGHT_BOARD.md` for
   tonight: today's date, handoff commit hash, day summary (the bullets from step 1),
   queue snapshot (item names + ratings only), empty cycle log, empty blockers and
   decisions sections.

5. **Session note.** Append a dated file in `artifacts/frontier-al/session-notes/`
   following the existing naming pattern, if today's work doesn't already have one.

6. **Commit** the memory, queue, board, and session-note changes on the current working
   branch with message `handoff: <date> day summary + night queue`.

## Output to the user

End with the day summary bullets and the top 3 queue items with ratings — nothing longer.
