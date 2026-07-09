---
name: handoff-audit
description: LEGACY manual audit path. Use when a human wants to independently audit someone else's already-open PR (not the normal /ship flow). For the normal case, its checklist logic is now embedded as step 5 of /ship (the same agent self-audits its own diff before opening the PR). The independent-auditor subagent option is retained here ONLY for the funds/ASA/auth (HARD RULES) exception path, gated behind USE_INDEPENDENT_AUDITOR=1.
---

# /handoff-audit — legacy manual review gate

> **This skill is now mostly superseded by `/ship`.** The normal Session Relay
> loop is a single continuous run: one agent reads the concise baton, implements
> the unit, **self-audits its own diff (step 5 of `/ship`)** before opening the
> PR, merges, and rewrites the baton — with no inter-chat wait and no separate
> auditor for the normal case. See [docs/SESSION_PROTOCOL.md](../../../docs/SESSION_PROTOCOL.md).

This skill remains as:
1. A **legacy manual path** — when a human (the owner) explicitly wants an
   independent audit of someone else's already-open PR, run these steps.
2. The **home of the independent-auditor option** for the funds/ASA/auth
   (HARD RULES) exception path. For those lanes, `/ship` requires a second pass
   from an independent subagent, gated behind `USE_INDEPENDENT_AUDITOR=1` — the
   checklist logic below is what that subagent runs.

## When to use
- A human asks to audit an existing PR manually (not via `/ship`).
- You are running the independent second pass for a funds/ASA/auth unit under
  `USE_INDEPENDENT_AUDITOR=1`.

## Steps (independent-auditor checklist)

### 1. Confirm the PR exists and CI is GREEN
```bash
gh pr view <PR> --json number,headRefName,state,statusCheckRollup
gh pr checks <PR>          # must show the CI check GREEN/passing
```
If CI is red or missing, stop — a red or check-less PR cannot pass audit. (A
missing check usually means the head commit used `[skip ci]`; flag it.)

### 2. Read the diff in full
```bash
gh pr diff <PR>
```
Do **not** trust the PR's own claims. Re-derive the truth from the diff.

### 3. Check every claim with file:line evidence
Mark each ✅ verified / ⚠️ partial / ❌ false. Hunt for:
- **scope creep** (changes outside the stated scope),
- **untested assertions** (claims of "works"/"validated" with no test),
- **security issues** (funds, auth, ASA config, secrets, input validation).
  Anything touching funds/ASA/auth warrants extra scrutiny — invoke
  `algo-auditor` if the diff is Algorand-economic, and require `/mainnet-gate`
  PASS + `algo-auditor` PASS before any merge.

### 4. Run the tests (same as CI)
```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/frontier-al run check        # tsc typecheck
pnpm --filter @workspace/frontier-al run test:server  # vitest server suite
pnpm --filter @workspace/frontier-al run test         # vitest client suite
```
Record the actual output — a claim of "tests pass" without output is itself an
untested assertion.

### 5. State what you could NOT verify
Runtime/on-chain/device gaps — be explicit, label them, never omit.

### 6. Write the audit report
Write `docs/audits/<branch>.md` using the format in
[docs/audits/README.md](../../../docs/audits/README.md). Commit it.

### 7. Emit the verdict
**PASS / CONCERNS / FAIL** (see `docs/audits/README.md` for gate actions). For
the legacy manual path: PASS → the human may merge; CONCERNS → ask; FAIL → do not
merge. For the funds/ASA/auth second pass inside `/ship`: the PR must **not**
self-merge without this PASS.

## Invariants enforced here
- Nothing lands on `main` unreviewed (merge only on PASS).
- One open PR at a time.
- Never over-claim — the audit re-derives truth from the diff and the tests.

## Bootstrap caveat
For the **first** audit (the PR that introduced this protocol), this skill did
not yet exist on `main`. That PR is long merged; today `/ship` is the entry point
and this skill is the manual/exception fallback.
