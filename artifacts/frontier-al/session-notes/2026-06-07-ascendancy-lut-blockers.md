# Session — Ascendancy LUT Blockers + WEEK 1 roadmap

Date: 2026-06-07
Branch: `claude/ascendancy-blockers-lut-2Hhao`

Worked the ASCENDANCY_LUT.md roadmap in priority order. All changes additive/targeted;
`npm run check` (tsc) clean after every change; battle-engine determinism smoke test passes.

## Done
- **Blocker 2 / Phase 1** — Removed stray AI instruction comment committed as code in
  `server/routes.ts` (~line 219). Also removed an accompanying broken dead import
  (`LAND_PURCHASE_USD_PROD`, a non-existent export from the same bad paste) that the
  syntax corruption had been masking. Build unblocked.
- **Blocker 3 / Phase 2 (Pass A)** — Routed `deployAttack` and `resolveBattles`
  (`server/storage/db.ts`) through `resolveBattle()` (the engine). Removed the duplicate
  inline power math. Crystal folded into `commanderBonus` via `CRYSTAL_POWER_FACTOR`;
  radar folded by pre-scaling attacker inputs by `radarMod`; morale/biome/defense factors
  match the engine constants exactly. Seed = `hashSeed(battleId, startTs)` (deterministic).
  NOTE: engine `BIOME_DEFENSE_MOD` (mountain 1.4 / water 0.5 / swamp 1.1 / volcanic 1.3)
  is now canonical and matches the LUT/HILDA documented design; it differs from the stale
  `schema.biomeBonuses.defenseMod` the inline code used for those 4 biomes. `tuning.ts`
  untouched. Resolution recomputes from the stored battle row + live target (Pass A) — see
  report for snapshot caveat.
- **Security checklist / Phase 3** — Fixed `AI_ENABLED` inversion in the routes.ts scheduler
  (`!== "false"` → `=== "true"`). Storage-layer guards (`DbStorage.runAITurn`,
  `MemStorage.runAITurn`) and `ai-engine.ts` were already opt-in (already resolved).
- **§8 / Phase 4** — Token display rebrand FRNTR/"FRONTIER token" → ASCEND across client
  panels/pages/hooks, and ASA mint params (`asa.ts`) name/unitName → `Ascend`/`ASCEND`.
  Display layer only — DB columns, balance constants, env keys, on-chain note protocol
  markers (`FRNTR:` tx-note prefix, `game:"FRONTIER"`), brand/game-name strings, and code
  identifiers (`commanderMintFrntr`, `frontierAsaId`, `FRONTIER_ASSETS`, etc.) all preserved.
- **Prompt C** — Fixed `data_centre` yield bug in `db.ts` (`newYieldMult += 0.05 * level`).
  Added minimal additive yield surfacing in the existing parcel upgrade UI (`LandSheet.tsx`)
  since no `BaseInfoPanel` component exists by that name.

## Already resolved (skipped)
- **Prompt B** — contextual BattleWatchModal event feed already fully implemented and wired
  (parcel-improvement / biome / commander / power-aware, deterministic; GameLayout passes
  the resolved targetParcel). Left untouched.
- **Prompt A** — `source_parcel_id` column already in `db-schema.ts` + shared schema, and
  `deployAttack` already persists it. Migration already applied.

## Needs Kudbee (deferred)
- HILDA worker (v1 + v2 pipeline): external API keys (Anthropic, ElevenLabs, HeyGen, Kling,
  Shotstack, Bannerbear, YouTube). No `workers/` dir created.
- Jarvis Hub: WEEK 2; needs a missions DB table (migration) + backend routes + UI.
- Prompt A "Launch From" parcel-selection UI (column exists; UI not built).
- Railway deploy / CORS env / mainnet ASA mint / credential rotation: infra + secrets.

## Branch note
LUT envisioned per-item feature branches; per the session's git rules (develop only on the
designated branch, never push elsewhere) each item is a separate clearly-messaged commit on
`claude/ascendancy-blockers-lut-2Hhao` instead.

---

## Follow-up: production-hardening tiers (PR #2)

After the blocker/LUT work, opened PR #2 and ran additional surgical hardening passes — all
additive, `npm run check` green per step, plus a battle-engine determinism smoke + vitest suites.

**Pass B (battle engine):** extracted `resolveBattleFromPowers()` as the shared resolution core;
`resolveBattle()` delegates to it, and `resolveBattles` now resolves from the deploy-time
snapshot powers stored on the battle row (deploy-time lock; matches original semantics) instead
of recomputing from the live target.

**Tier 2 (security):**
- Rate limiting on `/api/actions/*` via `express-rate-limit` (per-IP, 60/min, `trust proxy` set;
  `ACTIONS_RATE_LIMIT` env).
- `PUBLIC_BASE_URL` env-only in `/faction/:name` (no Host-header fallback; 503 when unset).
- `/api/testnet/progress` GET+POST → 404 when `ALGORAND_NETWORK=mainnet`.
- `express.json/urlencoded` `limit:'1mb'`; `/api` request logger no longer echoes response
  bodies to stdout in production.
- New repo-root `.github/workflows/ci.yml` (the package-level workflows never ran as Actions):
  pnpm install → `check` → `test:server` → client `test`.

**Tier 3 (tests + WS):**
- Pure unit coverage: `tuning.spec.ts`, `random.spec.ts`, `economy-config.spec.ts`,
  `game-rules.spec.ts` (36 server tests). `vitest.server.config.ts` include broadened to `shared/`.
- Fixed `terraform-storage-smoke.spec.ts` (seed a real non-AI owner via
  `getOrCreatePlayerByAddress` + `purchaseLand`; production code untouched) → 31 client tests
  green → client suite added to CI.
- WS hardening (`wsServer.ts`): `maxPayload` 64KB + per-IP connection cap
  (`WS_MAX_CONN_PER_IP` default 25, `WS_MAX_CONN` optional global; both env-tunable / disable-able).

**Still Needs Kudbee (unchanged + new):** Railway deploy / CORS env / mainnet mint / credential
rotation; HILDA + Jarvis; Prompt A "Launch From" UI. New: wire CI into the repo's required
checks; live-test the rate limiter + WS caps on a deployed env (couldn't boot the full stack
here — needs DB/Redis/Algorand). Broad `console.*` → structured logging remains a larger,
deferred pass.
