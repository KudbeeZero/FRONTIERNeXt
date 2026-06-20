# Security pass — Comm Terminal (whisper widget + optional voice)

- **Date:** 2026-06-20
- **Branch / PR:** `feat/comm-terminal` → `main` (#79)
- **Scope reviewed:** `server/engine/narrative/whispers.ts`, `server/services/voice/elevenlabs.ts`,
  `getPlayerCommTerminal` (interface/db/mem), `GET /api/comm-terminal/whispers`, the `comm_terminal`
  facility (`shared/schema.ts`), and the `CommTerminal` client widget.
- **Verdict:** **PASS** — no findings; 2 accepted-risk notes.

## Checklist

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Auth boundaries | ✅ ok | The whisper endpoint is a read, ownership-gated via `getPlayerCommTerminal`. The facility purchase reuses the existing `/api/actions/build` route (`assertPlayerOwnership` + idempotency guard) — no new mutation surface. |
| 2 | Wallet / signature | ✅ n/a | Untouched. |
| 3 | API input validation | ✅ ok | `playerId` → **parameterized** drizzle `eq(parcelsTable.ownerId, …)` (no injection). `since` is only string-compared to a server-generated whisper id — never reaches the DB. No request body. |
| 4 | Rate limits / DoS | ⚠️ accepted-risk | Unauthenticated read; a caller can poll any `playerId`. Returns only **atmosphere** (a deterministic flavor line) and only if that player owns a terminal — no game state leaked. The `since` param bounds work to ~1 indexed query/poll and **≤1 voice synth per ~45s window per player**. Accepted; add a limiter if abused. |
| 5 | **Secrets handling** | ✅ ok | `ELEVENLABS_API_KEY` is read from env only, sent **solely** as the `xi-api-key` header to `api.elevenlabs.io`, and **never logged or returned**. The endpoint returns `voiceConfigured` (boolean) + whisper text + synthesized audio — not the key. No secret committed; no `.env` added. With no key, **no network call is made**. |
| 6 | CORS + headers | ✅ n/a | Unchanged. |
| 7 | Transaction / finality | ✅ n/a | No chain/payment code. New facility is an **ASCEND sink** (off-chain balance via existing build flow); **no ASA/funds movement** → `/mainnet-gate` + `algo-auditor` not required. |
| 8 | Replay / idempotency | ✅ ok | Purchase idempotency is the existing build guard; the read has no replay concern. |
| 9 | Admin endpoints | ✅ n/a | None. |
| 10 | Logs leaking secrets | ✅ ok | The client-served whisper feed carries only atmospheric text — no addresses, player/parcel ids, or hidden state (whispers are deliberately stateless flavor). Endpoint logs error messages only. |
| 11 | Dependency risk | ✅ ok | No new deps (uses global `fetch`); no lockfile change; secret scan over the diff clean. |

## Notes / accepted risk
- **Unauthenticated flavor read** (#4): returning another player's current whisper is harmless (deterministic
  atmosphere, reveals nothing). If desired later, bind the endpoint to the caller's session and 403 on mismatch.
- **Voice cost** (#4/#5): the `since` short-circuit ensures ElevenLabs is called at most once per window per
  player even under fast polling — important once a key is configured (credits + latency).
- **Fairness:** whispers intentionally encode **no** game state (no positions/holdings/plans), so the terminal
  is cosmetic/narrative and never a competitive information advantage.
