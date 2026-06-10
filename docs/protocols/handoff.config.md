# Handoff Config — FRONTIERNeXt

> Per-repo configuration for the Session Handoff Protocol
> (`SESSION_HANDOFF_PROTOCOL.md`). Every protocol skill reads this file first and
> takes all paths, commands, and policy from here. Keys are `key: value` lines;
> skills must not assume anything not declared here.

## Identity

- `project`: FRONTIERNeXt (Ascendancy) — pnpm monorepo; app package is
  `artifacts/frontier-al` (`@workspace/frontier-al`)
- `rules_file`: `artifacts/frontier-al/CLAUDE.md`

## Artifact locations

- `handoff_dir`: `artifacts/frontier-al/docs/handoff/`
  (queue: `NIGHT_QUEUE.md` · board: `NIGHT_BOARD.md` · audits: `SHIFT_AUDIT_<date>.md`
  · agent runs: `agent-runs/` · agent memory: `agent-memory.md`)
- `memory_file`: `artifacts/frontier-al/docs/PROJECT MEMORY.md`
- `session_notes_dir`: `artifacts/frontier-al/session-notes/`
- `plan_sources`: LUT documents in `artifacts/frontier-al/docs/` (MASTER, DORMANT,
  LIVING WORLD, GLOBE, SECURITY) and `docs/backlog/`

## Verification

- `workdir`: `artifacts/frontier-al/`
- `baseline_command`: `pnpm install --frozen-lockfile`
  (pristine install FIRST before any dependency edit — non-frozen installs into
  empty node_modules perturb React 18/19 type hoisting → phantom tsc errors)
- `verify_commands`: `pnpm check` · `pnpm test` · `pnpm build`
  (use `pnpm test:server` instead of `pnpm test` on branches where it exists)

## Branching & PRs

- `branch_prefix`: `claude/night`
- `pr_policy`: `branches-only`
  (push verified branches; the morning brief lists them as merge-ready — humans
  open and merge PRs. Flip to `draft-prs` once the team is comfortable.)
- `ci`: GitHub Actions (`.github/workflows/`)

## Multi-agent review

- `stack_profile`: React 18 + Vite + React Three Fiber frontend · Express 5 +
  Drizzle/PostgreSQL + Redis backend · WebSockets · **stack seat: Algorand**
  (js-algorand-sdk, atomic groups, indexer, wallet flows, chain security)
- `review_roster_size`: 9 breadth agents + 1 synthesizer (v1 roster Alex–Jordan)

## Repo-specific hard rules (in addition to protocol guardrails)

- Never let React 19 types (mockup-sandbox catalog) leak into frontier-al (React 18).
- LUT sample numbers are illustrative — live code (`shared/economy-config.ts`,
  `shared/schema.ts`, `server/config/gameConfig.ts`) wins.
- Treat any `playerId` from request bodies as untrusted until wallet-signature auth
  is mandatory.
- No architecture migrations; targeted additive changes only.
