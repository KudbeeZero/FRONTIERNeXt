# AGENT MEMORY — FRONTIERNeXt multi-agent runs

> Layered shared memory for the multi-agent-game-orchestrator skill. All agents read
> this before working. Coordinator prunes; keep under ~150 lines.

## L4 — Lessons & patterns (durable)

- Verify with `cd artifacts/frontier-al && pnpm run check && pnpm run test:server && pnpm run build`.
- Pristine `pnpm install --frozen-lockfile` FIRST; non-frozen installs into empty
  node_modules perturb React 18/19 type hoisting → phantom tsc errors.
- frontier-al is React 18; mockup-sandbox is React 19 (catalog) — never let 19 types leak.
- Canonical tunables: `shared/economy-config.ts`, `shared/schema.ts`, composed in
  `server/config/gameConfig.ts` (claude/night/game-config). LUT sample numbers are
  illustrative — live code wins.
- LUTs can be stale (DORMANT §1.2 claimed markets nav missing; it shipped). Verify
  claims against code before building.
- Identity is body-trust until wallet signature auth lands (SECURITY §1, mainnet gate).
  Treat any `playerId` taken from request bodies as untrusted.
- routes.ts is a ~3000-line monolith; weapon routes added +239 lines (PR #9).

## L3 — Quantum (cross-run predictions)

- **Un-dark-launch is the detonator**: weapon holes (badge farming, no throttle,
  deploy funds loss, free-mint ALGO drain, battery restart loss) are curl-only today;
  shipping Armory nav + fire UI (WPN-9) makes all of them live at player scale at once.
  Hard ordering: WPN-1→2→4→5 before any client caller lands.
- Latent client FX bugs (pre-launch settle F3, same-id rebase A8) are unreachable now
  but WILL fire the day the server adds salvo scheduling or engagement status updates.
- When `WALLET_AUTH_REQUIRED` flips on, body-supplied playerId/receiverAddress patterns
  in weapon routes break or become redundant — converge on DB-stored addresses (commander
  pattern) before mainnet.

## L2 — Audited headlines (2026-06-10 weapon-system, all git-verified on origin/main)

- **W-01 Critical**: weapon system dark-launched — no nav to /armory, zero client callers
  for fire/deploy/mint (E1+E4+I1).
- **W-02 High**: `deployDefense` burns FRNTR before the battery-cap check throws (service.ts:239).
- **W-03 High**: kill/precision stats credited with no target-ownership check, no cooldown —
  badge-farm the whole catalog by shelling your own parcel; impact damage never settled.
- **W-04/05 High**: `/api/weapons/*` outside actionsLimiter; unauth `/nft/metadata/weapon/:id`
  full-table-scans all players per request.
- **W-06 High**: mint has no FRNTR cost and only in-memory idempotency — record-failure after
  on-chain mint re-mints duplicate 1-of-1 ASAs (admin ALGO drain).
- **W-09/10 High**: paid batteries vanish on restart (in-memory singleton); `weapon_profile`
  has no SQL migration (db:push only) — migration-provisioned envs break all weapon routes.
- **Refuted**: Dana D6 (fire double-spend on launch throw) — `launch()` can only throw on a
  spec already pre-validated before the spend; Ivy's verified-OK stands.

## L1 — Run index

- **2026-06-10 weapon-system** — 9 night agents (alex…ivy) on PR #9 (merge d9bbab5);
  85 raw findings → 28 consolidated; 1 Critical + 11 High verified, 1 refuted.
  Artifacts: `agent-runs/2026-06-10-weapon-system/` (night-*.md, audit-report.md,
  final-plan.md — 10-item rated backlog, WPN-1..10).
