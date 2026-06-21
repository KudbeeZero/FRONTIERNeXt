# Security pass — wallet WebSocket auth loop fix

**Date:** 2026-06-21
**Branch:** `claude/status-immediate-issues-8ltv13`
**Surface:** client wallet auth + game WebSocket lifecycle
**Scope of change:**
- `client/src/hooks/useGameSocket.ts` — only open the socket when a token is
  present; on WS close `1008`/`4001` (auth reject) clear the stale token and
  ask the consumer to re-auth instead of an unbounded silent retry loop;
  bounded backoff retained for genuine network drops; exported pure
  `isAuthRejectClose(code)` (unit-tested).
- `client/src/contexts/WalletContext.tsx` — `authVersion` bumps on each
  successful auth (drives a clean socket reconnect with the fresh token);
  `onSessionRejected` re-auths at most **2×**, then surfaces an error (no
  infinite signature-prompt loop).
- `client/src/components/game/GameLayout.tsx` — drive the socket off
  `authVersion` + `onSessionRejected`.

## Why
A stale/invalid session token (e.g. `SESSION_SECRET` rotated across a Fly
redeploy) caused the server to close the socket with `1008 "authentication
required"` (`server/wsServer.ts:106-109`). The client blindly reconnected on
**any** close, exhausted its retry budget, then gave up permanently — and never
cleared the bad token — surfacing as "wallet connects, flashes, then connection
lost." This pass fixes the client behavior; it does **not** change server auth.

## Checklist

| # | Item | Verdict | Evidence / note |
|---|------|---------|-----------------|
| 1 | Auth boundaries | ✅ | Server WS auth **unchanged**: `verifySession(tokenFromReq(req))` → `ws.close(1008)` when `isWalletAuthRequired() && !auth` (`server/wsServer.ts:106-109`). Client change is *stricter* — it no longer opens a token-less socket. |
| 2 | Wallet / signature verification | ✅ | No client-supplied identity trusted; the session token is still server-verified (HMAC, `server/auth.ts`). Client only decides *whether to connect* + *whether to re-sign*. |
| 3 | API input validation | ✅ (n/a) | No new endpoint/body. |
| 4 | Rate limits | ✅ (improved) | Fix **removes** a self-inflicted hammer: a dead token previously reconnected every 3s up to the budget; now it stops on first auth-reject. Reduces server load. |
| 5 | Secrets handling | ✅ (improved) | Token storage unchanged (`localStorage`, pre-existing); stale tokens are now **cleared** on reject (`clearAuthToken()`), shortening bad-credential lifetime. No secret added to code/logs. |
| 6 | CORS + headers | ✅ (n/a) | Unchanged. |
| 7 | Tx / finality | ✅ (n/a) | No funds path touched. |
| 8 | Replay / idempotency | ✅ (n/a) | No paid action touched. |
| 9 | Admin endpoints | ✅ (n/a) | Untouched. |
| 10 | Logs leaking secrets | ✅ | No token logging added in the client hook (grep clean). See accepted-risk below for the pre-existing query-param token. |
| 11 | Dependency risk | ✅ | No deps added; lockfile intact. |

## Findings / fixes
- **No new vulnerability introduced.** The change is security-neutral-to-positive
  (clears stale creds; removes a retry-to-death loop; bounds auto re-auth to
  avoid infinite signature prompts).
- **Behavior fix is test-backed:** `client/tests/wsAuthClose.spec.ts` pins
  `isAuthRejectClose` (1008/4001 → auth reject = clear+stop; 1000/1006/1011/1013
  → network = reconnect).

## Accepted risk (pre-existing — not introduced here)
- **Session token passed as a WS query param** (`?token=…`) and stored in
  `localStorage`. Query-param tokens can appear in intermediary access logs, and
  `localStorage` is readable by any XSS. Both are pre-existing design choices
  (browsers can't set WS headers). Out of scope for this surgical fix; flagged
  for a future hardening unit (e.g. short-lived WS ticket / cookie-based auth).

## Verification
- `pnpm --filter @workspace/frontier-al run check` ✓
- `pnpm --filter @workspace/frontier-al run test` ✓ (17 files / 87 tests, incl. new `wsAuthClose.spec.ts`)
- `pnpm --filter @workspace/frontier-al run build` ✓

## Ops note (not code)
`SESSION_SECRET` must be **set and stable across deploys** on Fly. If it is
rotated, all previously-issued tokens become invalid (`1008`); the new client
behavior self-heals (clear + re-sign) but every active user must re-sign. Do not
rotate it casually. Already flagged `[REQ][SEC]` in
`docs/DEPLOYMENT_ENV_CHECKLIST.md`.

**Verdict: PASS** (no funds surface; `algo-auditor` not required for this unit).
