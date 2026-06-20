# Security pass — Phase-2 PR1: deterministic battle replay log

- **Date:** 2026-06-20
- **Branch / PR:** `phase/02-battle-depth` → `main` (#76)
- **Scope reviewed:** the PR1 diff — `server/engine/battle/replayLog.ts` (NEW pure helper), its wiring
  into the Redis `BattleReplayRecord.log` at the resolve site in `server/storage/db.ts`, and the spec.
- **Verdict:** **PASS** — no findings, no fix required. The one security-relevant property (the replay
  log is client-served and must not leak secrets) is already backed by a test in this PR.

## Checklist

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Auth boundaries | ✅ n/a | No routes added/changed; only a pure log builder + its call site. |
| 2 | Wallet / signature verification | ✅ n/a | Untouched. |
| 3 | API input validation | ✅ n/a | `buildReplayLog` consumes server-side persisted DB rows (`battleRow`/`targetRow`/`battleResult`), not user input. |
| 4 | Rate limits | ✅ n/a | No endpoint added; resolver cadence unchanged. |
| 5 | Secrets handling | ✅ ok | No secrets in code/logs; no env added. |
| 6 | CORS + headers | ✅ n/a | Untouched. |
| 7 | Transaction / finality | ✅ n/a | No chain/payment code; resolution math + outcome unchanged. |
| 8 | Replay / idempotency | ✅ ok | Battle-resolution idempotency/concurrency (`battle-concurrency.spec.ts`) unchanged; this is the battle *replay log*, not payment replay. |
| 9 | Admin endpoints | ✅ n/a | None touched. |
| 10 | **Logs leaking secrets** | ✅ ok (test-backed) | The replay log is served to clients via `GET /api/battle/replay/:id`. The new log carries only already-public game data — display names, `plotId`, biome, powers, troop/resource counts (all already exposed by `/api/battles/history`, the leaderboard, and the modal VS panel). It omits `battleId`/UUIDs, `attackerId`/`defenderId`, `commanderId`, and wallet addresses. `replayLog.spec.ts` asserts no message matches a UUID or base32 Algorand-address pattern. Modal renders `{entry.message}` as escaped JSX → no stored-XSS. |
| 11 | Dependency risk | ✅ ok | No deps added; no lockfile change; secret scan over the diff clean. |

## Notes
- Net posture is **improved**: the prior hand-built 3-line log had no test guaranteeing it stayed
  free of identifiers; this PR adds that guarantee.
- Out of scope (unchanged here): the `/api/battle/replay/:id` endpoint's own auth/rate-limit posture
  was not modified by this PR. If a later Phase-2 unit broadens what the replay exposes, re-check #10.
