# Audits

One audit report per PR. **By default, the audit is performed by the same agent
that did the work, as an embedded step of `/ship`** (step 5) — it audits its own
diff and cites `file:line` evidence for every claim before opening the PR, with
no inter-chat wait and no separate subagent for the normal case.

- **File name:** `docs/audits/<branch>.md` — the branch of the PR being audited.
- **Author (default):** the working agent itself, via `/ship` step 5 (self-audit).
- **Author (funds/ASA/auth lane only):** an **independent auditor subagent**, used
  **only** for changes touching the HARD RULES lane (funds / ASA / auth), and
  gated behind the env flag `USE_INDEPENDENT_AUDITOR=1` (default unset/off). For
  those lanes the self-audit alone is **not** sufficient to merge — the flag must
  be set and the second pass must PASS (plus `/mainnet-gate` PASS + `algo-auditor`
  PASS). A funds-lane unit missing the flag is a **blocker**, not a skip.

> Legacy manual path: the independent-auditor checklist still lives in
> [`.claude/skills/handoff-audit/SKILL.md`](../.claude/skills/handoff-audit/SKILL.md)
> for when a human wants to audit an existing PR directly.

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
