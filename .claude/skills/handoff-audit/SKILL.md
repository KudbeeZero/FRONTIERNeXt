---
name: handoff-audit
description: Run at the START of a chat. Reads the baton (docs/HANDOFF.md) + memory, confirms the previous chat's PR exists and its CI is green, then spawns an INDEPENDENT auditor subagent that checks the diff against every claim (file:line evidence), runs the test suite, and looks for scope creep / untested assertions / security issues, emitting PASS / CONCERNS / FAIL. Writes docs/audits/<branch>.md and gates the merge — PASS merges the prev PR and starts this chat's branch, CONCERNS asks the user, FAIL does not merge.
---

# /handoff-audit — start-of-chat review gate

Implements the START half of the [Session Relay Protocol](../../../docs/SESSION_PROTOCOL.md).
The previous chat's work arrives as a PR that claims to be done. **Do not trust
those claims.** Verify them, independently, before anything merges.

## When to use
- At the **start of every chat**, before doing any new work.
- The SessionStart hook nudges you when the baton shows `AWAITING_AUDIT`.

## Steps

### 1. Read the baton + memory
- Read `docs/HANDOFF.md` — the **Current baton** (branch, PR#, audit status) and
  the previous chat's "What this chat did (for the auditor)".
- Read memory (`/home/dziostar/.claude/projects/-mnt-c-ECC/memory/MEMORY.md` +
  relevant files) for durable context, prior risks, and standing user feedback.
- If audit status is **not** `AWAITING_AUDIT`, there is nothing to audit — say so
  and proceed to this chat's planned work.

### 2. Confirm the PR exists and CI is GREEN
```bash
gh pr view <PR> --json number,headRefName,state,statusCheckRollup
gh pr checks <PR>          # must show the CI check GREEN/passing
```
If CI is **red or missing**, stop — a red or check-less PR cannot pass audit.
(A missing check usually means the head commit used `[skip ci]`; flag it.)

### 3. Spawn an INDEPENDENT auditor subagent (Agent tool)
Launch a subagent whose job is to **refute the PR**, not confirm it. Pass it:
- the PR number, branch, and head SHA;
- the PR body + the baton's "what this chat did";
- this instruction set.

The auditor must:
- Pull the diff (`gh pr diff <PR>`) and read it in full.
- Check **every claim** in the PR body / baton against the diff with concrete
  `file:line` evidence. Mark each ✅ verified / ⚠️ partial / ❌ false.
- **Run the tests** (same as CI — green must mean what CI means):
  ```bash
  pnpm install --frozen-lockfile
  pnpm --filter @workspace/frontier-al run check        # tsc typecheck
  pnpm --filter @workspace/frontier-al run test:server  # vitest server suite
  pnpm --filter @workspace/frontier-al run test         # vitest client suite
  ```
  Record the actual output.
- Hunt for **scope creep** (changes outside the stated scope), **untested
  assertions** (claims of "works"/"validated" with no test), and **security
  issues** (funds, auth, ASA config, secrets, input validation). Anything
  touching funds/ASA/auth warrants extra scrutiny — invoke `algo-auditor` if the
  diff is Algorand-economic.
- State **what it could NOT verify** (runtime/on-chain/device gaps).
- Emit a single verdict: **PASS / CONCERNS / FAIL**.

### 4. Write the audit report
Write the auditor's findings to `docs/audits/<branch>.md` using the format in
[docs/audits/README.md](../../../docs/audits/README.md). This file is part of the
audit trail — commit it.

### 5. Gate on the verdict
- **PASS** → merge the previous PR, sync `main`, and start this chat's branch:
  ```bash
  gh pr merge <PR> --squash --delete-branch
  git checkout main && git pull origin main
  git checkout -b <this-chat-branch>
  ```
- **CONCERNS** → **stop and ask the user.** Present the concerns; do not merge.
- **FAIL** → do **not** merge. Report the failing evidence and ask for direction.

## Invariants enforced here
- Nothing lands on `main` unreviewed (merge only on PASS).
- One open PR at a time (audit + merge the prev PR before opening a new one).
- Never over-claim — the audit re-derives truth from the diff and the tests.

## Bootstrap caveat
For the **first** audit (the PR that introduces this protocol), this skill does
not yet exist on `main`. Run the audit with the protocol branch checked out, or
perform the steps above manually. The protocol self-activates after PR #1 merges.
