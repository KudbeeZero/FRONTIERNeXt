# Session Relay Protocol

> The container is ephemeral. Treat every chat as **one reviewed PR**, and make
> the handoff between chats an **audited artifact, not trust**.

This repo is worked on across many short-lived chat sessions in disposable
containers. Nothing about a chat survives except what it commits and pushes.
The Session Relay Protocol turns that constraint into a discipline: each chat is
a single, mergeable, independently-audited unit of work, and the only thing
passed between chats is a small, verifiable **baton**.

The old flow ran the loop across two chats: chat N audited chat N-1's PR, then
chat N+1 merged it — a full chat of latency and an independent subagent re-running
the suite on someone else's work. **That latency is now removed:** one agent runs
the entire loop in a single continuous `/ship` run, self-auditing its own diff
before opening the PR. No inter-chat wait, no separate auditor for the normal
case.

---

## The single-agent end-to-end loop (`/ship`)

```
   START ──▶ read concise baton (docs/HANDOFF.md)
            │   extract unit + target branch
            ▼
         git fetch + branch off clean origin/main
            ▼
         implement ONE unit (failing-first test for behavior changes)
            ▼
         self-verify (no subagent): install --frozen-lockfile · check · test:server · test
            ▼
         self-audit own diff (step 5): cite file:line evidence for every claim,
            scope-creep / untested / security / NOT-verified; write docs/audits/<branch>.md
            ▼
         open EXACTLY ONE PR into main  (## Audit checklist in body)
            ▼
         confirm green (gh pr checks; fallback: trust local green, note it explicitly)
            ▼
         gh pr merge --squash --delete-branch  ·  fetch + checkout main + pull
            ▼
   END ───▶ rewrite concise baton (Current -> NEXT) · push (no [skip ci]) · session note
```

The full procedure lives in [`.claude/skills/ship/SKILL.md`](../.claude/skills/ship/SKILL.md).

### The baton is split
- **`docs/HANDOFF.md`** is now a **concise baton (≤80 lines):** Current unit ·
  NEXT (proposed branch, one-line scope, open risks, off-limits) · Last result ·
  tightened Definition of done · HARD RULES / off-limits. Read this, then run
  `/ship`. No full-history re-read every session.
- **`docs/HANDOFF_LOG.md`** holds the **full append-only history** (the prior
  661-line log moved here). Link from `HANDOFF.md`.

### Audit discipline preserved
Instead of an independent subagent auditing the *previous* chat's PR, the same
agent that did the work **audits its own diff before opening the PR** (step 5 of
`/ship`), citing `file:line` evidence for every claim. The independent-auditor
path is reserved for the **funds/ASA/auth (HARD RULES) lane**, gated behind
`USE_INDEPENDENT_AUDITOR=1` — a funds-lane unit missing the flag is a hard
blocker, not a skip (see `/ship` step 12). Audit file format is unchanged
(`docs/audits/README.md`).

---

## Invariants

1. **One open PR at a time.** A new unit does not start until the current PR is
   merged (and, for funds/ASA/auth, second-audited).
2. **The baton is the single source of truth** for "what's next." If it isn't in
   the baton, it isn't the plan.
3. **Nothing lands on `main` unreviewed.** Normal units merge only after green
   (or the explicit local-green fallback) + a completed self-audit. Funds/ASA/auth
   units additionally require `/mainnet-gate` PASS + `algo-auditor` PASS + the
   independent second pass.
4. **Never over-claim.** A result is "validated" only if a test backs it. Say
   "untested" when it is untested. "CI is green" and "the fix works" are separate
   claims — verify both, pin the exact head SHA.
5. **Local == GitHub.** `git status` clean and `git log origin/<branch>..HEAD`
   empty before stopping. The container is ephemeral; unpushed work is lost work.

---

## Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Baton (concise) | `docs/HANDOFF.md` | Current unit + NEXT + Last result + DoD + HARD RULES. ≤80 lines. |
| History (log) | `docs/HANDOFF_LOG.md` | Full append-only prior history. |
| Audit reports | `docs/audits/<branch>.md` | One audit per PR (self-audit by default; independent for funds/ASA/auth). |
| Ship skill | `.claude/skills/ship/SKILL.md` | The single end-to-end orchestrator (entry point). |
| Legacy audit skill | `.claude/skills/handoff-audit/SKILL.md` | Manual/exception path + independent-auditor checklist. |
| Close skill | `.claude/skills/closeout/SKILL.md` | The close phase `/ship` invokes (steps 9-11); no user prompts. |
| End-session skill | `.claude/skills/end-session/SKILL.md` | Verifies the safe-stop guarantee; what `/ship` does at exit. |
| CI | `.github/workflows/ci.yml` | Typecheck + full vitest suite on push + PR. |

---

## CI is the definition of "green"

The audit's "green" must mean the same thing as CI's "green." CI runs, and
`/ship` re-runs locally, exactly:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/frontier-al run check        # tsc typecheck
pnpm --filter @workspace/frontier-al run test:server  # vitest server suite
pnpm --filter @workspace/frontier-al run test         # vitest client suite
```

If `gh pr checks` is unavailable, `/ship` trusts the local green and notes it
explicitly in the audit file — never silently conflating local green with a
verified CI pass. Pin the exact head-commit SHA when claiming green.
