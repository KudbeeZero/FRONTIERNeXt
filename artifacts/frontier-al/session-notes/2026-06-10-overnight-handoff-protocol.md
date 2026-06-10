# 2026-06-10 — Overnight Handoff Protocol adopted

## Scope
Added the shift layer on top of the existing memory system (CLAUDE.md rules →
PROJECT MEMORY state → LUT plans): end-of-day handoff, autonomous night builds,
one-file morning brief. Designed to be replicable to any repo.

## What was built
- **Protocol spec** (repo root): `docs/protocols/OVERNIGHT_HANDOFF_PROTOCOL.md` —
  roles, artifacts, rating tiers (Highly Recommended / Recommended / Experimental),
  hard guardrails, replication checklist.
- **Live artifacts** in `docs/handoff/`:
  - `NIGHT_QUEUE.md` — rated backlog (6 items seeded from MASTER/DORMANT/LIVING
    WORLD/GLOBE LUTs + PROJECT MEMORY §4).
  - `NIGHT_BOARD.md` — single live status board, updated every cycle, readable
    in <30s; carries the morning's pre-framed multiple-choice decisions.
- **Skills** (repo-root `.claude/skills/`): `/handoff` (end of day), `/night-shift`
  (the 30-min autonomous cycle), `/morning` (day pickup).
- **PROJECT MEMORY** updated: §3 gained the 2026-06-07 globe E4–E9 + site/SEO/Pera
  header merges (commit `98680a7`); §4 notes which items moved to the night queue.
- **CLAUDE.md**: pointer section added.

## Decisions
- Night shift **builds autonomously** on `claude/night/*` branches; never merges to
  main, never deploys, never touches secrets/migrations; checks must be green
  (`pnpm check` / `pnpm test:server` / `pnpm build`) before a cycle ends.
- Morning brief = the board file, not a generated report.
- Cadence = `/loop 30m /night-shift` in a live session (restartable with the same
  command if the session is reclaimed; the board holds all state).

## First night
Queue top 3 (all Highly Recommended): Pera wallet 1.4.2→1.5.2, gameConfig.ts
tunables module, prediction-markets nav wire-up. One decision parked for the
morning: how to attack Sub-parcel UI (pairing day vs. night slice vs. defer).
