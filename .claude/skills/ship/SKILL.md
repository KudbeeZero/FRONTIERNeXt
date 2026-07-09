---
name: ship
description: Single end-to-end relay orchestrator. Reads the concise baton (docs/HANDOFF.md), implements exactly one unit of work on a fresh branch off clean origin/main, self-verifies (no subagent), self-audits, opens exactly one PR into main with an Audit checklist, confirms green (or notes local-green fallback), squash-merges, syncs main, and rewrites the concise baton (Current -> NEXT) — all in one continuous run with NO pause for user input, except the funds/ASA/auth exception valve.
---

# /ship — one unit from baton to merged, pushed, green PR

The Session Relay Protocol collapsed into a single continuous run. One agent owns
the whole loop: read baton → implement → self-verify → self-audit → open PR →
confirm green → merge → rewrite baton → push. No inter-chat wait, no separate
auditor subagent for the normal case.

The audit discipline is preserved: instead of an independent subagent re-running
the suite on the *previous* chat's PR, **you** audit your *own* diff before
opening the PR (step 5), citing `file:line` evidence for every claim. The
independent-auditor path is reserved for funds/ASA/auth (the HARD RULES lane) and
is gated behind `USE_INDEPENDENT_AUDITOR=1` (see step 12).

## When to use
- At the **start of every chat** instead of `/handoff-audit` + manual work + `/closeout`.
- Run it once. It does the entire unit. Do not interleave another chat.

## Invariants (never relax)
- **One open PR at a time.** Abort if an open PR into `main` already exists.
- **Nothing lands on `main` unreviewed.** Merge only after green (or the noted
  local-green fallback) and a completed self-audit (or the mandatory second pass
  for funds/ASA/auth).
- **Never over-claim.** A result is "validated" only if a test backs it; say
  "untested" otherwise. "CI is green" and "the fix works" are separate claims —
  verify both and pin the exact head-commit SHA.
- **No `[skip ci]`** on the final baton-rewrite commit.
- **No mock/demo data** introduced anywhere.
- `wip/atomic-purchase` stays unmerged; never touched.
- End of run: `git status` clean AND `git log origin/<branch>..HEAD` empty (the
  container is ephemeral — unpushed work is lost work).

## Steps

### 1. Read the concise baton
Read `docs/HANDOFF.md`. Extract:
- the **Current** unit (if one is mid-flight and not yet merged) or the **NEXT**
  proposed branch + one-line scope;
- the **off-limits** / HARD RULES that must not be touched.
If the baton is ambiguous and it is **not** funds/ASA/auth-related, make the more
conservative choice yourself and note the assumption in the audit file (step 5) —
do **not** stop to ask. Only escalate to the user for genuine funds/ASA/auth
ambiguity.

### 2. Branch off clean origin/main
```bash
git fetch origin
git checkout main && git pull origin main
# abort if origin/main is not clean OR the target branch already exists remotely:
git rev-parse --verify origin/<branch> && { echo "branch exists remotely — abort"; exit 1; }
git checkout -b <branch> origin/main
```
If `origin/main` is not reachable/clean or the branch exists remotely, **abort and
flag** — do not force ahead.

### 3. Implement the unit (failing-first)
- For any behavior change, write a **failing test first**, run it, confirm it
  fails, then implement to make it pass. (Failing-first, not after-the-fact.)
- Keep scope to the single unit named in the baton. Do not bundle unrelated work.
- **Hard scope guard:** never touch game behavior, globe/combat/canvas code, or
  any funds/ASA/on-chain transfer logic (`server/services/chain/`, transaction
  amounts, ASA destinations). If the unit would require touching those, **stop
  and flag** rather than proceeding.

### 4. Self-verify (no subagent) — record exact output
Run, in order, and capture the **exact** pass/fail counts + output for each:
```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/frontier-al run check        # tsc typecheck
pnpm --filter @workspace/frontier-al run test:server  # vitest server suite
pnpm --filter @workspace/frontier-al run test         # vitest client suite
```
If **any** command fails → **stop**. Fix or revert; do **not** proceed to a PR
with red local checks. Record counts; do not delete or skip tests to force green.

### 5. Self-audit your own diff (the embedded checklist)
Before opening the PR, audit the diff yourself (this replaces the independent
subagent for the normal case). For every claim you are about to make in the PR
body, cite `file:line` evidence from the actual diff. Explicitly record:
- **Verified claims** with `file:line` evidence (✅ verified / ⚠️ partial / ❌ false).
- **Tests added / run** — exact commands + pass counts from step 4.
- **Scope-creep check** — diff touches only the stated unit (list the files; flag
  anything outside it).
- **Untested paths** — claims with no test backing (label them, never omit).
- **Security-relevant lines** touched (funds, auth, ASA config, secrets, input
  validation) with severity.
- **Anything you cannot verify** — label it **"NOT verified,"** never omit it.
If any claim is false or a check is red, do not open the PR.
See `docs/audits/README.md` for the required section structure.

### 6. Write the audit report
Write `docs/audits/<branch>.md` using the exact structure in
`docs/audits/README.md` (verdict, claims-vs-evidence, tests, scope-creep,
untested, security, NOT-verified). Verdict is normally **PASS** for a
self-audited non-funds unit; it becomes **FAIL** (block merge) if the diff is
red, over-claims, or is a funds/ASA/auth unit missing the second pass. Commit it
with the unit.

### 7. Open exactly one PR into main
```bash
git push -u origin <branch>
gh pr create --base main --head <branch> --title "<type>: <scope>" --body "<body>"
```
The PR body **must** include a **`## Audit checklist`** section that mirrors the
audit file (claim → `file:line` evidence → test backing). Honest: list what is
test-backed and what is not. One open PR at a time.

### 8. Confirm green (with fallback)
```bash
gh pr checks <PR>
```
- **Non-blocking.** If `gh`/GitHub MCP is unavailable or errors, **do not
  retry-poll**. Trust the local green from step 4, and explicitly note in the
  audit file: *"CI check unavailable, relying on local green"* — so this is never
  silently conflated with a verified CI pass.
- Pin the exact head-commit SHA when you claim green.

### 9. Merge + sync
On green (or the noted fallback):
```bash
gh pr merge <PR> --squash --delete-branch
git fetch origin && git checkout main && git pull
```
(The concise baton rewrite for the following unit — step 10 — is delivered as
part of this PR so it is itself reviewed; after squash-merge, `main` and local are
identical. No direct `main` commit is made; this preserves the "nothing on main
unreviewed / never commit to main directly" invariant.)

### 10. Rewrite the concise baton (Current -> NEXT)
Update `docs/HANDOFF.md` so:
- **Current** = this unit (branch + PR# + `MERGED`);
- **Last result** = one screen describing what shipped + local check counts;
- **NEXT** = the following unit (proposed branch, one-line scope, open risks,
  off-limits), pulled from the roadmap/queue;
- **HARD RULES / off-limits** preserved verbatim.
Keep it ≤80 lines. This change rides in the same PR so it is reviewed. After
merge + sync, `git log origin/main..HEAD` is empty and `git status` is clean.

### 11. Write the session note
Write `artifacts/frontier-al/session-notes/YYYY-MM-DD-<topic>.md` summarizing
what shipped: branch, commit SHA, PR#, CI/local status, tests run + counts, known
risks, next unit + branch, off-limits. Commit it (in the PR).

### 12. Funds/ASA/auth exception valve
If the unit touches **funds / ASA / auth** (any HARD RULES lane), do **NOT**
self-merge on your own audit alone:
- It **must** have `/mainnet-gate` PASS **and** `algo-auditor` PASS.
- The independent second-pass auditor is gated behind
  `USE_INDEPENDENT_AUDITOR=1` (default unset/off). For non-funds work, self-audit
  is normally sufficient.
- **A funds/ASA/auth unit with the flag missing is a BLOCKER, not a skip** — do
  not merge it on self-audit alone. Treat missing flag on a funds-lane unit as a
  hard stop and escalate to the user; run the independent subagent only when the
  flag is explicitly set.

## Ambiguity rule
If you hit an ambiguity that is **not** security/funds-related, make the more
conservative choice yourself and note the assumption in the audit file. Only
escalate to the user for genuine funds/ASA/auth ambiguity.
