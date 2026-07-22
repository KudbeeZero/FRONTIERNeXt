# 2026-07-22 — deploy HALT_DB=true (dormant DB kill switch activated)

## What shipped
- **PR #280** `e65aa3b` — `ops(server): deploy HALT_DB=true to put database in dormant state`
- Merge date: 2026-07-22T02:25Z
- Branch: `ops/frontier-halt-db-deploy`

## What it does
Sets `HALT_DB = 'true'` in `fly.toml` `[env]` block. When deployed (`fly deploy`), the server:
- Stops ALL database reads/writes
- Stops ALL background tasks (battle resolver, AI turns, market resolvers, transfer/mint queues, season ticks, orbital, WS flush)
- Returns 503 on all `/api/*` routes
- Returns 200 on `/health` — app stays live, health checks pass, zero data transfer from Postgres

## Reversible
Change `HALT_DB` to `'false'`, unset it, or remove the line → normal operation resumes. No code change needed.

## Tests
- `check` exit 0
- `test:server` 719/719 (76 files, 8 skipped)
- `test` 10/10 (1 file)
- CI green: Typecheck & server tests ✅ + Cloudflare Pages ✅

## Files changed (4)
- `fly.toml` — add `HALT_DB = 'true'` with inline docs
- `artifacts/frontier-al/ENV_VARS.md` — add `HALT_DB` row
- `artifacts/frontier-al/docs/DEPLOYMENT_ENV_CHECKLIST.md` — add `HALT_DB` row
- `docs/audits/ops/frontier-halt-db-deploy.md` — audit report

## Known risks
- **Not yet deployed** — the config is merged but `fly deploy` has not been run. Until deployed, the DB runs normally.
- Integration gaps (from PR #279 audit): the kill switch code is unit-tested, but end-to-end `HALT_DB=true` runtime behavior (all intervals stopping, all routes 503) is untested in a live deployed environment. Structurally guaranteed by the code.

## NEXT
1. **Owner: `fly deploy`** to activate the dormant state
2. Resume feature roadmap — Battle Planner UI or faction economy foundation
3. Owner: rotate exposed GitHub token from PR #278
4. Owner: reconfigure ASCEND ASA on-chain URL
