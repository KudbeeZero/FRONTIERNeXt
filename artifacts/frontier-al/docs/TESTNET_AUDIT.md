# Ascendancy — Testnet Readiness Audit

_Generated June 2026. Companion to `SECURITY_AUDIT_REPORT.md` and the LUT._

Purpose: a practical checklist to bring the backend up on testnet and validate it on the
domain before mainnet. Frontend is live on Cloudflare Pages; the backend is the gating piece.

---

## 1. Environment matrix (Railway backend)

| Var | Required | Notes |
|-----|----------|-------|
| `ALGORAND_NETWORK` | ✅ | `testnet`. Startup asserts a valid value in production. |
| `DATABASE_URL` | ✅ | Neon Postgres. **Rotate** the value exposed earlier before mainnet. |
| `PUBLIC_BASE_URL` | ✅ | `https://frontierprotocol.app`. Now env-only — `/faction/:name` + `/nft/metadata` 503 without it. |
| `CLIENT_ORIGIN` | ✅ | Frontend origin(s), comma-separated, for CORS. |
| `SESSION_SECRET` | ✅ | Strong random. **Rotate** from any testnet value. |
| `ADMIN_KEY` | ✅ | Strong random; gates `/api/admin/*` and `/admin` dashboard. |
| `AI_ENABLED` | optional | Opt-in: `true` to enable AI faction turns (default off). |
| `ACTIONS_RATE_LIMIT` | optional | Per-IP/min cap on `/api/actions/*` (default 60). |
| `WS_MAX_CONN_PER_IP` | optional | WS connections per IP (default 25; `0` disables). |
| `ADVISOR_MODEL` / `ANTHROPIC_API_KEY` | optional | Enables the LLM terraform advisor; heuristic used without it. |
| Algorand / Redis keys | ✅ | Algod/indexer + Upstash Redis per existing `.env.example`. |

## 2. Bring-up sequence (LUT Blocker 1 + 4)
1. Railway: root dir `artifacts/frontier-al`, paste env block, deploy → get public URL.
2. Set `PUBLIC_BASE_URL`, `CLIENT_ORIGIN`, `ALGORAND_NETWORK=testnet`, `ADMIN_KEY`, rotate secrets.
3. Cloudflare: set `VITE_API_URL` + `VITE_WS_URL` → Railway URL; redeploy.
4. Verify globe loads, parcels render, WebSocket connects.

## 3. Smoke tests (run against the Railway URL)
```bash
curl $URL/health                         # 200 "OK"
curl $URL/api/game/slim-state            # parcels array
curl $URL/api/blockchain/status          # network: testnet
curl $URL/api/factions                   # 4 factions
curl $URL/api/economics                  # treasury/supply (200 once chain ready)
curl $URL/nft/metadata/1                 # ARC-3 metadata, live biome (503 if PUBLIC_BASE_URL unset)
curl "$URL/api/plots/1/terraform-advice?goal=defense"   # advisor recommendation
curl -H "x-admin-key: $ADMIN_KEY" $URL/api/admin/status  # ops probe
# WebSocket: open wss://<host>/ws → expect periodic {"type":"ping"}; reply {"type":"pong"}
```

## 4. Security posture (post-hardening)
Covered now:
- Rate limiting on `/api/actions/*` (per-IP); `trust proxy` set.
- `express.json` body cap (1mb); response bodies no longer logged in production.
- `PUBLIC_BASE_URL` env-only (no Host-header injection into on-chain metadata).
- `/api/testnet/progress` GET+POST disabled on mainnet.
- WebSocket `maxPayload` 64KB + per-IP connection cap.
- Admin endpoints gated by `ADMIN_KEY`; helmet headers; network startup assertion.

Still open before mainnet (operator):
- Rotate `DATABASE_URL` / `SESSION_SECRET`; set strong `ADMIN_KEY`.
- Rate limiting across all `/api/*` (not just actions); wallet-Sybil resistance; purchase/mint
  idempotency. (See `feature/economic-guardrails` in the 90-day roadmap.)

## 5. Balance validation
The battle engine is canonical; biome defense follows `BIOME_DEFENSE_MOD` (mountain hardest,
water easiest). Confirm before mainnet:
```bash
npm run sim        # win-rate table by biome — expect monotonic mountain→water
npm run test:server  # includes sim/terraform/advisor invariants
```

## 6. Go / No-Go for testnet
- [ ] Backend deployed; `/health` + `/api/game/slim-state` green
- [ ] Globe + WebSocket connect from the live frontend (no CORS errors)
- [ ] `ALGORAND_NETWORK=testnet`, `PUBLIC_BASE_URL`, `CLIENT_ORIGIN`, `ADMIN_KEY` set
- [ ] `/admin` reachable with the key; status panel healthy
- [ ] `npm run sim` shows the expected biome gradient
- [ ] Terraform a plot → `/nft/metadata/:plotId` reflects the new biome within the 1h cache
