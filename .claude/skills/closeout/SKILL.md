---
name: closeout
description: The CLOSE phase of the /ship end-to-end relay (steps 9-11). No longer an interactive standalone command. Derives all handoff fields autonomously from the work done + the self-audit checklist — it does NOT ask the user handoff questions. Escalates to the user ONLY on genuine security/funds ambiguity. Opens exactly one PR into main with an Audit checklist, confirms green, merges, syncs main, rewrites the concise baton (Current -> NEXT), and writes a session note — without pausing for input.
---

# /closeout — close phase (invoked by /ship, not interactive)

> **This is no longer a standalone interactive command.** It is the close phase
> of the single-agent end-to-end relay defined in
> [`/ship`](../ship/SKILL.md) (steps 9-11). It runs autonomously: no handoff
> questions are asked of the user.

In the old inter-chat protocol, `/closeout` ended a chat by asking the user the
handoff questions (what shipped, next priority + branch, open risks, off-limits)
and then opening the PR. That interactive step blocked autonomous runs. The
baton split ([docs/HANDOFF.md](../../../docs/HANDOFF.md)) plus `/ship` now carry
the next-unit info, so those fields are **derived, not asked**.

## When /ship invokes this phase
After step 8 (confirm green) of `/ship`, or any time a unit is fully implemented
and locally green per `check` / `test:server` / `test`.

## Steps (autonomous — no user pause)

### 1. Commit the work and confirm tests are GREEN
- Commit the unit to its branch with conventional messages (include the audit
  report `docs/audits/<branch>.md` and the session note).
- Green must mean what CI means:
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter @workspace/frontier-al run check        # tsc typecheck
  pnpm --filter @workspace/frontier-al run test:server  # vitest server suite
  pnpm --filter @workspace/frontier-al run test         # vitest client suite
  ```
- If anything is red, fix it or **say plainly that it is red** — never open a PR
  claiming green when it is not.

### 2. Derive the handoff fields (do NOT ask the user)
Read the unit's diff, the self-audit checklist (step 5 of `/ship`), and the
concise baton's NEXT section. From these, derive:
1. **What shipped** — the one-line scope, and whether it is test-backed.
2. **Next priority + branch** — from the baton's NEXT / roadmap queue.
3. **Open risks** — anything unreviewed, unfinished, or dangerous.
4. **Off-limits** — what the next unit must not touch (HARD RULES carry forward).

### 3. Update memory only on a durable lesson
If the unit produced a lesson that should outlive it, write it to memory +
`MEMORY.md` pointer. Skip if nothing durable. (No user prompt.)

### 4. Open exactly ONE PR into main
```bash
git push -u origin <branch>
gh pr create --base main --head <branch> --title "<type>: <scope>" --body "<body>"
```
The PR body **must** include an **`## Audit checklist`** mirroring the audit
file (claim → `file:line` evidence → test backing). One open PR at a time.

### 5. Rewrite the concise baton (Current -> NEXT)
Update `docs/HANDOFF.md` (≤80 lines): **Current** = this unit (branch + PR# +
`MERGED`); **Last result** = one screen of what shipped + check counts; **NEXT** =
the derived following unit; **HARD RULES / off-limits** preserved. This change
rides in the same PR so it is reviewed. Final baton commit **without `[skip ci]`**.

### 6. Merge + sync (step 9 of /ship)
```bash
gh pr merge <PR> --squash --delete-branch
git fetch origin && git checkout main && git pull
```

## Escalation
Only escalate to the user for **genuine security/funds/ASA/auth ambiguity** —
e.g. a funds-lane unit missing `USE_INDEPENDENT_AUDITOR=1` (a hard blocker). All
other gaps: make the conservative choice yourself and note the assumption in the
audit file.

## Invariants enforced here
- Exactly one PR per chat; one open PR at a time.
- The baton is rewritten so the next chat knows what's next (no user ask).
- Never over-claim — the PR and baton say "untested" where it is untested.
- The final baton commit never uses `[skip ci]`.
