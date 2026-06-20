# 2026-06-20 — Phase 1 (battle clock) PR3: CommanderPanel cooldown/lock drift

## Unit
Completes the Phase-1 drift sweep (after #71 server clock + #72 GameLayout badges).
`CommanderPanel.tsx` was the last cluster reading its own `Date.now()` for **9** comparisons
against SERVER-set timestamps — so satellite expiry, drone scouting, commander lock countdowns,
the attack-cooldown gate, "all commanders locked", and special-attack cooldowns all drifted when
the device clock was skewed.

## What shipped (1 file)
- `client/src/components/game/CommanderPanel.tsx` — import `serverNow`; all **9** `Date.now()`
  occurrences (lines 84, 117, 221, 552, 553, 569, 570, 1127, 1128) → `serverNow()`. Each compares
  a server timestamp: `satellite.expiresAt`/`deployedAt`, `drone.deployedAt`, `cmd.lockedUntil`,
  `player.attackCooldownUntil`, `record.lastUsedTs`. The per-second `tick`/`setInterval` re-render
  loops are unchanged — `serverNow()` only corrects the offset.

## Scope / safety
Display/gating correctness only — reuses the `serverClock` util from #71 (no new infra). **No**
server, combat-resolution, globe/canvas, schema, funds, or deps change. 0 `Date.now()` remain in
the file.

## Verification
`check` ✓ · client `test` **76 pass** (serverClock math already covered in
`client/tests/serverClock.spec.ts`) · `build` ✓.

## Gates (owner-requested)
Run after PR open + green: `/code-review` (review council) · `/security-pass` (security team) ·
`/pr-gate` (audit team). Report READY with the three verdicts; owner merges.

## Follow-ups (still Phase 1)
Env-configurable background cadences ("easy to toggle"); optional `battle_tick` for sub-1.5s smooth
countdowns. Then Phase 2 (`phase/02-battle-depth`).
