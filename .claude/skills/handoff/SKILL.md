---
name: handoff
description: End-of-day handoff — summarize the day, refresh project memory, populate the rated NIGHT_QUEUE, reset the NIGHT_BOARD. Run once when the day shift wraps.
---

# /handoff — End-of-Day Handoff

Protocol: `docs/protocols/SESSION_HANDOFF_PROTOCOL.md`.

**Step 0 — read the config**: `docs/protocols/handoff.config.md`. All paths below
(`handoff_dir`, `memory_file`, `plan_sources`, `session_notes_dir`) come from it.
If the queue, board, or memory file doesn't exist yet, create it from
`docs/protocols/templates/` before proceeding. Keep context lean: spawn subagents
for any step that reads more than 3 files.

## Steps

1. **Summarize the day.** `git log --oneline` since the handoff base recorded on the
   board (or since this morning if none). Distill to 3-6 bullets of what actually
   shipped. Record the current base commit.

2. **Update the project memory** (`memory_file`): refresh the current-state and
   next-steps sections to reflect today's work. Edit in place, matching the file's
   existing style; do not grow it with a daily log.

3. **Populate the queue** (`NIGHT_QUEUE.md` in `handoff_dir`):
   - Carry over unfinished items (re-rate if today's work changed their risk).
   - Add candidates from `plan_sources`. A candidate qualifies only if it is
     self-contained, specced well enough to build without human input, and
     verifiable with the repo's `verify_commands`.
   - Rate every item **HR / R / EXP**, order top-tier-first. Each row: item,
     one-line description, rating, source doc + section, suggested
     `<branch_prefix>/<item>` branch.
   - Keep the "Not queued (and why)" section honest — guardrail-excluded and
     design-heavy items go there, not in the queue.

4. **Reset the board** (`NIGHT_BOARD.md`): today's date, handoff base commit, day
   summary bullets, queue snapshot (names + ratings only), empty cycle log, empty
   PR watch, blockers, and decisions sections. Note loop state (ON/OFF + restart
   command).

5. **Session note.** If `session_notes_dir` is not `none` and today's work lacks
   one, append a dated file following the existing naming pattern.

6. **Commit** the memory, queue, board, and session-note changes on the current
   working branch with message `handoff: <date> day summary + night queue`, and push.

## Output to the user

The day summary bullets and the top 3 queue items with ratings — nothing longer.
