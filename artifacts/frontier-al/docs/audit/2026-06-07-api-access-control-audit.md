# API Access-Control & EPI-Scraping Audit — 2026-06-07

**Scope:** Full-stack review of the FRONTIER (Ascendancy) API surface, focused on
preventing unauthorized access to and bulk scraping of **off-chain
game-economy intelligence** ("EPI") — e.g. which parcels hold the most
resources, who holds the largest balances, live battle state.

**Author:** Security audit pass (claude/security-audit-3hwgW).

---

## 0. Key framing — what is actually secret

A critical distinction drives this whole audit:

- **On-chain data is public by design.** The admin/treasury wallet balance, ASA
  total supply, NFT ownership, and every player's wallet balance are all
  queryable directly on the Algorand blockchain (indexer/explorer). The API
  **cannot hide these** — anyone can read them on-chain regardless of what our
  endpoints return.
- **Off-chain game state is NOT public.** Per-parcel stored resources
  (`ironStored` / `fuelStored` / `crystalStored`), in-game FRNTR balances,
  leaderboards, "richest/attackable plots", live pending battles, AI faction
  inventories, and market positions live only in our Postgres DB and are
  exposed **only** through the API.

**Therefore the EPI worth defending = the off-chain game intelligence.** The
"someone gets an API and runs a spreadsheet to see which plots have the most
tokens" threat is real and was previously wide open. That is what this pass
hardens.

---

## 1. Findings

### CRITICAL

| # | Finding | Location |
|---|---------|----------|
| C1 | **Admin auth failed OPEN.** `requireAdminKey()` returned `true` when `ADMIN_KEY` was unset. A production deploy that forgot to set the key silently exposed `/api/game/reset` (full DB wipe), season/market controls, and all admin reads to the public internet. | `server/routes.ts` (old `requireAdminKey`) |
| C2 | **Two admin endpoints had NO guard at all** — `/api/admin/battles-live` and `/api/admin/ai-activity` were fully public, leaking live attack schedules and AI faction inventories. | `server/routes.ts` |
| C3 | **Unthrottled enumeration of off-chain economic data.** Only `/api/actions/*` was rate-limited. Every read endpoint — including ID-keyed lookups (`/api/game/parcel/:id`, `/api/game/player/:id`, `/api/game/player-by-address/:address`) and the resource-sorted `/api/parcels/attackable` — could be walked at machine speed to dump the entire economy. This is the headline "spreadsheet scrape" vector. | `server/routes.ts`, `server/index.ts` |

### HIGH

| # | Finding | Location |
|---|---------|----------|
| H1 | `/api/admin/mint-status/:plotId` accepted the admin key via **query string** (captured by access logs/proxies) and also failed open when `ADMIN_KEY` was unset. | `server/routes.ts` |
| H2 | `/api/world/events` had an **unbounded** caller-supplied `limit` — `?limit=999999` dumps the entire event log in one request. | `server/routes.ts` |
| H3 | `/api/blockchain/status` broadcast the admin wallet's **live ALGO + FRNTR balances** to anonymous callers (operational treasury intelligence; unnecessary for the client). | `server/routes.ts` |
| H4 | Admin-key comparison was a plain `!==` (timing side-channel). | `server/routes.ts` |

### RESOLVED in pass 2 (wallet-signature auth)

| # | Finding | Status |
|---|---------|--------|
| O1 | **No proof-of-wallet-ownership on writes.** Now CLOSED — see §4. Every mutating endpoint requires a verified wallet session and rejects any player-identity that doesn't match it. | ✅ FIXED |

### OUTSTANDING

| # | Finding | Severity |
|---|---------|----------|
| O2 | **WebSocket is unauthenticated** and broadcasts game state to any connection. Low practical impact: the broadcast payload is the same public, rate-limited game state already served by `/api/game/state`. Gate it only if per-player private channels are added. | LOW |
| O3 | No Sybil resistance — a new wallet address still yields a fresh player + welcome bonus. Auth proves *control* of an address, not that it's a distinct human. Mitigate with on-chain heuristics / minimum-balance gating before mainnet incentives. | MEDIUM |

---

## 2. Fixes applied in this pass

All centralized in a new module **`server/security.ts`** and wired into
`server/index.ts` + `server/routes.ts`.

1. **`requireAdminKey` hardened (C1, H1, H4):**
   - **Fails CLOSED in production** — missing `ADMIN_KEY` → `503`, never open.
   - **Header-only in production** (`x-admin-key`); query string accepted only
     in dev for convenience (so it never lands in prod access logs).
   - **Constant-time comparison** (`crypto.timingSafeEqual`).
   - Now imported everywhere instead of the old fail-open closure.

2. **Admin endpoints locked down (C2, H1):** `/api/admin/battles-live`,
   `/api/admin/ai-activity`, and `/api/admin/mint-status/:plotId` now all call
   `requireAdminKey`.

3. **Tiered rate limiting (C3):**
   - **`apiReadLimiter`** — coarse per-IP ceiling across the *entire* `/api`
     surface (default 1000/min, `API_RATE_LIMIT`). DoS / bulk-scrape backstop.
   - **`enumerationLimiter`** — strict per-IP cap (default 90/min,
     `ENUMERATION_RATE_LIMIT`) mounted on the nine ID/address-enumerable read
     endpoints. A real client touches these occasionally; a scraper walking the
     keyspace gets throttled to a crawl. This is the primary EPI defense.

4. **`/api/world/events` clamped (H2):** caller `limit` bounded to ≤200 via
   `clampLimit`.

5. **`/api/blockchain/status` minimized (H3):** admin live balances are no
   longer returned to anonymous callers — surfaced only to an authenticated
   admin (`x-admin-key`). The admin *address* stays (clients need it as a
   payment target; it is public on-chain anyway).

**Verification:** `tsc` clean; all 53 server tests pass; isolated runtime tests
confirm the enumeration limiter returns `429` past the threshold, the admin
gate returns `503` when the key is unset in production, and `clampLimit` bounds
correctly. Express 5 path patterns validated at runtime.

### New / changed env vars
See `ENV_VARS.md`: `API_RATE_LIMIT`, `ENUMERATION_RATE_LIMIT`, plus the
`ADMIN_KEY` behavior change (fail-closed, header-only in prod).

---

## 4. Pass 2 — wallet-signature authentication (closes O1)

Rate limiting throttles scraping but does not stop a determined actor from
*acting as another player*. Pass 2 makes that impossible.

**Mechanism — Sign-In With Algorand (wallet-agnostic):**
1. `POST /api/auth/nonce { address }` → server issues a one-time, 5-min,
   single-use nonce bound to the address.
2. The wallet signs a **0-ALGO self-payment** whose note is
   `FRONTIER-AUTH:v1:<nonce>`. Every supported wallet (LUTE, Pera, Defly,
   Kibisis) can sign this — it is the same transaction shape the game already
   uses for actions, so no provider-specific arbitrary-byte signing is needed.
   The transaction is **never submitted to the chain**.
3. `POST /api/auth/verify { address, signedTxn, nonce }` → server verifies the
   ed25519 signature against the address (Node `crypto`, no external deps),
   consumes the nonce, resolves/creates the player, and issues an
   **HMAC-signed, 7-day session token** (keyed on `SESSION_SECRET`), set as an
   httpOnly cookie and returned for `Authorization: Bearer` use.

**Enforcement:**
- A single global guard covers every mutating route
  (`/api/{actions,trade,markets,plots,sub-parcels,factions}`): a valid session
  is required, and any `playerId`/`attackerId`/`sellerId`/`buyerId` in the body
  **must** equal the session's player → acting on behalf of another player now
  returns **403**.
- `assertPlayerOwnership` (the 6 core action endpoints) independently enforces
  the same, as defense in depth.
- Toggle with `WALLET_AUTH_REQUIRED` (default ON).

**Implementation:** `server/auth.ts`, `server/auth.spec.ts` (8 tests),
auth routes + global guard in `server/routes.ts`; client `lib/auth.ts`,
`lib/authToken.ts`, Bearer injection in `lib/queryClient.ts`, auto-login in
`contexts/WalletContext.tsx`.

**Verified:** `tsc` clean; 61/61 server tests pass (incl. real algosdk
signature round-trips, wrong-nonce/wrong-address/replay rejection); HTTP
integration test confirms 401 (no session) / 403 (forged playerId) / 200
(matching); full production build (Vite + esbuild) succeeds.

**Operational notes:**
- Set a strong `SESSION_SECRET` (else ephemeral key → sessions reset on restart).
- Nonce store is in-memory (single instance). Back it with Redis for multi-instance.
- Split-host (Vercel SPA + separate API): deploy the client first or set
  `WALLET_AUTH_REQUIRED=false` briefly, since cookies need `SameSite=None;Secure`
  and the Bearer token path needs the updated client.

## 5. Remaining recommendations

- **O3 (Sybil):** gate welcome-bonus / mainnet incentives behind on-chain
  heuristics (account age, minimum balance) — auth proves address control, not
  human uniqueness.
- **O2 (WebSocket):** reuse the session token to gate the WS upgrade if/when
  per-player private channels are introduced.
- **Multi-instance:** move the auth nonce store and rate-limit counters to the
  existing optional Redis service before horizontal scaling.
- **Secrets hygiene:** ensure `SESSION_SECRET` and `ADMIN_KEY` are set and
  rotated; keep `ALGORAND_ADMIN_MNEMONIC` in a secrets manager, never `.env`.
