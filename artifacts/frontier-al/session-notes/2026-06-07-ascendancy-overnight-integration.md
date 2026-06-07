# Session — Ascendancy Overnight Integration

Date: 2026-06-07
Branch: `claude/ascendancy-overnight-integration-JQUET`

Working the overnight schedule from the MASTER INTEGRATION LUT (Phases A/B/C/D bits).
Operating manual: `docs/SKILL.md`, `docs/PROJECT MEMORY.md`, the ASCENDANCY *_LUT.md set
(merged in from `origin/main` commit `fd90663` — they had just been uploaded there).

## Branching note (important)
The schedule lists per-block feature branches merged to `main`. The session's hard Git
rules say: develop ONLY on `claude/ascendancy-overnight-integration-JQUET`, never push
elsewhere without explicit permission. Prior session
(`2026-06-07-ascendancy-lut-blockers.md`) hit the same conflict and resolved it by making
each item a separate clearly-messaged commit on the designated branch. Following that
precedent here: one commit per block, message prefixed with the intended branch name +
LUT ref, all on `claude/ascendancy-overnight-integration-JQUET`. No merges to `main`.

## Verification gate (per SKILL §10 + CLAUDE.md)
`pnpm run check` (tsc, 0 errors) before every commit; `pnpm run test:server` when touching
server logic. Baseline at session start: tsc clean.

## Plan / status (assessed against current branch)

| Block | Task | LUT | Pre-check state |
|-------|------|-----|-----------------|
| 1 | Pera `@perawallet/connect` 1.4.2 → 1.5.2 | MASTER A1 | TODO — package.json still `^1.4.2` |
| 2 | Split `server/routes.ts` (84 routes) into `server/routes/*.ts` | MASTER A2 | TODO — no `server/routes/` dir |
| 3 | `server/config/gameConfig.ts` typed tunables | MASTER A3 / DORMANT | TODO — no `server/config/` dir |
| 4 | `currentPlayerId` in `plotVisualFingerprint` | GLOBE §5 (root cause A) | TODO — fingerprint deps `[parcels]` only |
| 5 | admin fail-closed + `/api/health` + `/api/ready` | SECURITY §2, §6.3 | PARTIAL — `requireAdminKey` already fails closed (503 in prod); health/ready missing |
| 6 | Sub-parcel UI panel driving existing endpoints | DORMANT 1.1 | TODO — no `subparcel/` dir |
| 7 | Season HUD banner + confirm settle scheduler | DORMANT 1.3 | TODO — no season component |

DO NOT TOUCH (all blocks): `engine/battle/tuning.ts`, `storage/db.ts` tx structure,
Fibonacci sphere parity, DB schema column names, `FRNTR:` tx-note prefix, code identifiers.
Defer anything needing a destructive migration / external API key / mainnet action /
credential rotation. NOT touching wallet-auth (daytime task).

## Results — FINAL

All 7 blocks DONE on `claude/ascendancy-overnight-integration-JQUET` (per the session git
rules — separate clear commits on the designated branch, NOT merged to main). Every block:
`pnpm run check` (tsc) clean before commit; server/client test suites green; production
`pnpm run build` green at the end. End state: tsc 0 errors · server 78 tests · client 36
tests · build ✓.

| Block | Status | Commit | Files |
|-------|--------|--------|-------|
| 0 prep | done | `e3a0009`, `94c641e` | merged uploaded LUTs from origin/main; wrote this plan |
| 1 Pera update | **done** | `7dfa5cc` | package.json + pnpm-lock (1.4.2→1.5.2) |
| 2 routes split | **done** | `cf585c2` | server/routes.ts (→293 ln) + server/routes/{auth,blockchain,nft,actions,game,trade,markets,subparcels,admin,context,_timing}.ts |
| 3 gameConfig | **done** | `0975e3e` | server/config/gameConfig.ts (+ .spec), routes/admin.ts ref |
| 4 globe color | **done** | `fa29cae` | client/.../globe/GlobeParcels.tsx |
| 5 health/ready | **done** (admin fail-close already present) | `48d59c2` | server/routes/health.ts, services/redis.ts (redisPing), routes.ts mount |
| 6 sub-parcel UI | **done** (was already built in LandSheet — extracted) | `8dff408` | client/.../subparcel/{SubParcelPanel,SubParcelDetail,SubdivisionCountdown,archetypeConfig,index} + LandSheet delegate + render spec |
| 7 seasons HUD | **done** | `d6c56a8` | client/.../SeasonBanner.tsx + GameLayout mount + render spec |
| docs | this commit | PROJECT MEMORY §3/§4/§6 + this report |

### Verification specifics
- **Block 2** is the only architectural change. Validated three ways: (a) tsc, (b) static
  route-inventory diff — the 90 `(method, path)` pairs are byte-identical before/after, (c) a
  mock-`app` mounting smoke proving all 90 register and the global mutation guard sits AFTER
  the auth routes and BEFORE every mutation route (0 offenders). Handler bodies are verbatim.
- **Block 6**: the sub-parcel UI already existed and worked inside `LandSheet.tsx` (SKILL
  "audit first" — features are often already built). Extracted (not rebuilt) into the
  dedicated `subparcel/` dir; LandSheet now imports `SubParcelPanel`. Note: buildings are
  NOT per-archetype in this codebase — the tree is facilities + defense, independent of
  archetype (the LUT's "building tree per archetype" was a slight misconception).
- **Block 5**: `requireAdminKey` already fails closed in prod (security.ts → 503) — no change
  needed; only the health/ready probes were added.
- **Block 7**: settle scheduler confirmed live (`initSeasonManager` @ server/index.ts:245 →
  setInterval tick → `settleCurrentSeason()` on expiry).

## DO NOT TOUCH — honored
tuning.ts, db.ts tx structure, Fibonacci parity, schema column names, `FRNTR:` prefix, code
identifiers — all untouched. Wallet-auth (master plan B5/B6) intentionally left for daytime.

## Needs Kudbee (for the morning)
1. **Merge decision.** 7 blocks sit on `claude/ascendancy-overnight-integration-JQUET`, NOT
   merged to main. The schedule said "merge to main" per block, but the session's hard git
   rules say develop only on the designated branch / never push elsewhere without explicit
   permission (prior session set this precedent). So everything is committed + pushed to the
   designated branch, awaiting your review + merge. Open a PR / merge when ready.
2. **Block 2 runtime confidence.** tsc + tests + inventory diff + a mock-mount smoke all pass,
   but the full server can't boot here (no DB/Redis/Algorand) so I could not exercise live
   HTTP routing. Recommend a quick smoke against a deployed/staging instance after merge.
3. The uploaded LUT docs were merged in from `origin/main` (`fd90663`) at session start so I
   had the operating manual; they live in `artifacts/frontier-al/docs/`.
4. Pre-existing build warning: one ~3.5MB client chunk (code-splitting opportunity) — not
   introduced by this work.
</content>
</invoke>
