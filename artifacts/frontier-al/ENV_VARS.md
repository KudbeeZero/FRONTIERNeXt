# ENV_VARS.md — Required Environment Variables

## Backend (Railway)

| Variable | Purpose | Example / Notes |
|----------|---------|-----------------|
| DATABASE_URL | Neon PostgreSQL connection string | `postgres://user:pass@host/db?sslmode=require` |
| ALGORAND_ADMIN_MNEMONIC | Admin wallet mnemonic | 25-word phrase |
| ALGORAND_ADMIN_ADDRESS | Admin wallet address | Algorand public address |
| SESSION_SECRET | HMAC key for wallet-auth session tokens (≥16 chars). **Now actively used** — if unset in production the server falls back to an ephemeral per-process key (sessions die on restart and cannot be shared across instances). Set a strong value. | random 64-char string |
| PUBLIC_BASE_URL | Railway service base URL (used for NFT metadata URLs) | `https://api.ascendancyalgo.xyz` |
| ALGORAND_NETWORK | `testnet` or `mainnet` | `mainnet` |
| UPSTASH_REDIS_REST_URL | Upstash Redis REST URL. **Required for multi-instance**: when set, auth nonces + the enumeration/auth rate limiters are shared across instances; when unset, they fall back to per-instance memory (correct for a single instance only). Also backs world events / battle replays. | `https://....upstash.io` |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis REST token | |
| CLIENT_ORIGIN | Vercel frontend URL for CORS | `https://ascendancyalgo.xyz` |
| NODE_ENV | Environment flag | `production` |
| PORT | Server listen port (Railway injects automatically) | `5000` |
| AI_ENABLED | Enable/disable AI faction turns | `false` |
| FORCE_NEW_ASA | Force new ASA creation on startup | `false` |
| ADMIN_KEY | Admin API key for privileged endpoints. **In production a missing key now FAILS CLOSED** (admin endpoints return 503) instead of granting open access. Sent via `x-admin-key` header only in prod. | random secret string |
| API_RATE_LIMIT | Coarse per-IP request ceiling across all `/api/*` (per minute). Anti-bulk-scrape / DoS backstop. | `1000` (default) |
| ENUMERATION_RATE_LIMIT | Strict per-IP limit (per minute) on ID/address-enumerable read endpoints (`/api/game/parcel/:id`, `/api/game/player/:id`, `/api/game/player-by-address/:address`, `/api/parcels/attackable`, etc.). Primary defense against scraping off-chain economic data. **Redis-backed** when Upstash is configured (shared across instances). | `90` (default) |
| AUTH_RATE_LIMIT | Per-IP limit (per minute) on `/api/auth/*` (nonce/verify). Blunts auth spam / signature-guessing. **Redis-backed** when Upstash is configured. | `20` (default) |
| ACTIONS_RATE_LIMIT | Per-IP limit (per minute) on `/api/actions/*` mutating game actions. | `60` (default) |
| ACTION_NONCE_TTL_MS | Age after which an `action_nonces` idempotency row is reaped by the periodic prune. Replay protection lasts this long, so it MUST exceed the legitimate retry window; normal play uses a fresh nonce per action and never relies on an older one. Floor `600000` (10 min — kept well above max request duration so the prune can never reap a still-in-flight claim). | `86400000` (24h default) |
| ACTION_NONCE_PRUNE_INTERVAL_MS | How often the server prunes expired `action_nonces` rows. Best-effort; failures never affect request handling. Floor `60000` (1 min). | `3600000` (hourly default) |
| PURCHASE_INTENT_TIMEOUT_MS | Age after which a still-pending `purchase_intent` (`submitting`/`confirmed`/`inventory_syncing`) is auto-flipped to `timeout`. PURELY off-chain telemetry — never touches payment/wallet/chain/NFT/settlement; the duplicate guard keys off `redeemed_payments`, not intents. Generous default so a legitimately slow buyer NFT opt-in is not timed out. Floor `60000` (1 min). | `604800000` (7d default) |
| PURCHASE_INTENT_REAP_INTERVAL_MS | How often the stale-purchase-intent reaper runs. Best-effort and `unref`'d; a failed run never throws or crashes the server. Floor `60000` (1 min). | `3600000` (hourly default) |
| BATTLE_TICK_INTERVAL_MS | Cadence of the `battle_tick` WS broadcast (the server's active-battle set, so clients drop resolved battles promptly). Gated — no work/broadcast when no clients are connected or no battles are active. Floor `250`. | `1000` (1s default) |
| BATTLE_RESOLVE_INTERVAL_MS | How often the battle auto-resolver polls for due battles (`resolveBattles`). **Player-felt:** a battle resolves up to one interval after its countdown reaches 0:00. Lower = snappier resolution but more frequent DB queries. Floor `1000` (1s) to protect the DB. | `5000` (5s default) |
| ELEVENLABS_API_KEY | **Optional.** ElevenLabs key for Comm Terminal whisper voice (text-to-speech). If unset, the Comm Terminal runs **text-only** — no network call is made. Never commit a real key. | _(unset → text-only)_ |
| COMM_TERMINAL_VOICE_ID | **Optional.** ElevenLabs voice id used for Comm Terminal whispers. Voice synthesis requires **both** this and `ELEVENLABS_API_KEY`; absent either, the terminal is text-only. | _(unset → text-only)_ |
| ADVICE_RATE_LIMIT | Per-IP limit (per minute) on the LLM terraform-advice endpoint. | `30` (default) |
| WALLET_AUTH_REQUIRED | Enforce wallet-signature auth on all mutating game endpoints. **Defaults to ON** (any value except `false`). Set to `false` ONLY during a split-host rollout window where the new client is not yet deployed, then flip back. | `true` (default) |
| WELCOME_BONUS_SYBIL_CHECK | Gate the 500 FRONTIER welcome bonus behind an on-chain minimum-balance check (anti-Sybil). **Defaults to ON**; set `false` to disable. | `true` (default) |
| WELCOME_BONUS_MIN_ALGO | Minimum wallet ALGO balance required to claim the welcome bonus. `0` disables the balance gate. | `1` (default) |
| ALGOD_URL | Custom Algorand node URL (optional, defaults to algonode) | `https://mainnet-api.algonode.cloud` |
| INDEXER_URL | Custom Algorand indexer URL (optional, defaults to algonode) | `https://mainnet-idx.algonode.cloud` |
| ALGOD_TOKEN | Algorand node API token (optional) | |
| INDEXER_TOKEN | Algorand indexer API token (optional) | |

## Frontend (Vercel)

| Variable | Purpose | Must be prefixed VITE_ |
|----------|---------|------------------------|
| VITE_WS_URL | WebSocket endpoint base URL | `wss://api.ascendancyalgo.xyz` |
| VITE_GAME_URL | Where the landing's "Enter Game" CTA navigates. Defaults to `/game` (same-origin — correct on the backend host). On a static homepage host (Cloudflare Pages) set this to the backend that serves the live game. | `https://frontiernext.fly.dev/game` |
| VITE_ALGOD_URL | Algorand node URL override (optional, defaults to testnet algonode) | `https://mainnet-api.algonode.cloud` |
| VITE_INDEXER_URL | Algorand indexer URL override (optional, defaults to testnet algonode) | `https://mainnet-idx.algonode.cloud` |

## Flags

- **CLIENT_ORIGIN**: Not currently set — must be configured for cross-origin deployment
- **VITE_WS_URL**: New — required for cross-domain WebSocket from Vercel → Railway
- **VITE_GAME_URL**: Set on the **static homepage host** (Cloudflare Pages) to
  `https://frontiernext.fly.dev/game` so the landing's "Enter Game" leaves the
  static site and opens the live, same-origin game served by the Fly backend.
  Leave unset on the backend host (defaults to `/game`).
- **VITE_ALGOD_URL / VITE_INDEXER_URL**: Currently default to testnet URLs; must be overridden for mainnet
- **SESSION_SECRET**: Listed as required in chain config validation but session middleware is not currently initialized — verify if sessions are needed before go-live
- **AI_ENABLED**: Should be `false` for initial multiplayer launch

---

## Replit Secrets Panel

When importing this project into Replit, add the following via **Tools → Secrets**:

### Required (App will not start without these)

| Secret Key | Where to get it |
|------------|----------------|
| `DATABASE_URL` | Replit Database tab → copy Connection URL |
| `ALGORAND_ADMIN_MNEMONIC` | Your admin Algorand wallet 25-word phrase |
| `ALGORAND_ADMIN_ADDRESS` | Corresponding admin wallet public address |
| `SESSION_SECRET` | Generate: `openssl rand -hex 32` |
| `PUBLIC_BASE_URL` | Your Replit app URL e.g. `https://yourapp.replit.app` |
| `ALGORAND_NETWORK` | `testnet` (testing) or `mainnet` (live launch) |

### Required for Mainnet (add when switching to mainnet)

| Secret Key | Value |
|------------|-------|
| `ALGOD_URL` | `https://mainnet-api.algonode.cloud` |
| `INDEXER_URL` | `https://mainnet-idx.algonode.cloud` |
| `VITE_ALGOD_URL` | `https://mainnet-api.algonode.cloud` |
| `VITE_INDEXER_URL` | `https://mainnet-idx.algonode.cloud` |

### Optional but Recommended

| Secret Key | Purpose |
|------------|---------|
| `UPSTASH_REDIS_REST_URL` | Redis caching (fallback to in-memory if absent) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `CLIENT_ORIGIN` | CORS origin if frontend is on a different domain |
| `ADMIN_KEY` | Random secret for admin-only API endpoints |
| `AI_ENABLED` | `false` to disable AI factions on launch |
| `VITE_WS_URL` | WebSocket URL if frontend/backend on different domains |

---

## Mainnet Toggle Checklist

To switch from testnet → mainnet, update or add the following secrets:

```
ALGORAND_NETWORK=mainnet
ALGOD_URL=https://mainnet-api.algonode.cloud
INDEXER_URL=https://mainnet-idx.algonode.cloud
VITE_ALGOD_URL=https://mainnet-api.algonode.cloud
VITE_INDEXER_URL=https://mainnet-idx.algonode.cloud
ALGORAND_ADMIN_MNEMONIC=<mainnet wallet 25-word phrase>
ALGORAND_ADMIN_ADDRESS=<mainnet wallet public address>
```

**First-run only (ASA creation):**
```
FORCE_NEW_ASA=true
```

After the first successful startup, record the new ASA IDs from server logs, then:
- Set `FORCE_NEW_ASA=false` (or remove it)
- Update ASA IDs in `replit.md`
- Fund the admin wallet with at least 5 ALGO before first run (covers ASA creation fees)
