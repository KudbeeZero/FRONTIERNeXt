# 2026-06-20 — Phase 2 (battle depth) PR2: player battle-stats aggregator + endpoint

## Unit
Second Phase-2 unit (owner: continue through the next features). `V2_ROADMAP.md:37` names "stats +
commander performance tracking". Existing surfaces cover totals (`/api/game/leaderboard` via pure
`computeLeaderboard`; `/api/battles/history`; player object carries `attacksWon`/`attacksLost` +
per-commander `totalKills`). **The gap:** no per-player **battle-stats aggregator** (derived win/hold
rate, streak, biggest victory, recent record) and no endpoint serving it.

## What shipped (server-only; no schema/canvas/funds)
- **`server/storage/battle-stats.ts` (NEW)** — pure `computePlayerBattleStats(battles, playerId)`
  (mirrors `computeLeaderboard`'s pure style): `attacks{total,wins,losses,winRate}`,
  `defenses{total,held,lost,holdRate}`, `currentStreak{kind,count}` (attacker perspective by resolveTs),
  `totals{troopsCommitted,ironBurned,fuelBurned}`, `biggestVictory{battleId,powers,margin}|null`,
  `recent[]` (≤10, newest first, role-tagged). Integer percents, divide-by-zero guarded. Carries only
  already-public data (powers, counts, battleId — already exposed by `/api/battles/history`); no
  addresses or player/parcel UUIDs.
- **Storage accessor `getPlayerBattles(playerId)`** — `interface.ts` + `db.ts` (resolved battles where
  attacker or defender; reuses `attackerIdx`/`defenderIdx`; added `or` to the drizzle import) + `mem.ts`.
- **`GET /api/players/:id/battle-stats`** in `routes.ts` (mirrors the `/api/battles/history` handler:
  `withDbRetry` → `getPlayerBattles` → `computePlayerBattleStats` → JSON). Public read.

## Scope / safety
Read-only + additive. No write path, schema, migration, funds, globe/canvas, or resolution-math change.
Pure aggregator + one new read accessor + one GET.

## Verification
`check` ✓ · `test:server` **318 / 11 skipped** (+9 new `server/storage/battle-stats.spec.ts`) ·
client `test` **76** · `build` ✓. Manual (needs server + Postgres): `GET /api/players/<id>/battle-stats`
→ aggregated shape; no-battles player → zeroed stats.

## Gates (owner-requested cadence)
`/code-review` · `/security-pass` (→ `docs/audit/`; public read, confirm no address/secret leak) ·
`/pr-gate`. Report READY with verdicts; owner merges.

## Follow-ups (Phase-2 sequence)
Client wire-up (consume the endpoint in a combat-record surface + surface commander `totalKills` in
`CommanderPanel`); commander stats/leaderboard; veritas battle-verification; Postgres persistence of
the replay log (>24h). See `docs/V2_ROADMAP.md`.
