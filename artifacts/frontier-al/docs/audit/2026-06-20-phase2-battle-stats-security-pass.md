# Security pass — Phase-2 PR2: player battle-stats aggregator + endpoint

- **Date:** 2026-06-20
- **Branch / PR:** `phase/02-battle-stats` → `main` (#77)
- **Scope reviewed:** the PR2 diff — `server/storage/battle-stats.ts` (NEW pure aggregator),
  `getPlayerBattles` on `interface.ts`/`db.ts`/`mem.ts`, and `GET /api/players/:id/battle-stats` in
  `routes.ts`.
- **Verdict:** **PASS** — no findings, no fix required. One accepted-risk note (below).

## Checklist

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Auth boundaries | ✅ ok | Read-only public GET. Returns aggregate combat stats (win/hold rate, streak, recent) — consistent with the already-unauthenticated `/api/battles/history` and `/api/game/leaderboard`, which already expose per-player W/L + names. No mutation, so no session/ownership gate needed. |
| 2 | Wallet / signature verification | ✅ n/a | Untouched. |
| 3 | API input validation | ✅ ok | `req.params.id` flows only into a **parameterized** drizzle `eq(battlesTable.attackerId/defenderId, id)` (no SQL injection). Unknown/garbage id → empty battle set → zeroed stats (no throw, no enumeration signal beyond "no battles"). No request body. |
| 4 | Rate limits / DoS | ⚠️ accepted-risk | `getPlayerBattles` loads **all** of a player's resolved battles (lifetime stats need the full set), then aggregates in memory. Indexed by `attackerIdx`/`defenderIdx` and bounded by battles-per-player, but a very active player = a larger scan per call, and the endpoint is unauthenticated. **Accepted** for now (consistent with other public reads; cost bounded + indexed). Mitigation if it grows: a `LIMIT`/date-window or cached per-player counters. |
| 5 | Secrets handling | ✅ ok | No secrets; no env added. |
| 6 | CORS + headers | ✅ n/a | Unchanged. |
| 7 | Transaction / finality | ✅ n/a | No chain/payment code. |
| 8 | Replay / idempotency | ✅ n/a | Read-only; resolver idempotency unchanged. |
| 9 | Admin endpoints | ✅ n/a | Intentionally a public read, not admin. |
| 10 | Logs leaking secrets | ✅ ok | The typed `PlayerBattleStats` carries only powers, counts, win/hold rates, and `battleId` (already exposed by `/api/battles/history`). It structurally omits wallet addresses and player/parcel UUIDs (`biggestVictory` deliberately excludes `targetParcelId`). |
| 11 | Dependency risk | ✅ ok | No deps added; no lockfile change; secret scan over the diff clean. |

## Notes
- During review the pure aggregator's `recent` list was tightened to filter by player membership
  (parity with `attacks`/`defenses`) for defense-in-depth, so a mis-scoped caller can't surface a
  battle the player wasn't in. Tests remain green (`battle-stats.spec.ts`, 9).
- Out of scope (unchanged): the rate-limit posture of existing public reads. If a future unit adds a
  client poller for this endpoint, revisit #4 (add a cap or short cache).
