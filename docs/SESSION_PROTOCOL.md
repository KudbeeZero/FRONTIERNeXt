# Session Relay Protocol

> The container is ephemeral. Treat every chat as **one reviewed PR**, and make
> the handoff between chats an **audited artifact, not trust**.

This repo is worked on across many short-lived chat sessions in disposable
containers. Nothing about a chat survives except what it commits and pushes.
The Session Relay Protocol turns that constraint into a discipline: each chat is
a single, mergeable, independently-audited unit of work, and the only thing
passed between chats is a small, verifiable **baton**.

---

## The loop

```
            ┌──────────────────────────────────────────────────────────┐
            │                                                          │
   START ──▶ /handoff-audit ──▶ (audit prev PR) ──▶ PASS ─▶ merge prev │
            │                          │                   sync main   │
            │                    CONCERNS ─▶ ask user                  │
            │                       FAIL ─▶ do NOT merge               │
            │                                                          │
            │   ... do this chat's ONE unit of work on its branch ...  │
            │                                                          │
   END ────▶ /closeout ──▶ commit + green tests ──▶ open ONE PR ──────┘
                              rewrite baton (AWAITING_AUDIT)
```

### At chat START — `/handoff-audit`
1. Read the baton (`docs/HANDOFF.md`) and memory. The baton is the **single
   source of truth** for what's next.
2. Confirm the previous chat's PR exists and its **CI is GREEN**
   (`gh pr checks <PR>`).
3. Spawn an **independent auditor subagent** that does **not** trust the PR's
   own claims. It checks the diff against every claim with `file:line` evidence,
   runs the tests, and looks for scope creep, untested assertions, and security
   issues. It emits **PASS / CONCERNS / FAIL** and writes
   `docs/audits/<branch>.md`.
4. Gate on the verdict:
   - **PASS** → merge the previous PR, sync `main`, start this chat's branch.
   - **CONCERNS** → stop and ask the user.
   - **FAIL** → do **not** merge. Report and ask for direction.

### At chat END — `/closeout`
1. Ensure all work is committed and the tests are **green**.
2. Ask the handoff questions: what shipped, the next priority + branch, open
   risks, what's off-limits.
3. If there's a durable lesson, update memory.
4. Open **exactly one** PR into `main`, including an **Audit checklist** the next
   chat should verify.
5. Rewrite the baton: new Current baton (branch + PR# + `AWAITING_AUDIT`), a
   short "what this chat did (for the auditor)", and the proposed NEXT chat.
6. The final baton commit must **not** use `[skip ci]` — otherwise the PR head
   has no CI check and the next audit cannot confirm green.

---

## Invariants

1. **One open PR at a time.** A new unit of work does not start until the
   previous PR is audited and merged.
2. **The baton is the single source of truth** for "what's next." If it isn't in
   the baton, it isn't the plan.
3. **Nothing lands on `main` unreviewed.** Merges happen only after a PASS audit.
4. **Never over-claim.** A result is not "validated" unless a test backs it. Say
   "untested" when it is untested.

---

## Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Baton | `docs/HANDOFF.md` | The handoff. Short. Current baton + what-this-chat-did + NEXT. |
| Audit reports | `docs/audits/<branch>.md` | One independent audit per PR. |
| Audit skill | `.claude/skills/handoff-audit/SKILL.md` | Runs the START audit + gate. |
| Closeout skill | `.claude/skills/closeout/SKILL.md` | Runs the END close + opens the PR. |
| SessionStart hook | `.claude/hooks/session-start.sh` | Prints the baton at session start. |
| CI | `.github/workflows/ci.yml` | Typecheck + full vitest suite on push + PR. |

---

## CI is the definition of "green"

The audit's "green" must mean the same thing as CI's "green." CI runs, and the
audit re-runs, exactly:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/frontier-al run check        # tsc typecheck
pnpm --filter @workspace/frontier-al run test:server  # vitest server suite
pnpm --filter @workspace/frontier-al run test         # vitest client suite
```

The test runner (`vitest`) is a dev dependency, so `pnpm install` installs it —
there is no separate "install the runner" step to forget.

---

## Bootstrap note (read once)

This protocol is **self-referential**: its own `handoff-audit` skill,
`session-start.sh` hook, and `settings.json` live inside the PR that introduces
it. They are inert on `main` until that PR merges. Therefore:

- The **first** audit (of the bootstrap PR) must be run with the protocol branch
  checked out, or done manually — `/handoff-audit` and the SessionStart hook do
  not exist on `main` yet.
- The protocol **self-activates** for every subsequent chat once PR #1 is merged.
