# 2026-06-20 — Phase 1 (battle clock) PR5: resolver cadence env-config + 5s default

## Unit
Last Phase-1 battle-clock slice (the PR4 follow-up). The battle auto-resolver ran
`storage.resolveBattles()` on a **hardcoded `setInterval(…, 15000)`**, so a battle resolved up to
**15s after its countdown hit 0:00** — the only remaining felt lag (the countdown UI and PR4's
`battle_tick` are already crisp). Owner chose (AskUserQuestion) to make the cadence env-configurable
**and tighten the default to ~5s** (battles resolve ~3× sooner; ~3× resolver query frequency — an
accepted gameplay/load change).

## What shipped
**Server**
- `server/util/intervals.ts` (NEW) — `clampIntervalMs(raw, def, floor) = Math.max(floor, Number(raw) || def)`.
  Extracts the inline env-cadence expression PR4 used, so parsing rules are consistent + testable.
- `routes.ts` — battle auto-resolver `}, 15000)` → `BATTLE_RESOLVE_INTERVAL_MS =
  clampIntervalMs(process.env.BATTLE_RESOLVE_INTERVAL_MS, 5000, 1000)` (default **5000**, floor **1000**
  to protect Neon). Comment notes the cadence is player-felt.
- `routes.ts` — retrofit the PR4 `BATTLE_TICK_INTERVAL_MS` inline `Math.max(250, …)` to the same
  `clampIntervalMs(…, 1000, 250)` helper (DRY; identical behavior).

**Docs**
- `BATTLE_RESOLVE_INTERVAL_MS` added to `ENV_VARS.md` + `docs/DEPLOYMENT_ENV_CHECKLIST.md`, flagged as
  player-felt (resolution latency), default 5000, floor 1000.

## Scope / safety
The resolver is idempotent + concurrency-guarded (`battle-concurrency.spec.ts`): cadence only changes
*how soon* a due battle is picked up, not the math. Tests call `resolveBattles()` **directly** (not via
the interval), so the default change moves no test timing or CI. No combat-resolution math, globe/canvas,
schema, funds, or deps change. `BATTLE_DURATION_MS` (how long a battle lasts) is untouched — distinct
from poll cadence.

## Verification
`check` ✓ · `test:server` **297 / 11 skipped** (+6 new `server/util/intervals.spec.ts`) · client `test`
**76** · `build` ✓. Manual: unset → 5000ms; `BATTLE_RESOLVE_INTERVAL_MS=2000` → 2000ms; `=100` → floored 1000ms.

## Gates (owner-requested)
`/code-review` · `/security-pass` (→ `docs/audit/`) · `/pr-gate`. Report READY with verdicts; owner merges.

## Follow-ups (next)
Phase 1 battle-clock is complete. Next: Phase 2 battle-depth (`phase/02-battle-depth`) — replay log / stats.
