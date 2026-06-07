# Ascendancy — 90-Day Roadmap

_June 2026. Condenses the LUT release ladder (v0.1→v1.0) into a realistic 90-day plan and
defines the next feature branches. Updated after the blocker + hardening passes (PR #2 merged)._

---

## Phase 1 — Weeks 1–2 · Backend live on testnet (Release v0.1–v0.2)
Goal: the game is playable on the live domain.
- Deploy backend to Railway; set CORS / `PUBLIC_BASE_URL`; point Cloudflare at it (see TESTNET_AUDIT.md).
- Rotate `DATABASE_URL` / `SESSION_SECRET`; set strong `ADMIN_KEY`.
- Verify globe + WebSocket + battle resolution end-to-end on testnet.
- Wire the new `CI` workflow as a required status check.
- **Exit:** globe loads, a full purchase→build→attack→resolve loop works on testnet.

## Phase 2 — Weeks 3–6 · Economy, combat depth, balance (Release v0.3–v0.5)
- `$ASCEND` testnet ASA minted (display + mint params already renamed); record the ID.
- Commander gate + concurrent-attack caps (LUT `feature/commander-gate`).
- Run `npm run sim` at scale (10k+) across attacker profiles; lock biome balance pre-mainnet.
- Ship `feature/economic-guardrails` (below).
- **Exit:** economy panel shows ASCEND; balance validated; no treasury-drain exploit.

## Phase 3 — Weeks 7–12 · Mainnet prep + content (Release v1.0)
- Security: rate-limit all `/api/*`, Sybil resistance, idempotency; pen-test pass.
- Observability in place (`feature/observability`); Neon plan upgraded for schedulers.
- HILDA content worker + Jarvis hub (need API keys — see LUT; deferred).
- Mainnet ASA mint checklist; community target.
- **Exit:** security audit passed, mainnet ASA minted, economics finalized.

---

## New feature branches

### ✅ Built this session (on `claude/advisor-admin-sim`)
- **`feature/battle-balance-sim`** — `server/engine/battle/sim.ts` + `npm run sim` + invariant
  tests. Validates `BIOME_DEFENSE_MOD` (mountain hardest → water easiest). Ongoing: pre-mainnet
  10k-battle report across profiles.
- **`feature/terraform-advisor`** — `recommendTerraform()` (heuristic + optional Claude via
  `ANTHROPIC_API_KEY`), `GET /api/plots/:plotId/terraform-advice`, in-panel UI. Next: persist
  advice history; multi-step plans.
- **`feature/admin-dashboard`** — `/admin` ops dashboard + `/api/admin/metrics`. Next: auth
  hardening (rotate-able session vs raw key), charts, mission/Jarvis integration.

### 🔜 Specced next
- **`feature/observability`**
  - Objective: production-grade logging + metrics. Replace ad-hoc `console.*` with `pino`
    (leveled, `LOG_LEVEL` env), add request IDs (correlation), and a `/api/metrics` surface
    building on the existing `_apiRouteTimings` (`server/routes.ts`).
  - Key files: `server/index.ts` (logger + request-id middleware), `server/routes.ts` (metrics),
    a small `server/log.ts`.
  - DO NOT TOUCH: game logic, balance, DB transactions.
  - Acceptance: structured JSON logs in prod (info gated by `LOG_LEVEL`); `/api/metrics` returns
    route + process stats; no response bodies logged.
- **`feature/economic-guardrails`**
  - Objective: close the audit's economic-exploit + Sybil items.
  - Scope: treasury-drain protection (cap attacker pillage/treasury outflow per window), emission
    cap enforcement (cross-check `projectedDailyEmissions`), idempotency keys on purchase/mint
    (dedupe retried txns — `mintIdempotency` table already exists), wallet-Sybil resistance
    (one active account per wallet address at purchase).
  - Key files: `server/storage/db.ts` (purchase/mint/attack paths), `server/routes.ts`
    (`/api/actions/purchase`, mint), shared economy config.
  - DO NOT TOUCH: balance constants; reuse existing idempotency tables/patterns.
  - Acceptance: tests proving repeated-retry purchase/mint is idempotent; a treasury-drain
    simulation stays within bounds; second account per wallet is rejected.

### Deferred (need keys / migrations — Needs Kudbee)
- HILDA video pipeline (Anthropic/ElevenLabs/HeyGen/Kling/Shotstack/Bannerbear/YouTube keys).
- Jarvis hub (missions DB migration + routes + UI).
- Prediction markets / lootbox frontends (schemas exist).
