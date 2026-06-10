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

*(empty — first run pending)*

## L2 — Audited headlines

*(empty — first run pending)*

## L1 — Run index

*(empty — first run pending)*
