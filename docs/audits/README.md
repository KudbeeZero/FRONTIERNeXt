# Audits

One independent audit report per PR, written by the `/handoff-audit` skill at the
**start** of the chat that reviews the previous chat's PR.

- **File name:** `docs/audits/<branch>.md` — the branch of the PR being audited.
- **Author:** an independent auditor subagent that does **not** trust the PR's
  own claims. It re-derives the truth from the diff, the tests, and the code.

## Required contents

| Section | What it must contain |
|---------|----------------------|
| **Verdict** | `PASS` / `CONCERNS` / `FAIL` — one line, up top. |
| **PR / branch / commit** | What was audited (PR #, branch, head SHA). |
| **Claims vs. evidence** | Each claim from the PR body / baton, checked against the diff with `file:line` evidence. Mark each ✅ verified / ⚠️ partial / ❌ false. |
| **Tests** | The exact commands run and their result (see below). "Green" must mean what CI means. |
| **Scope creep** | Anything changed that the stated scope did not cover. |
| **Untested assertions** | Claims of "works"/"validated" with no test backing them. |
| **Security** | Anything touching funds, auth, ASA config, secrets, or input validation — flagged with severity. |
| **What I could NOT verify** | Runtime/on-chain/device gaps; be explicit. |

## Verdict meaning (the gate)

| Verdict | Meaning | Gate action |
|---------|---------|-------------|
| **PASS** | No CRITICAL/HIGH issues; claims match the diff; tests green. | Merge the PR, sync `main`, start the next branch. |
| **CONCERNS** | Real issues short of blocking, or a claim that overstates. | Stop and ask the user. |
| **FAIL** | CRITICAL/HIGH issue, false claim, or red tests. | Do **not** merge. Report. |

## Tests to run (must match CI)

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/frontier-al run check        # tsc typecheck
pnpm --filter @workspace/frontier-al run test:server  # vitest server suite
pnpm --filter @workspace/frontier-al run test         # vitest client suite
```

Record the actual output, not a paraphrase. A passing run is the evidence; a
claim of "tests pass" without the output is itself an untested assertion.
