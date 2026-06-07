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

## Outstanding
- O2 — WebSocket unauthenticated (LOW: broadcasts only already-public state).
- O3 — Sybil: new address ⇒ new player + welcome bonus (auth proves control,
  not human uniqueness).
- Multi-instance: move nonce store + rate-limit counters to Redis.
