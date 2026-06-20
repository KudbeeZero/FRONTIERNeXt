# 2026-06-20 — Phase 2 (battle depth) PR1: deterministic battle replay log

## Unit
First Phase-2 unit (owner chose Phase 2 after #75 merged; AskUserQuestion picked the replay-log gap).
Phase 2 was already heavily scaffolded — Redis `BattleReplayRecord` (24h), `GET /api/battle/replay/:id`,
`GET /api/battles/history`, `BattleWatchModal` "Battle Analysis" viewer, `LeaderboardPanel`,
`pages/battles.tsx` all exist. **The gap:** the main resolver (`storage/db.ts`) hand-wrote a coarse
**3-line** replay log and discarded the engine's structured log, while the sub-parcel path already
persisted the full engine log. Battle row + parcel persist every input needed, so a deep deterministic
log is buildable with **no schema change**, and `BattleWatchModal.tsx:368` already renders `replay.log`
— so this enriches an existing UI with **zero client changes**.

## What shipped
- **`server/engine/battle/replayLog.ts` (NEW)** — pure `buildReplayLog(input): BattleLogEntry[]`:
  `power_calc` (attacker committed troops/iron/fuel[/crystal][+commander] → snapshot attack power) +
  `terrain` (biome, defense L, defensive fortifications turret/shield_gen/fortress → defender power) +
  the engine's `resolveBattleFromPowers` resolution entries spread verbatim + aftermath (`resolution`:
  conquest+pillage on win, repelled on loss). Pure: no DB/net/rng; phases stay in the
  `BattleLogEntry.phase` union. Messages carry only names/plotId/biome/powers/resources — never
  addresses or UUIDs (log is client-served).
- **`server/storage/db.ts`** — resolve site now builds the replay record's `log` via `buildReplayLog(...)`
  from `battleRow`/`targetRow`/`battleResult`; pillage amounts hoisted to consts (reused by record +
  helper). No other resolver behavior changes.

## Scope / safety
Additive to a fire-and-forget Redis record (`saveBattleReplay(...).catch(()=>{})`). Resolution math,
outcome, ownership, pillage, schema, funds, globe/canvas all unchanged. Sub-parcel path (already rich)
untouched. MemStorage writes no replay → unaffected. No client change.

## Verification
`check` ✓ · `test:server` **309 / 11 skipped** (+9 new `server/engine/battle/replayLog.spec.ts`) ·
client `test` **76** · `build` ✓. Manual (needs server+Postgres+Redis — not run here; covered by unit
tests): resolve a battle, open BattleWatchModal → "Battle Analysis" shows the deep breakdown.

## Gates (owner-requested cadence)
`/code-review` · `/security-pass` (→ `docs/audit/`; focus: replay log is client-served, no address/secret
leak) · `/pr-gate`. Report READY with verdicts; owner merges.

## Follow-ups (next Phase-2 units)
Battle/commander **stats** aggregator + endpoint + panel; veritas battle-verification flow; Postgres
persistence of the log for >24h. See `docs/V2_ROADMAP.md`.
