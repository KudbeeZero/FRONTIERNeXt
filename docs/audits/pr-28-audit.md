# Audit — PR #28 `claude/kestra-automation-factory-06fr1h` (AUTO-001 architecture)

**Verdict: PASS**

## Summary
PR #28 is a genuinely **docs-only** unit delivering the AUTO-001 GrowPod Empire
Automation Factory architecture blueprint (4 design docs) plus the start-of-chat
audit trail and an updated baton. An independent audit panel (3 parallel auditors
covering PR-state/CI/deps, docs-scope/kestra/risk, and protocol/baton/handoff/next)
re-derived the truth from the diff, the tree, and live CI. No code, YAML, or
dependency changes; `ops/kestra/` is byte-for-byte untouched; no over-claiming;
all cross-links resolve; mainnet/testnet guardrails restated, none weakened; the
one-open-PR invariant holds and the baton is accurate. **CI is green on the head.**

## Scope reviewed
- Diff vs base (`origin/main daebfbc … HEAD 9d95adb`).
- The 4 new architecture docs + the baton + the committed #27 re-audit report.
- `.github/workflows/ci.yml` trigger behavior and the live check runs on the head.
- CLAUDE.md, docs/SESSION_PROTOCOL.md, ops/kestra/README.md, and the existing
  `frontier.ops` flows (to validate the ACTIVE/PLANNED mapping).

## Evidence
- **Scope (PASS):** `git diff origin/main...HEAD --name-only` → all 6 paths under
  `docs/`. `grep -v '^docs/'` → none. No `package.json`/`pnpm-lock.yaml` in diff.
- **`ops/kestra/` untouched (PASS):** `git diff origin/main...HEAD -- ops/kestra`
  empty. Docs explicitly state flows are preserved/not moved
  (`AUTOMATION_FACTORY_ARCHITECTURE.md:270`, `KESTRA_EXPANSION_PLAN.md:9,91-92`,
  `FACTORY_REGISTRY.md:18`).
- **No over-claim (PASS):** PLANNED/untested framing throughout
  (`ARCHITECTURE.md:3,6-10`; `AGENT_CHAIN_OF_AUTHORITY.md:3,7-9`;
  `KESTRA_EXPANSION_PLAN.md:3,8-10`). F5 ACTIVE / F4 PARTIALLY ACTIVE mapping
  verified against the real flows + cron schedules (`uptime` 1m, `deep-health`
  5m, `veritas-grind` 30m, `severity-router` shared subflow). The "hardcoded
  subflow `namespace: frontier.ops`" claim is true
  (`uptime.yml:45,58,72`; `deep-health.yml:40,54,71`; `veritas-grind.yml:62,76`).
- **Links (PASS):** all referenced targets exist (SESSION_PROTOCOL,
  MAINNET_READINESS_FLOW, ../ops/kestra/README.md, sibling docs,
  artifacts/frontier-al/CLAUDE.md). No broken link.
- **Guardrails (PASS):** "nothing in `ops/kestra/` may point at mainnet" +
  "testnet only" + double-gate restated (`ARCHITECTURE.md:206,277,280-282`;
  `AGENT_CHAIN_OF_AUTHORITY.md:92-93`), consistent with `ops/kestra/README.md:8-9`.
  "Existing gate wins" — no loosening.
- **Protocol / one-open-PR (PASS):** `git merge-base --is-ancestor origin/main
  HEAD` exit 0 (rebased on top, not divergent); HEAD == PR head `9d95adb`;
  `mergeable_state: clean`; #28 is the only open PR.
- **Baton (PASS):** names #28 AWAITING_AUDIT (`HANDOFF.md:8-10`); #26 (`9da5f5f`)
  and #27 (`a1dc9ab`) merged+PASS, both verified ancestors of `origin/main`;
  ID-001…ID-004 roadmap intact; clear NEXT.
- **No `[skip ci]` (PASS):** `git log --format='%s' origin/main..HEAD` — none of
  the 3 commits carry `[skip ci]`.

## Files changed
| File | Type |
|------|------|
| `docs/AUTOMATION_FACTORY_ARCHITECTURE.md` | new (305+) |
| `docs/AGENT_CHAIN_OF_AUTHORITY.md` | new (143+) |
| `docs/KESTRA_EXPANSION_PLAN.md` | new (164+) |
| `docs/FACTORY_REGISTRY.md` | new (101+) |
| `docs/audits/claude-actions-idempotency-extend-2qpwrn.md` | new (#27 re-audit) |
| `docs/HANDOFF.md` | modified (baton) |

## CI observations
- **Correction to the handoff's assumption:** `.github/workflows/ci.yml` uses a
  bare `on: pull_request:` with **no `paths:`/`paths-ignore:` filter**, so it
  **does** run on docs-only PRs. The handoff's "ci.yml expected not to run" was
  wrong.
- **Actual result on head `9d95adb` (both green):**
  - `Typecheck & server tests` → **success**.
  - `Cloudflare Pages` → **success**.
- So a code-test run was correctly expected and it **passed** — stronger evidence
  than the "docs-only ⇒ no code CI" framing.

## Findings
- **Informational:** no `docs/MEMORY.md` exists in the repo (the handoff asked to
  read it). The baton is the source of truth; the protocol does not require a file
  at that path. Not a blocker.
- **Resolved CONCERNS:** the CI-axis CONCERNS (assumption that code tests would
  not run) is resolved — the tests ran and passed on the head.
- No CRITICAL/HIGH issues. No false claims. No scope creep.

## Recommendation
Merge PR #28. For the next unit, pick **exactly one**: the independent panel and
the owner priority order both favor **ID-003 `feat/idempotency-stable-nonce`
(HIGH)** — it finishes the double-submit defense (idempotency is currently
replay-only, the top open risk) on already-merged infrastructure. AUTO-001
Phase-1 (`chore/kestra-namespace-prep`, MEDIUM) is a coherent alternative and can
follow.

## Verdict
**PASS** → merge; set NEXT to a single unit (ID-003).
