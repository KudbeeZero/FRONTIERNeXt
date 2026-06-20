# 2026-06-20 — Phase 1 (battle clock) PR4: server `battle_tick` broadcast

## Unit
Owner-chosen Phase-1 feature. Investigation first showed the battle countdown is **already
smooth** (`GameLayout.tsx:129` ticks every 1s; `BattleCard` recomputes `remaining =
resolveTs - serverNow()`). Owner was told and chose to build it anyway for the one genuinely-new
thing a tick adds: a **server-authoritative active-battle set** pushed each second, so clients drop
a just-resolved battle promptly (between the 1.5s dirty flushes). Built efficient + gated.

## What shipped
**Server**
- `storage/interface.ts` + `storage/db.ts` + `storage/mem.ts` — new `getActiveBattles()`: pending
  battles with `resolveTs` in the future (db uses `gt`; mem filters the battles map). Complement of
  `resolveBattles`' "due" set.
- `wsServer.ts` — `wsClientCount()` export (gate helper).
- `routes.ts` — new background `setInterval(BATTLE_TICK_INTERVAL_MS)` beside battle(15s)/AI(20s)/
  orbital(5min): **returns early when no clients or no active battles** (no DB query, no broadcast);
  otherwise `broadcastRaw({ type:"battle_tick", serverTime, battles:[{id,resolveTs}] })`. Best-effort,
  never throws. Cadence env `BATTLE_TICK_INTERVAL_MS` (default 1000, floor 250).

**Client**
- `hooks/useGameSocket.ts` — `battle_tick` handler: `setServerTime(serverTime)` + a battle-tick
  callback bus (`onBattleTick`/`dispatchBattleTick`) + `useBattleTick()` hook, mirroring the existing
  world-event/chain-health bus pattern.
- `components/game/BattlesPanel.tsx` — `useBattleTick()`: with a fresh tick (<5s), drop a pending
  battle whose countdown has **elapsed** AND the server no longer lists as active. Future battles
  (resolveTs ahead) always show, so a tick race can't hide a new battle. No-tick → unchanged.

## Scope / safety
Additive. No combat-resolution logic, globe/canvas, schema-migration, funds, or deps change.
`broadcastRaw` sends public battle ids/resolveTs (already in game_state). Gated so it's free when idle.

## Verification
`check` ✓ · `test:server` **291 / 11 skipped** (+3 new `active-battles.spec.ts`) · client `test`
**76** · `build` ✓. Env documented in `ENV_VARS.md` + `docs/DEPLOYMENT_ENV_CHECKLIST.md`.

## Gates (owner-requested)
`/code-review` · `/security-pass` (→ `docs/audit/`) · `/pr-gate`. Report READY with verdicts; owner merges.

## Follow-ups (Phase 1 / next)
The 15s resolver-delay (env-configurable / faster resolution); then Phase 2 (`phase/02-battle-depth`).
