---
name: closeout
description: Run at the END of a chat. Ensures the work is committed and the tests are green, asks the handoff questions (what shipped, next priority + branch, open risks, off-limits), updates memory if there is a durable lesson, opens exactly ONE PR into main with an Audit checklist for the next chat, and rewrites the baton (docs/HANDOFF.md) to AWAITING_AUDIT. The final baton commit must NOT use [skip ci], or the PR head has no CI check and the next audit cannot confirm green.
---

# /closeout — end-of-chat wrap into one auditable PR

Implements the END half of the [Session Relay Protocol](../../../docs/SESSION_PROTOCOL.md).
The output of a chat is **one mergeable, auditable PR** plus a rewritten baton.

## When to use
- At the **end of every chat**, once this chat's unit of work is done (or being
  parked).

## Steps

### 1. Commit the work and confirm tests are GREEN
- Commit everything for this unit of work to **this chat's branch** (conventional
  commit messages).
- Run the suite and confirm it passes — green must mean what CI means:
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter @workspace/frontier-al run check        # tsc typecheck
  pnpm --filter @workspace/frontier-al run test:server  # vitest server suite
  pnpm --filter @workspace/frontier-al run test         # vitest client suite
  ```
- If anything is red, fix it or **say plainly that it is red** — never open a PR
  claiming green when it is not.

### 2. Ask the handoff questions
Ask the user (or fill in from the chat if unambiguous):
1. **What shipped** this chat (the one-line scope, and is it test-backed)?
2. **Next priority + branch** for the following chat.
3. **Open risks** — anything unreviewed, unfinished, or dangerous.
4. **Off-limits** — what the next chat must not touch.

### 3. Update memory if there's a durable lesson
If this chat produced a lesson that should outlive it (a recurring bug's root
cause, a confirmed approach, a standing user preference), write it to memory and
add the one-line pointer to `MEMORY.md`. Skip if nothing durable.

### 4. Open exactly ONE PR into main
```bash
git push -u origin <this-chat-branch>
gh pr create --base main --head <this-chat-branch> --title "<type>: <scope>" --body "<body>"
```
The PR body **must** include an **## Audit checklist** — the concrete things the
next chat's `/handoff-audit` should verify (claim → how to check it). Be honest:
list what is test-backed and what is not.

> One open PR at a time. If a previous PR is still open and unaudited, do not open
> a second — finish that relay first.

### 5. Rewrite the baton
Update `docs/HANDOFF.md`:
- **Current baton:** this branch + the new PR# + `AWAITING_AUDIT`.
- **What this chat did (for the auditor):** short, claim-oriented.
- **NEXT chat:** proposed branch, one-line scope, open risks, off-limits.

Keep it short — a baton, not a log.

### 6. Commit the baton — NO `[skip ci]`
```bash
git add docs/HANDOFF.md docs/audits/ <other>
git commit -m "docs: update baton for <branch> (AWAITING_AUDIT)"
git push
```
**Critical:** the final baton commit must **not** contain `[skip ci]`. If it
does, the PR head commit has no CI check, and the next chat's `/handoff-audit`
cannot confirm green — which breaks the gate. Let CI run on the head commit.

## Invariants enforced here
- Exactly one PR per chat; one open PR at a time.
- The baton is rewritten so the next chat knows what's next.
- Never over-claim — the PR and baton say "untested" where it is untested.
