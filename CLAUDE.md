# CLAUDE.md — standing instructions

This repo is worked on across many short-lived chat sessions. Follow the
**Session Relay Protocol** ([docs/SESSION_PROTOCOL.md](./docs/SESSION_PROTOCOL.md)):
**one chat = one reviewed PR**, and the handoff between chats is an audited
artifact, not trust.

> This file has two halves. The **chat loop** (below) governs *how* every session
> runs — read the baton, audit, do one unit, close out. The **codebase reference**
> (further down) is the map of *what* you're working in. Read the loop rules first;
> they override default behavior.

## Every chat

1. **Read first.** Read the baton ([docs/HANDOFF.md](./docs/HANDOFF.md)) and
   memory before doing anything. The baton is the single source of truth for
   what's next.
2. **Start with `/handoff-audit`.** Independently audit the previous chat's PR
   (diff vs. claims, run the tests, check scope/security) and gate the merge:
   PASS → merge + start this chat's branch; CONCERNS → ask; FAIL → don't merge.
3. **Do exactly one unit of work** on this chat's branch.
4. **End with `/closeout`.** Commit, confirm tests green, open **exactly one** PR
   into `main` with an Audit checklist, and rewrite the baton. The final baton
   commit must **not** use `[skip ci]`.
5. **End-of-day state is non-negotiable** (full checklist in the baton's
   "Definition of done"): `main` green on its real head commit, the loop closed,
   and **everything pushed — what the owner sees on github.com must be exactly
   what you have locally.** The container is ephemeral; unpushed work is lost work.
   Verify with `git status` + `git log origin/<branch>..HEAD` (must be empty)
   before ending any session.

## Invariants

- **One open PR at a time.** Don't start new work until the previous PR is
  audited and merged.
- **Nothing lands on `main` unreviewed.**
- **Never over-claim** — a result is not "validated" unless a test backs it. Say
  "untested" when it is.

## Reply format (keep it short)

End substantive replies with:

```
Summary: <what changed — and does it actually work, test-backed or not?>
Next:    <do I test it now, or what's the next unit / branch?>
```

## App-specific rules

This file governs the **chat loop**. For app-side working conventions (token
efficiency, subagent policy, headless visual testing, session close-out), defer to
[`artifacts/frontier-al/CLAUDE.md`](./artifacts/frontier-al/CLAUDE.md). If the two
ever conflict, the app file wins on app matters; this file wins on the chat loop.
The funds/pricing/finality/atomic-delivery **HARD RULES live in this file** (below)
and are enforced by the `/mainnet-gate` + `algo-auditor` gates — not in the app file.

## Roadmap & queue

The living roadmap is [`docs/FRONTIER_MASTER_ROADMAP.md`](./docs/FRONTIER_MASTER_ROADMAP.md)
(26 phases; **Phase 25 = the current 3-month unit queue**, mirrored in the baton;
**Phase 26 = NFT & on-chain state completeness**). `artifacts/frontier-al/ROADMAP.md` and
`artifacts/frontier-al/docs/ROADMAP_90DAY.md` are superseded — don't work from them.

## Mainnet readiness flow

On the road to Algorand mainnet, a workflow layer of process gates sits on top of
the chat loop — see [`docs/MAINNET_READINESS_FLOW.md`](./docs/MAINNET_READINESS_FLOW.md).
The skills: `/pr-gate` (mechanical pre-merge go/no-go), `/security-pass` (surgical
security review — fix + test + document), `/mainnet-gate` (read-only PASS/CONCERNS/
FAIL mainnet check, the concrete impl of the gate referenced above), `/test-matrix`
(visible coverage grid), and `/end-session` (safe stop + dated session note). They
are process only — they do not change game behavior. Nothing reaches mainnet
without a PASS from `/mainnet-gate` **and** an `algo-auditor` pass.

---

# Codebase reference

## What this repo is

**FRONTIERNeXt** is a pnpm monorepo. Its flagship is **FRONTIER-AL** — a persistent,
blockchain-backed strategy game: a 3D rotating planet of **21,000 plots** across 8
biomes, four autonomous AI factions, and real **Algorand TestNet** stakes (each plot
mints an ARC-3 NFT; the **ASCEND** token is ASA `755818217`). The rest of the repo is
shared libraries, a second front-end (a story-mode prologue), and infrastructure.

Start at the top-level [README.md](./README.md) for the player-facing doc index, and
[`artifacts/frontier-al/README.md`](./artifacts/frontier-al/README.md) for the deep
technical reference.

## Workspace layout

This is a **pnpm workspace** (`pnpm-workspace.yaml`). Packages live under
`apps/*`, `artifacts/*`, `lib/*`, `lib/integrations/*`, and `scripts`.

```
FRONTIERNeXt/
├── apps/
│   └── aether-journey/        @workspace/aether-journey — story-mode prologue
│                                (Vite + React + three.js; ElevenLabs voice/music pipeline)
├── artifacts/
│   ├── frontier-al/           @workspace/frontier-al — ◍ THE GAME (full-stack)
│   │   ├── client/            React + three.js (globe, HUD, combat); Vite
│   │   ├── server/            Express + WebSocket; engine/, services/, storage/, weapons/, veritas/
│   │   ├── shared/            cross-cut types & config (schema.ts, economy-config.ts, orbitalEngine.ts…)
│   │   ├── migrations/        Drizzle SQL migrations 0000–0008
│   │   ├── docs/              ADRs, runbooks, audits, DATA_RECONCILIATION
│   │   └── *.md               player + builder docs (GAME_MANUAL, ECONOMICS, ARCHITECTURE, DEPLOYMENT…)
│   ├── api-server/            @workspace/api-server — shared API infrastructure
│   └── mockup-sandbox/        @workspace/mockup-sandbox — prototyping (EXCLUDED from aggregate typecheck)
├── lib/
│   ├── api-client-react/      @workspace/api-client-react — generated React Query hooks
│   ├── api-spec/              @workspace/api-spec — OpenAPI spec + orval codegen
│   ├── api-zod/               @workspace/api-zod — Zod validation schemas
│   └── db/                    @workspace/db — Drizzle ORM + Postgres config
├── scripts/                   @workspace/scripts — build & utility scripts
├── ops/kestra/                Kestra workflow definitions (health/uptime/routing) — never point at mainnet
├── docs/                      chat-loop protocol, mainnet flow, agent chain-of-authority, audits
└── night-reports/ · session-notes/   dated run logs
```

> **`artifacts/frontier-al/` is where almost all real work happens.** The globe
> (`client/src/components/game/globe/**`) is the current focus area — it is real,
> server-data-driven code, not a placeholder.

## Tooling & conventions

- **Package manager: pnpm only.** A `preinstall` hook deletes `package-lock.json` /
  `yarn.lock` and refuses non-pnpm agents. Pinned to pnpm **10.33.0** in CI. Node **22+**
  (CI uses 22; Replit runtime is 24).
- **Supply-chain guard:** `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (1 day).
  **Do not disable it.** New deps must be ≥1 day old unless allowlisted in
  `minimumReleaseAgeExclude`. Shared dependency versions are pinned in the workspace
  `catalog:` — prefer `catalog:` references over re-pinning.
- **TypeScript everywhere**, project-references build (`tsc --build` at root via
  `typecheck:libs`). `react`/`react-dom` are pinned to `19.1.0` (Expo constraint).
- **Stack:** Vite + React 19 + Tailwind 4 on the client; Express + `ws` + Drizzle ORM
  (Postgres) on the server; `three.js` (code-split) for 3D; `zod` for validation;
  `tsx` for running TS directly; `vitest` for tests.
- **License:** root is `UNLICENSED` / `private: true`; `frontier-al` is proprietary
  (`SEE LICENSE IN LICENSE`). Never commit secrets — document them in the env checklist;
  real values live in host dashboards / a secrets manager.

## Build, typecheck & test

**Root (aggregate):**

| Command | What it does |
|---|---|
| `pnpm install` | install workspace (frozen lockfile in CI) |
| `pnpm run typecheck` | `tsc --build` libs + per-package typecheck (**`mockup-sandbox` excluded**) |
| `pnpm run build` | typecheck, then `pnpm -r run build` across packages |

**FRONTIER-AL** (`pnpm --filter @workspace/frontier-al run …`):

| Command | What it does |
|---|---|
| `check` | `tsc` typecheck |
| `test:server` | server unit tests (battle engine, tuning, rng, economy) — **244/244 last green** |
| `coverage:server` | **CI coverage gate** — fails if the deterministic game-math core drops below **80%** lines (curated `include`; ~93% today). `coverage:server:full` prints the whole-package figure (~22%) informationally — *not* a global-80% claim |
| `test` | client unit tests (terraform, parcels) |
| `dev` / `dev:server` / `dev:client` | run server (`:5000`) / client (`:3000`) |
| `build` / `start` | production build (`script/build.ts`) / serve `dist/index.cjs` |
| `db:push` | Drizzle schema push |
| `sim` / `veritas` | battle simulator / provable-fairness grind |

**Aether's Journey** (`pnpm --filter @workspace/aether-journey run …`):
`dev`, `build`, `check`, plus `voice:*` / `music:*` (ElevenLabs generators; need
`ELEVENLABS_API_KEY`).

**CI** (`.github/workflows/ci.yml`, on every PR + push to `main`): pnpm install →
frontier-al `check` → `test:server` → `coverage:server` → `test`. **This is the gate
the audit checks** — the head commit of a PR must have a green run (not a stale or
`[skip ci]` run). The `coverage:server` step is a quantitative gate on the
deterministic game-math core (≥80% lines); it does **not** assert whole-package
coverage. See `artifacts/frontier-al/docs/COVERAGE_GATE.md`.

## Where things live (FRONTIER-AL)

- **Security & guards** are centralized — extend these rather than scattering logic:
  `server/security.ts`, `server/auth.ts`, `server/rateLimitStore.ts`,
  `server/idempotencyGuard.ts`, `server/routeOwnership.ts`, `server/stateScope.ts`
  (each has a `*.spec.ts`).
- **Game engine:** `server/engine/{ai,battle,markets,narrative,season}`.
- **Blockchain / economy:** `server/services/chain` (Algorand), `server/services/priceOracle.ts`;
  shared economy math in `shared/economy-config.ts`, `shared/weapon-economy.ts`.
- **Client 3D:** `client/src/components/game/globe/**` (parcels, terrain, atmosphere,
  HUD, weapon/observer layers).
- **DB schema:** `server/db-schema.ts` + `shared/schema.ts`; migrations in `migrations/`.

## HARD RULES (app) — do not violate off-hand

These belong to the game and are enforced by gates; see
[`artifacts/frontier-al/CLAUDE.md`](./artifacts/frontier-al/CLAUDE.md) for the full set.

- **No funds / ASA / transfer code moves toward mainnet** without a `/mainnet-gate`
  PASS **and** an `algo-auditor` pass.
- **Don't merge `wip/atomic-purchase`** (off-limits branch). Nothing in `ops/kestra/`
  may point at mainnet.
- **Don't reintroduce mock/demo data** into plot/HUD surfaces — they are live,
  server-driven.
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- Verify `VITE_TEST_GLOBE` reads `false` before any deploy; migrations `0000`–`0008`
  must be applied.

## Conventions for new work

- One unit per chat, on this chat's branch; commit with clear messages; never commit
  to `main` directly.
- Centralize cross-cutting logic in small modules; **no fix without a test** (a test
  that fails before and passes after) for security/behavior changes.
- Document changes in the same commit: env (`ENV_VARS.md` /
  `docs/DEPLOYMENT_ENV_CHECKLIST.md`), audit reports under `docs/audit/`, and a dated
  `session-notes/` file.
- Treat **`docs/HANDOFF.md` as the authoritative baton.**
