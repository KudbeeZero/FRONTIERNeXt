# Audit: ops/frontier-halt-db-deploy

## Verdict
PASS

## PR / branch / commit
Branch: `ops/frontier-halt-db-deploy`
Scope: Deploy the DB kill switch (PR #279) by setting `HALT_DB = 'true'` in `fly.toml` + documenting the env var.

## Claims vs. evidence

| Claim | Evidence | Status |
|-------|----------|--------|
| `HALT_DB = 'true'` is set in `fly.toml` `[env]` | `fly.toml:43` — `HALT_DB = 'true'` added to the `[env]` block with inline documentation | ✅ verified |
| `HALT_DB` is documented in the canonical env-var reference | `ENV_VARS.md:15` — new row added: purpose, activation behavior (`"true"` exact string), reversibility, dormant state | ✅ verified |
| `HALT_DB` is documented in the deployment checklist | `docs/DEPLOYMENT_ENV_CHECKLIST.md:51` — new row in "Security toggles" section with default `false`, kill switch description, effected components | ✅ verified |
| No code changes — all behavior is already shipped in PR #279 | Diff touches only 3 files: `fly.toml`, `ENV_VARS.md`, `docs/DEPLOYMENT_ENV_CHECKLIST.md`. Zero `.ts`/`.tsx`/`.sql` changes. | ✅ verified |
| Kill switch is reversible | `HALT_DB = 'true'` → dormant; change to `'false'`, unset, or remove the line → normal operation. No code change needed to revert. | ✅ verified |
| No funds/ASA/auth surface touched | Zero changes to `server/services/chain/`, `server/auth.ts`, transaction logic, wallet code, or on-chain config. | ✅ verified |

## Tests

```text
pnpm install --frozen-lockfile
  Done in 10.4s using pnpm v10.33.0

pnpm --filter @workspace/frontier-al run check
  tsc — exit 0

pnpm --filter @workspace/frontier-al run test:server
  Test Files  76 passed | 8 skipped (84)
  Tests  719 passed | 26 skipped (745)

pnpm --filter @workspace/frontier-al run test
  Test Files  1 passed (1)
  Tests  10 passed (10)
```

## Scope creep

None. Changes are limited to 3 config/docs files:
- `fly.toml` — added `HALT_DB = 'true'` to `[env]` block
- `artifacts/frontier-al/ENV_VARS.md` — added `HALT_DB` row
- `artifacts/frontier-al/docs/DEPLOYMENT_ENV_CHECKLIST.md` — added `HALT_DB` row

No application code, no game behavior, no globe/combat/canvas, no funds/ASA/auth.

## Untested assertions

- **Live deployment effect:** The env var is set in `fly.toml` but has not been deployed (`fly deploy`). Until deployed, the DB is still running normally. The audit claims the *config is correct*; it does not claim the deployment has occurred.
- **`/health` still responds when halted:** This is structurally guaranteed (the health endpoint is registered before the `/api` halt middleware), but not verified in a deployed environment.

## Security

- **Low severity.** `HALT_DB` is a kill switch, not a secret. It only stops DB operations; it does not grant access, expose data, or change auth boundaries. Fail-closed by default (unset = normal operation). Only the exact string `"true"` activates it — no injection surface.

## What I could NOT verify

- Actual `fly deploy` and live behavior with `HALT_DB=true`. This is a config change that requires deployment — the audit verifies config correctness; the deployment itself is the owner's action.
- Whether any deployment pipeline would override or strip `HALT_DB` from `fly.toml` (Fly.io respects `[env]` block — no override mechanism known).
