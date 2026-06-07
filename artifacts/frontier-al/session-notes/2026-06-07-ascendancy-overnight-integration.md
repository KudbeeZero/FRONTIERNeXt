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

## Results
(filled in per block below)
</content>
</invoke>
