# KILO_RUNNER_PROMPT.md

> **Start-of-session runner prompt.** KILO reads this file at the beginning of
> every session to locate the memory layer, confirm the current unit, and know
> exactly what to write at closeout. It is the human-facing companion to
> `SESSION_UPDATER.md` (the closeout procedure) and `00-STATE-INDEX.md` (the
> canonical current-state index).
>
> Keep this file generic and reusable. Per-lane specifics (scope, non-goals,
> tests) are supplied by the human in the session message, not hardcoded here.

## Pre-flight (read before writing any code)

1. **Read `docs/HANDOFF.md`** — confirm current unit, active blocker, owner
   action. The baton is the single source of truth for "what's next."
2. **Read `docs/memory/00-STATE-INDEX.md`** — confirm last verified commit and
   launch verdict. If this file is missing or disagrees with `main` HEAD, treat
   it as a gap and flag it at closeout (do not silently trust it).
3. **Read the relevant `docs/memory/FRONTIER_*.md`** for the lane's system
   (battle engine, sub-plot combat, wallet stability, background-loop cost
   control, commander NFT delivery, four-AI battle loop).
4. **Read `docs/SESSION_PROTOCOL.md`** — follow the closeout discipline exactly
   (one unit per chat, no inter-chat wait, self-audit before PR).

## Session start checklist

- [ ] Base confirmed: `git fetch origin main` and branch off clean `origin/main`.
- [ ] Baton read; current unit + blocker + owner action noted.
- [ ] State index read; recorded HEAD matches `main` HEAD (or gap flagged).
- [ ] Lane-specific `docs/memory/FRONTIER_*.md` read.
- [ ] `SESSION_PROTOCOL.md` closeout format noted.

## Scope (fill in per session)

Describe the one system / one concern this session owns. One unit per chat.

```
[ lane name ]
[ what changes ]
[ accept criteria ]
```

## Non-goals (fill in per session)

Explicitly list what this session must NOT touch. The standing HARD RULES
always apply:

- No funds / ASA / transfer code toward mainnet without `/mainnet-gate` PASS
  **and** an `algo-auditor` pass.
- Do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` may point at
  mainnet.
- Do not reintroduce mock/demo data into plot/HUD surfaces.
- Do not change globe/combat/canvas behavior outside a scoped, audited unit.
- Do not touch schema/migrations, wallet config, ASA IDs, or treasury
  addresses unless the lane explicitly requires it (and is audited).

## Tests (fill in per session)

Specific commands to run for this lane, e.g.:

- `pnpm --filter @workspace/frontier-al run check`
- `pnpm --filter @workspace/frontier-al run test:server`
- `pnpm --filter @workspace/frontier-al run test`
- `pnpm run typecheck` (root, aggregate — `mockup-sandbox` excluded)

For docs/process lanes: confirm rendered references resolve and required
memory-write targets are covered (see `SESSION_UPDATER.md`).

## Memory write (required at closeout)

After CI is green and the PR is opened, KILO MUST:

1. **Update `docs/HANDOFF.md` baton** — current unit, next lane, active
   blocker, owner action.
2. **Update `docs/memory/00-STATE-INDEX.md`** — current commit, latest merged
   PR, launch verdict, active blocker, owner action.
3. **Append to the relevant `docs/memory/FRONTIER_*.md`** — what changed, what
   was verified, confidence level.
4. **If the lane is complete:** write the closeout block to
   `docs/memory/10-completed/<lane-name>.md` (see `SESSION_UPDATER.md` for the
   exact block format).

## Session updater note

The GitHub workflow `.github/workflows/session-log.yml` is the **sole** session
updater. It auto-triggers on every `push` to `main` and appends a lightweight
`SESSION_LOG.md`. Its double-commit pattern (log → re-trigger → log) is
**expected and healthy**, not a duplicate no-op. The separate
`.github/workflows/memory-session-check.yml` is a *verification* check only — it
does not write memory and must not be mistaken for a second updater. There must
be exactly **one** session-updater workflow; do not add a second trigger.

## Closeout format (hand back to human)

```
ASKED / DONE / NEEDS YOU
Branch · Base · Commits · Changed files · Tests · CI · PR URL · Merge verdict
```

Produce: Branch name and base, commits and changed files, uncommitted changes
(if any), test results and totals, typecheck/build status, CI status,
limitations, restricted systems untouched, PR URL, and merge verdict
(`MERGE READY` or `BLOCKED` with reason).
