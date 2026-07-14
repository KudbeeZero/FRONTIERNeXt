# SESSION_UPDATER.md

> **Closeout procedure KILO executes at the end of every session.** Companion to
> `KILO_RUNNER_PROMPT.md` (session start) and `00-STATE-INDEX.md` (current state).
> This file defines the in-repo memory writes KILO must perform once a unit's PR
> is opened and CI is green. It is the manual half of the session updater; the
> automated half is the single GitHub workflow `.github/workflows/session-log.yml`.

## Trigger

- **Manual (KILO):** run at session closeout, after the PR is opened and CI is
  green.
- **Automated (GitHub):** `.github/workflows/session-log.yml` is the **only**
  session-updater workflow. It runs on every `push` to `main` and rewrites
  `SESSION_LOG.md`. Its double-commit pattern (log commit → re-triggers
  workflow → second log commit) is **expected and healthy**. It is NOT a
  duplicate no-op and must NOT be "fixed" by removing the re-trigger.
- **Verification only:** `.github/workflows/memory-session-check.yml` runs on
  PR/push touching `docs/memory/**` and confirms `00-STATE-INDEX.md` exists, is
  fresh (< 72h), and carries all five write targets. It does **not** write
  memory and is not a session-updater trigger.
- **Exactly one** session-updater workflow must exist. Before adding anything,
  confirm no second `session-log*` / `memory*update*` / `kilo*` workflow exists
  under `.github/workflows/`.

## Five memory-write targets (all required)

Every closeout MUST update these five fields in `docs/memory/00-STATE-INDEX.md`:

1. **Current commit** — the exact `main` HEAD SHA the work landed on (or the
   merge commit SHA), with UTC date. If the tip is a `session-log.yml` commit,
   note the latest *feature* PR separately.
2. **Latest merged PR** — the PR number, squash-merge SHA, and one-line title.
   List the most recent 1–3 merges.
3. **Launch verdict** — current mainnet-readiness posture. For docs/process
   lanes this is typically "TestNet only; `/mainnet-gate` not required for this
   lane; N/A." For app-code lanes that touch funds/chain, record the actual
   `/mainnet-gate` + `algo-auditor` status. Never claim a PASS without evidence.
4. **Active blocker** — the single blocking item (usually the owner-only Fly
   activation, or an owner decision). "None" is a valid value once unblocked.
5. **Owner action** — the concrete next action(s) the human must take (fund
   wallet, set secrets, decide architecture, prune branches).

Always refresh the top-level `**Updated (UTC):**` timestamp when rewriting the
index so `memory-session-check.yml` passes.

## Completed-lane writeout (closeout block)

When a lane is **complete** (its PR merged and its goal met), write a closeout
block to `docs/memory/10-completed/<lane-name>.md` using this exact format:

```
# <lane-name> — Completed

- **Branch:** feat/<lane-name>
- **Base:** main
- **PR:** #NNN
- **Merge SHA:** <squash-merge sha>
- **Date:** YYYY-MM-DD
- **What changed:** <one paragraph>
- **Verified:** <test/CI evidence, or "untested">
- **Confidence:** high | medium | low
- **Restricted systems touched:** none | <list>
- **Notes:** <limitations, follow-ups>
```

`docs/memory/10-completed/_INDEX.md` lists every completed lane and links to
its closeout block.

## Baton sync

Also update `docs/HANDOFF.md` so the "Current baton" reflects the just-finished
unit and the "Next lane" points at the real next unit. The baton and
`00-STATE-INDEX.md` must agree on the current commit and latest PR; a
disagreement is a memory-layer gap to flag, not to paper over.

## Verification before hand-back

- [ ] `00-STATE-INDEX.md` updated for all five targets + `**Updated (UTC):**`.
- [ ] `docs/HANDOFF.md` baton rewritten (current + next + blocker + owner action).
- [ ] Relevant `docs/memory/FRONTIER_*.md` appended (what/verified/confidence).
- [ ] Completed-lane block written to `docs/memory/10-completed/` if lane done.
- [ ] No second session-updater workflow added; `session-log.yml` still the only one.
- [ ] PR opened, CI green, closeout block produced for the human.
