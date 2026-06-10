---
name: shift-audit
description: End-of-shift audit — verify guardrails held with evidence, list review-ready deliverables, capture lessons, write SHIFT_AUDIT_<date>.md. Run at shift end or on owner request.
---

# /shift-audit — End-of-Shift Audit

Protocol: `docs/protocols/SESSION_HANDOFF_PROTOCOL.md`.

**Step 0 — read the config**: `docs/protocols/handoff.config.md` for `handoff_dir`,
`workdir`, `verify_commands`, `branch_prefix`.

## Steps

1. **Stop the loop** if it's running (note how to restart on the board).

2. **Audit deliverables.** For every branch/PR created this shift: confirm it's
   pushed and in sync with origin, and record its contents (one line + diff size)
   and verification evidence. Re-run `verify_commands` on anything the board claims
   verified but has no recorded evidence for.

3. **Audit guardrails — with evidence, not memory:**
   - shared-branch base unchanged (`git log origin/main` vs the handoff base),
   - `git diff` across shift branches shows no `.env*`/secret/credential/migration
     touches,
   - no force-pushes; only branches created this shift were written,
   - working tree clean, board updated through the last cycle.
   Any violation goes on the board as a flagged incident — never bury it.

4. **Capture incidents & lessons.** Each one: what happened, time lost, the rule
   adopted. Promote durable rules to `agent-memory.md` L4 and, if they change how a
   skill should behave, propose the skill edit.

5. **Write the audit** to `SHIFT_AUDIT_<date>.md` in `handoff_dir` from
   `docs/protocols/templates/SHIFT_AUDIT.template.md`, update the board's status
   line to point at it, commit on the working branch, and push.

## Output to the user

Five lines max: shift result (cycles, items done), guardrail verdict, deliverables
awaiting review, lessons adopted, restart command.
