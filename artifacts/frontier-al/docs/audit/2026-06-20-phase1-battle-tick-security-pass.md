# Security Pass — Phase-1 PR4 (server `battle_tick` broadcast)

**Date:** 2026-06-20 · **Branch:** `phase/01-battle-tick` · **PR:** #74
**Scope reviewed:** the diff — `getActiveBattles()` (interface/db/mem), `wsClientCount()`
(wsServer), the `routes.ts` battle_tick `setInterval` + `broadcastRaw`, the client
`useGameSocket` battle-tick bus, and the `BattlesPanel` filter.
**Verdict:** ✅ **PASS — no findings.**

## Checklist

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Auth boundaries | ✅ N/A | No new routes; `battle_tick` is a server→client WS broadcast, no inbound handler. |
| 2 | Wallet / signature | ✅ N/A | No identity/signature logic. |
| 3 | Input validation | ✅ ok | No new server-side client input. Client parse is guarded: `Array.isArray(msg.battles)` + `typeof msg.serverTime === "number"` before use. |
| 4 | Rate limits | ✅ ok | Broadcast is a fixed-cadence **server** interval, not client-triggerable; gated to no-op when no clients / no active battles. |
| 5 | Secrets handling | ✅ ok | No secrets. `BATTLE_TICK_INTERVAL_MS` documented in `ENV_VARS.md` + `DEPLOYMENT_ENV_CHECKLIST.md`. |
| 6 | CORS + headers | ✅ N/A | No transport/header change. |
| 7 | Transaction / finality | ✅ N/A | No chain/payment/funds code. |
| 8 | Replay / idempotency | ✅ N/A | No paid action / mint path. |
| 9 | Admin endpoints | ✅ N/A | None touched. |
| 10 | Logs leaking secrets | ✅ ok | Only `console.warn("Background task (battle_tick):", err.message)` on error — no secrets/addresses. |
| 11 | Dependency risk | ✅ ok | No deps added; secret scan over the diff clean. |

## Information-disclosure analysis (the one real question for a broadcast)

`battle_tick` uses the **unscoped** `broadcastRaw` (all clients), unlike the per-viewer
`scopeGameStateFor` flush. Verified this leaks nothing:

- `server/stateScope.ts` (`scopeGameStateFor`) redacts only **economic** data (player
  balances); it does **not** filter or fog the `battles` list. So the full battles list —
  including each battle's `targetParcelId`, `lat`, `lng`, attacker/defender — is **already
  broadcast to every client** via `game_state_update`.
- `battle_tick`'s payload is a strict subset: `{ id, resolveTs }` only — **no** location,
  player, or economic fields. It therefore exposes strictly less than what every client
  already receives. No fog-of-war / EPI regression.

## Outcome

No fix required. Not funds/ASA/economic → no `algo-auditor` needed. No env/secret change beyond
the already-documented `BATTLE_TICK_INTERVAL_MS`.
