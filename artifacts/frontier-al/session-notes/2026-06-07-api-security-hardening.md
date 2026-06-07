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

## Outstanding (next pass — highest priority)
- **O1 — no proof-of-wallet-ownership on writes.** `assertPlayerOwnership`
  trusts a client-supplied `playerId`; `connect-wallet` has no signature.
  Recommended: nonce + `algosdk.verifyBytes` → session token; replaces body
  `playerId` trust and gates the WebSocket. Touches the live LUTE/Pera wallet
  flow, so implement + test against the real connect path rather than blindly.
- O2 — WebSocket unauthenticated (broadcasts full state).
- O3 — Sybil: `player-by-address` auto-creates player + welcome bonus per address.
