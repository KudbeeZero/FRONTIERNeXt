# 2026-07-16 — Mission Control repository intelligence (Phase 2)

## Context

Phase 1 of the Mission Control dashboard shipped a static, hand-maintained
seven-panel view of repo + workflow health. Phase 2 ("repository
intelligence") moves most of those values off the owner's keyboard and
onto a build-time generator that derives them from local git state,
package metadata, session notes, and the .github/workflows directory. The
dashboard now reorganises around four auto-derived sections — repository
metadata, workflow status, build information, health indicators — plus
the hand-curated priorities / owner actions / branches sections Phase 1
already had. No API, no backend, no polling, no database, no auth, no
GitHub auth.

## What shipped

- `artifacts/frontier-al/scripts/generate-mission-control-data.mjs` —
  the generator. Pure Node ESM, no extra deps. Reads:
  - `git rev-parse HEAD`, branch, commit subject, commit timestamp
  - package.json `version`
  - `CF_PAGES`, `FLY_*`, `VERCEL`, `NODE_ENV` for deploy mode + env
  - SESSION_LOG.md for last merged PR (number, title, SHA, date)
  - `artifacts/frontier-al/session-notes/*.md` for last session note
  - `docs/memory/10-completed/_INDEX.md` for latest completed lane
  - `.github/workflows/*.yml` for the workflow list
  - `client/src/components/mission-control/testTotals.json` for the
    test-totals snapshot (written separately by the capture script)
  Outputs `client/src/components/mission-control/generated.ts` as a
  strict `as const` module. Run by `pretest`, `precheck`, `prebuild`.
- `artifacts/frontier-al/scripts/capture-test-totals.mjs` — runs the
  vitest client + server suites, parses the "Test Files  N passed" /
  "Tests  N passed" summary, writes the JSON snapshot. Run by
  `posttest` and `posttest:server` so the totals are always fresh after
  the test suite completes. (Separated from the generator because
  spawning vitest from inside the generator under `execFileSync` leaks
  zombie workers in some pnpm versions.)
- `client/src/components/mission-control/missionControlData.ts` —
  refactored. Now a thin public contract: it imports `generated` and
  widens the literal-typed derived values to the public union types.
  Hand-curated sections (priorities, owner actions, baton state) are
  kept short and labelled.
- `client/src/components/mission-control/missionControlData.test.ts` —
  expanded from 3 to 9 contract tests. Guards every Phase 2 section.
- `client/src/pages/MissionControl.tsx` — reorganised into 9 sections,
  the first 4 of which are auto-derived:
  1. **Repository Metadata** — head SHA (copy button), branch, commit
     subject, app version, environment, deploy mode
  2. **Workflow Status** — last merged PR, last session log, latest
     completed lane, memory layer HEAD (copy button)
  3. **Build Information** — commit timestamp, build timestamp, test
     totals (client + server), Cloudflare Pages deploy status
  4. **Health Indicators** — build freshness (relative age), deployment
     status, branch hygiene (stale count)
  5. Workflows (CI presence + status)
  6. Current Priorities (hand-curated)
  7. Owner Actions (hand-curated)
  8. Memory Layer (auto-derived)
  9. Branch Hygiene (auto-derived)
- `artifacts/frontier-al/package.json` — added the `pre*`/`post*` hooks
  and the `generate:mission-control` / `capture:totals*` scripts.

## Files changed

- `artifacts/frontier-al/scripts/generate-mission-control-data.mjs` (new)
- `artifacts/frontier-al/scripts/capture-test-totals.mjs` (new)
- `artifacts/frontier-al/client/src/components/mission-control/generated.ts` (new, auto-generated, committed)
- `artifacts/frontier-al/client/src/components/mission-control/testTotals.json` (new, auto-generated, committed)
- `artifacts/frontier-al/client/src/components/mission-control/missionControlData.ts` (refactor)
- `artifacts/frontier-al/client/src/components/mission-control/missionControlData.test.ts` (expanded)
- `artifacts/frontier-al/client/src/pages/MissionControl.tsx` (reorganised)
- `artifacts/frontier-al/package.json` (scripts)

## Validation

- `pnpm run check` — clean (tsc passes, generator runs first as `precheck`)
- `pnpm run test` — 1 file / 9 tests pass, generator + capture hook fired
- `pnpm run test:server` — 73 files / 706 tests pass + 8 skipped / 26 skipped, capture hook fired
- `pnpm run build` — green; MissionControl code-split (12.78 kB chunk)

## Notes / risks

- The generator runs in <1s (it does NOT spawn vitest; that's the
  capture script's job). The prebuild / pretest / precheck hooks are
  safe to add everywhere.
- `MEMORY_LAYER_HEAD_SHA` env var is supported as an override if a
  future lane splits docs/memory into its own branch; defaults to the
  current HEAD SHA.
- Test totals are intentionally captured at `posttest` time, not at
  prebuild — the build then reads the most recent committed snapshot
  rather than running the suites itself. This keeps `pnpm run build`
  fast (~30s) and means the totals reflect the test state of the last
  `pnpm run test` / `test:server` run, not the build's environment.
- No auth, no API, no DB, no wallet, no chain changes. Dark-mode +
  mobile-first preserved (same Card / Row / collapsible section pattern
  as Phase 1).
