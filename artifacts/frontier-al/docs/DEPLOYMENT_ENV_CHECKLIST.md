# Deployment Env-Var Checklist (Railway + Vercel)

Single source of truth for going live. Pairs with `ENV_VARS.md` (descriptions)
and the security work in `docs/audit/2026-06-07-api-access-control-audit.md`.

Legend: **[REQ]** boot fails / unsafe without it · **[SEC]** security-critical ·
**[OPT]** optional · default shown in `()`.

---

## 1. Backend — Railway (API server)

### Minimum to boot (validated by `validate-env.js` + `assertChainConfig`)
| Var | Notes |
|-----|-------|
| `DATABASE_URL` **[REQ]** | Neon Postgres conn string (`...?sslmode=require`). |
| `ALGORAND_ADMIN_MNEMONIC` **[REQ][SEC]** | 25-word admin seed. **Store in a secrets manager, never a committed `.env`.** Controls the treasury. |
| `ALGORAND_ADMIN_ADDRESS` **[REQ]** | Admin public address (must match the mnemonic). |
| `SESSION_SECRET` **[REQ][SEC]** | ≥16-char random string. Signs wallet-auth session tokens. If unset/weak → ephemeral key (sessions reset on restart). Generate: `openssl rand -hex 32`. |
| `PUBLIC_BASE_URL` **[REQ]** | This service's public URL, e.g. `https://api.ascendancyalgo.xyz` (used for NFT metadata URLs). |
| `ALGORAND_NETWORK` **[REQ]** | `mainnet` or `testnet`. Must be explicit in prod. |
| `FREE_PURCHASES` **[TESTNET-ONLY]** | `true` → plot/commander purchases are free (no ALGO/ASCEND charge). **MUST be unset (or `ECONOMY_MODE=production`) for any mainnet deploy** — `computeFreePurchases` force-disables it on mainnet/production, but do not rely on that as the only guard: leave it out of mainnet config. |
| `NODE_ENV` | Set `production`. Enables strict CSP, secure cookies, fail-closed admin. |
| `PORT` | Railway injects automatically. |

### Strongly recommended for production
| Var | Notes |
|-----|-------|
| `ADMIN_KEY` **[SEC]** | Gates `/api/admin/*`. **If unset, admin endpoints return 503 in prod (fail-closed).** Set a long random secret; send via `x-admin-key` header. |
| `CLIENT_ORIGIN` **[SEC]** | Comma-separated allowed browser origins for CORS, e.g. `https://ascendancyalgo.xyz,https://frontier.vercel.app`. No wildcard. Required for the split-host (Vercel) frontend + cross-site cookies. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` **[SEC]** | **Required if running >1 instance.** Enables distributed auth nonces + enumeration/auth rate limits (and world-event/replay persistence). Without them everything falls back to per-instance memory (correct for a *single* instance only). Startup log prints `Distributed mode ✓` vs `Per-instance mode`. |

### Security toggles — safe defaults; set only to override
| Var (default) | Notes |
|---------------|-------|
| `WALLET_AUTH_REQUIRED` (`true`) **[SEC]** | Keep `true`. Only set `false` for a brief split-host rollout window (see §3). |
| `WELCOME_BONUS_SYBIL_CHECK` (`true`) **[SEC]** | Keep `true` — gates the welcome bonus behind a min ALGO balance. |
| `WELCOME_BONUS_MIN_ALGO` (`1`) | Min wallet ALGO to claim the bonus. `0` disables the balance gate. |
| `API_RATE_LIMIT` (`1000`) | Coarse per-IP/min ceiling across all `/api` (per-instance). |
| `ENUMERATION_RATE_LIMIT` (`90`) | Per-IP/min on ID/address-enumerable reads (Redis-backed). Anti-scrape. |
| `AUTH_RATE_LIMIT` (`20`) | Per-IP/min on `/api/auth/*` (Redis-backed). |
| `ACTIONS_RATE_LIMIT` (`60`) | Per-IP/min on `/api/actions/*` (per-instance). |
| `ACTION_NONCE_TTL_MS` (`86400000`) | TTL before an `action_nonces` row is pruned; replay protection lasts this long (floor 10 min, above max request duration). |
| `ACTION_NONCE_PRUNE_INTERVAL_MS` (`3600000`) | How often expired `action_nonces` are pruned (best-effort; floor 60s). |
| `PURCHASE_INTENT_TIMEOUT_MS` (`604800000`) | Age after which a still-pending `purchase_intent` is auto-flipped to `timeout` (off-chain telemetry only; floor 60s; default 7d — generous because `inventory_syncing` can wait on a buyer NFT opt-in). |
| `PURCHASE_INTENT_REAP_INTERVAL_MS` (`3600000`) | How often the stale-purchase-intent reaper runs (best-effort, `unref`'d; floor 60s). |
| `BATTLE_TICK_INTERVAL_MS` (`1000`) | Cadence of the `battle_tick` WS broadcast (active-battle set; gated on clients+active battles; floor 250ms). |
| `BATTLE_RESOLVE_INTERVAL_MS` (`5000`) | How often the battle auto-resolver polls for due battles. Player-felt: a battle resolves up to one interval after 0:00. Lower = snappier but more DB queries; floor 1000ms. |
| `ELEVENLABS_API_KEY` (optional) | ElevenLabs key for Comm Terminal whisper voice. Unset → text-only (no network call). Secret — host env only, never committed. |
| `COMM_TERMINAL_VOICE_ID` (optional) | ElevenLabs voice id for Comm Terminal whispers. Needs `ELEVENLABS_API_KEY` too; absent either → text-only. |
| `ADVICE_RATE_LIMIT` (`30`) | Per-IP/min on the LLM terraform-advice endpoint. |
| `WS_MAX_CONN_PER_IP` (`25`) | Max WebSocket connections per IP (per-instance; `0` = off). |
| `WS_MAX_CONN` (`0`) | Global WebSocket connection cap (`0` = unlimited). |

### Optional
| Var | Notes |
|-----|-------|
| `AI_ENABLED` (`false`) | Keep `false` for initial multiplayer launch. |
| `FORCE_NEW_ASA` / `FORCE_NEW_FRONTIER_ASA` (`false`) | Leave `false` in prod (would mint a new token). |
| `ALGOD_URL` / `INDEXER_URL` | Custom node URLs (default: algonode for the chosen network). |
| `ALGOD_TOKEN` / `INDEXER_TOKEN` | Tokens for custom nodes. |
| `ANTHROPIC_API_KEY` | Enables the LLM advisor feature; heuristic fallback if unset. |

---

## 2. Frontend — Vercel (SPA)

**All `VITE_`-prefixed and read at BUILD time** — set them in Vercel *before*
building, and rebuild after any change.

| Var | Notes |
|-----|-------|
| `VITE_API_URL` **[REQ for split-host]** | Backend origin, e.g. `https://api.ascendancyalgo.xyz`. Empty only when the API serves the SPA same-origin. |
| `VITE_WS_URL` **[REQ for split-host]** | Backend WebSocket base, e.g. `wss://api.ascendancyalgo.xyz`. |
| `VITE_ALGORAND_NETWORK` | `mainnet` or `testnet` (must match backend). |
| `VITE_ALGOD_URL` / `VITE_INDEXER_URL` **[OPT]** | Override for mainnet; default to testnet algonode. |

---

## 3. Go-live order & gotchas

1. **Secrets first.** Put `ALGORAND_ADMIN_MNEMONIC` in Railway's secret store (not a file). Generate fresh `SESSION_SECRET` + `ADMIN_KEY`.
2. **CORS + cookies.** Set `CLIENT_ORIGIN` to the exact Vercel origin(s). Cross-site cookies need `NODE_ENV=production` (sets `SameSite=None; Secure`) over HTTPS — both hosts must be HTTPS. The Bearer-token path is the primary auth channel, so third-party-cookie blocking won't break login.
3. **Multi-instance.** If Railway scales beyond 1 replica, set the `UPSTASH_*` pair *before* scaling, and confirm the boot log shows `Distributed mode ✓`.
4. **Split-host deploy ordering.** The SPA (Vercel) and API (Railway) deploy independently. To avoid a window where an old SPA can't write against an auth-enforcing API: deploy the new SPA first, *or* temporarily set `WALLET_AUTH_REQUIRED=false`, deploy both, then flip it back to `true`. (On a single-host Railway deploy that serves the built SPA, there's no window.)
5. **Verify after deploy.** Boot log should show: `ALGORAND_NETWORK=… ✓`, blockchain ready, and the distributed/per-instance mode line. Hit `/health` (200) and `/api/blockchain/status` (no admin balances unless `x-admin-key` is sent).

---

## 4. Quick copy-paste (Railway, production single-instance)

```
NODE_ENV=production
DATABASE_URL=postgres://…?sslmode=require
ALGORAND_NETWORK=mainnet
ALGORAND_ADMIN_MNEMONIC=…25 words…        # secrets manager
ALGORAND_ADMIN_ADDRESS=…
SESSION_SECRET=…openssl rand -hex 32…
ADMIN_KEY=…openssl rand -hex 32…
PUBLIC_BASE_URL=https://api.ascendancyalgo.xyz
CLIENT_ORIGIN=https://ascendancyalgo.xyz
AI_ENABLED=false
# add when scaling >1 instance:
# UPSTASH_REDIS_REST_URL=…
# UPSTASH_REDIS_REST_TOKEN=…
```
