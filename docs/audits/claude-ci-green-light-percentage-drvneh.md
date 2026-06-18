# Audit — `claude/ci-green-light-percentage-drvneh` (PR #61)

**Verdict: PASS** (retro-audit — advisory, non-blocking; the PR was already merged
into `main` by the owner before this audit ran).

## PR / branch / commit
- **PR:** #61 — "ci: coverage gate on the deterministic game-math core (≥80%)"
- **Branch:** `claude/ci-green-light-percentage-drvneh`
- **Head/only commit:** `2505917` (base `9e53108`); 10 files, +291/−9.
- **Merge:** squashed to `main` as part of `8dc7a72` by `KudbeeZero` at
  2026-06-18T08:42Z — **merged before audit** (same pattern as #52). CI on the head
  commit was green (`Typecheck & server tests` ✓, Cloudflare Pages ✓).
- **Audited by:** an independent auditor subagent instructed to refute, not confirm.

## Claims vs. evidence

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Tooling/CI/config/docs only — no game/globe/combat/chain/economy behavior change | ✅ verified | Changed files: `ci.yml`, `CLAUDE.md`, `.gitignore`, `README.md`, `COVERAGE_GATE.md`, `package.json`, session note, `vitest.server.config.ts`, `HANDOFF.md`, `pnpm-lock.yaml`. No source under `server/engine/`, `shared/economy-config.ts`, weapons, chain, or client runtime touched. |
| 2 | Adds `@vitest/coverage-v8@4.1.6`; lockfile adds only coverage-v8 + istanbul/v8 transitives | ✅ verified | `package.json:126` pins `4.1.6` (matches locked vitest 4.1.6). **Lockfile was committed**; added pkgs are all v8/istanbul transitives (`@bcoe/v8-coverage`, `ast-v8-to-istanbul`, `istanbul-lib-*`, `istanbul-reports`, `magicast`, etc.) — no unrelated bumps. `pnpm install --frozen-lockfile` succeeds. |
| 3 | `vitest.server.config.ts` v8 block, correct `include`, thresholds 80/80/80/70 | ✅ verified | `vitest.server.config.ts:30-50`: `provider:"v8"`; include = `shared/weapons/**`, `shared/university/**`, `shared/economy-config.ts`, `shared/weapon-economy.ts`, `server/engine/{battle,markets}/resolve.ts`; thresholds lines/funcs/stmts 80, branches 70. |
| 4 | Scripts `coverage:server` + `coverage:server:full` | ✅ verified | `package.json:10-11`; full variant forces thresholds to 0 (informational). |
| 5 | New CI step between `test:server` and client `test` | ✅ verified | `ci.yml:45-46`, after `test:server` (l.42), before client `test` (l.48). |
| 6 | Docs don't over-claim global 80%; ~22% stated plainly | ✅ verified | `COVERAGE_GATE.md` states whole-package ~22%; measured **21.55%** (`coverage:server:full`). |

## Tests (actual output, reproduced locally)
- `pnpm install --frozen-lockfile` → **success** ("Lockfile is up to date").
- `check` (tsc) → **pass**, clean.
- `coverage:server` → **PASS** — 33 files / **266** tests; **lines 93.12% (325/349)**,
  branches 77.9% (141/181), funcs 90.27%, stmts 91.4%. Matches claimed figures.
- `test` (client) → **57** pass.
- **Negative check — nuance.** The repro written into the PR/baton,
  `coverage:server -- --coverage.thresholds.lines=99`, **exits 0** — the literal `--`
  makes pnpm forward the flag past vitest's own `--`, so the override is ignored. This
  is a *command-form artifact, not a gate defect*. Invoked directly
  (`vitest ... --coverage --coverage.thresholds.lines=99`) the gate **exits 1**
  ("Coverage for lines (93.12%) does not meet global threshold (99%)"), and likewise at
  `=95`. The config-defined gate genuinely fails CI when coverage drops; only the
  documented repro command is misleading.

## Number-gaming assessment (the crux)
The `include` set is **honest, not cherry-picked**:
- Excluded surfaces are genuinely I/O/integration — `server/storage/**` (3.3k-line
  `db.ts`), `server/services/**` (Redis/oracle/chain), `routes.ts`/`index.ts`,
  `season`/`narrative` managers, `veritas`/`sim`/`smoke` dev tools — the "blocked" rows.
- Checked whether tested *pure* modules were quietly excluded to inflate the average:
  - `server/engine/battle/random.ts` + `tuning.ts` are **100% covered** — excluding
    them does **not** inflate the gate (including them would *raise* the average). A
    missed opportunity, not gaming. (The commit advertises "tuning, rng" as tested, yet
    the gate doesn't guard them — fold them into `include` in a follow-up.)
  - `server/engine/narrative/advisor.ts` is **68.75%** (optional Anthropic/`fetch` LLM
    path). Its exclusion modestly flatters the aggregate but is defensible — the LLM
    path is not pure-unit-testable.
- Net: the gate measures the real deterministic core at a genuine 93%. No dishonest
  cherry-picking.

## Scope creep
None. Every changed file is tooling/CI/config/docs.

## Untested assertions
None material. All quantitative claims (93.12% / 21.55% / 266 / 57) reproduced.

## Security
None. The CI step runs `vitest --coverage` on local code only — no untrusted input,
secrets, or network execution introduced.

## What I could NOT verify
- GitHub Actions head-commit run was confirmed via the GitHub API (green), but the
  auditor reproduced the steps **locally** rather than re-running the hosted job.
- No runtime/on-chain surface is involved (pure tooling change).

## Non-blocking nits (for a future tiny follow-up)
1. `vitest.server.config.ts:23` inline comment says whole-package "~32%" — contradicts
   the accurate **~22%** in the commit message, `CLAUDE.md`, and `COVERAGE_GATE.md`
   (measured 21.55%). Stale number; cosmetic.
2. The baton/commit negative-check repro (`pnpm ... -- --coverage.thresholds.lines=99`)
   silently **passes** due to pnpm arg-forwarding. The gate bites when run directly;
   correct the documented command.
3. Optional: add the 100%-covered `random.ts` + `tuning.ts` to the gate `include` so the
   advertised "tuning, rng" logic is actually protected.

---
*Retro-audit: #61 was merged by the owner before the start-of-chat audit. The
one-PR-at-a-time and "nothing lands on `main` unreviewed" invariants were bypassed by
that early merge; this report restores the audit trail after the fact. Verdict PASS —
no merge action required.*
