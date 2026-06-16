# 2026-06-07 — API access-control & EPI-scraping hardening

Goal: lock down the API so it cannot be scraped for off-chain game-economy
intelligence (e.g. "which plots hold the most tokens") and close admin-auth
gaps. Full write-up in [`docs/audit/2026-06-07-api-access-control-audit.md`](../docs/audit/2026-06-07-api-access-control-audit.md).

## Done
- New `server/security.ts`: hardened `requireAdminKey` (fails CLOSED in prod,
  header-only, constant-time compare), `apiReadLimiter`, `enumerationLimiter`,
  `clampLimit`.
- `server/index.ts`: coarse `apiReadLimiter` mounted on all `/api`.
- `server/routes.ts`:
  - removed the old fail-open `requireAdminKey`; import the hardened one.
  - guarded `/api/admin/battles-live`, `/api/admin/ai-activity`,
    `/api/admin/mint-status/:plotId`.
  - `enumerationLimiter` mounted (via `app.use`) on 9 ID/address-enumerable
    read endpoints.
  - clamped `/api/world/events?limit` to ≤200.
  - `/api/blockchain/status` no longer leaks admin live balances to anon callers.
- `ENV_VARS.md`: documented `API_RATE_LIMIT`, `ENUMERATION_RATE_LIMIT`, and the
  `ADMIN_KEY` fail-closed change.

## Verified
- `pnpm run check` clean; `pnpm run test:server` 53/53 pass.
- Runtime tests: enumeration limiter → 429 past threshold; admin gate → 503
  when key unset in prod; clampLimit bounds correctly.

## Pass 2 — wallet-signature auth (O1 CLOSED)
Sign-In With Algorand for LUTE / Pera / Defly / Kibisis (any use-wallet provider).
- `server/auth.ts` + `server/auth.spec.ts` (8 tests): one-time nonce, ed25519
  verification of a wallet-signed 0-ALGO self-pay (note = `FRONTIER-AUTH:v1:<nonce>`,
  never submitted), HMAC session tokens (SESSION_SECRET), cookie + Bearer.
- `server/routes.ts`: `/api/auth/{nonce,verify,me,logout}`, a global ownership
  guard over all mutating routes (body player-id must equal session player →
  impersonation = 403), and `assertPlayerOwnership` upgraded as defense-in-depth.
- Client: `lib/authToken.ts`, `lib/auth.ts` (authenticateWallet/logout),
  Bearer injection in `lib/queryClient.ts`, auto-login + state in `WalletContext`.
- Toggle: `WALLET_AUTH_REQUIRED` (default ON). `SESSION_SECRET` now actively used.

### Verified (pass 2)
- `tsc` clean; 61/61 server tests pass; HTTP integration test → 401/403/200 as
  expected; full Vite + esbuild build succeeds.

## Pass 3 — WebSocket auth + per-viewer scoping (O2 CLOSED)
- `server/stateScope.ts` (+ spec, 4 tests): `scopeGameStateFor` — own parcels/
  player full; others' stored resources + balances redacted; AI left intact.
- `server/wsServer.ts`: `/ws` requires session token (`?token=` or cookie),
  closes 1008 if missing; broadcasts scoped per connection.
- `server/routes.ts`: `/api/game/state` scoped to the caller's session.
- Client: `useGameSocket` sends token + reconnects on auth; `LandSheet` shows
  "classified — recon required" for non-owned plots.
- Verified: 65/65 server tests; real-WS integration test (1008 reject + scoped
  payload); full build.

## Pass 4 — Sybil gating for welcome bonus (O3 CLOSED)
- `server/services/chain/eligibility.ts` (+ spec, 6 tests): welcome bonus gated
  behind min on-chain ALGO balance (`WELCOME_BONUS_MIN_ALGO`, default 1;
  `WELCOME_BONUS_SYBIL_CHECK` toggle). Fails closed on algod outage; bonus stays
  claimable on first eligible login.
- `server/routes.ts`: `maybeGrantWelcomeBonus()` helper used in both grant paths
  (auth/verify + player-by-address).
- `validate-env.js`: warns on weak SESSION_SECRET, missing ADMIN_KEY, disabled
  auth/Sybil flags.
- Verified: 71/71 server tests; env-validator warnings; full build.

## Pass 5 — multi-instance readiness (Redis-backed security state)
- `server/services/redis.ts`: added isRedisEnabled/setWithPx/getDel/rlIncr (Lua
  atomic incr+pexpire+pttl)/rlDecr/rlDelete (reuse existing getRedis + graceful-null).
- `server/rateLimitStore.ts` (new): custom express-rate-limit v7 Store, Redis-backed
  with MemoryStore fallback (fail-safe). + `rateLimitStore.spec.ts` (4 tests).
- `server/auth.ts`: nonce store Redis-backed (SET px + atomic GETDEL), async, Map
  fallback; verifyAuthAndNonce now async. auth.spec.ts updated to await.
- `server/security.ts`: enumerationLimiter Redis-backed; new authLimiter on /api/auth/*
  (AUTH_RATE_LIMIT, default 20). Coarse apiRead/actions/advice stay per-instance.
- `server/routes.ts`: await issueNonce/verifyAuthAndNonce; mount authLimiter.
- `server/index.ts`: startup log for distributed vs per-instance mode.
- WS _connByIp left per-instance (documented — distributed counter leaks on crash).
- Verified: tsc clean; 75/75 tests; authLimiter integration test (200×3→429); build OK.

## Outstanding (operational only — no open audit findings)
- Secret rotation; optional on-chain account-age heuristic if Sybil pressure persists.
