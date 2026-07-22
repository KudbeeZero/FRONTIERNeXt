# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** Deploy database kill switch — `HALT_DB = 'true'` in `fly.toml` — **DONE & MERGED** (PR #280 `e65aa3b`, 2026-07-22).
  - Set `HALT_DB = 'true'` in `fly.toml` `[env]` block. When deployed (`fly deploy`), the server stops ALL DB reads/writes and background tasks. `/api` → 503; `/health` → 200. Zero data transfer from Postgres (cheap health-check pings only).
  - Documented `HALT_DB` in `ENV_VARS.md` and `DEPLOYMENT_ENV_CHECKLIST.md` (was missing after PR #279).
  - Reversible: change to `'false'`, unset, or remove the line → normal operation.
  - Verify gate green: `check` exit 0; `test:server` 719/719; `test` 10/10. CI green on head `e65aa3b`: Typecheck & server tests ✅ + Cloudflare Pages ✅.
- **🔴 OWNER ACTION STILL REQUIRED — ROTATE the exposed GitHub token (from PR #278).** The mission-control generator historically committed an authenticated `remote.origin.url` into `generated.ts`. Code is fixed, but the token in git history is compromised. Revoke/rotate that token in GitHub. Git history was intentionally not rewritten.
- **🔴 OWNER ACTION: `fly deploy`** to activate the kill switch. The code + config are merged; deployment is manual.

## LAST RESULT
- **Shipped:** Deploy `HALT_DB = 'true'` — PR #280 `e65aa3b` (2026-07-22). Sets the kill switch in `fly.toml`; when deployed, all DB reads/writes stop, background tasks idle, `/api` returns 503, `/health` returns 200. Gate green: `check` exit 0; `test:server` 719/719; `test` 10/10. CI green on `e65aa3b`.

## NEXT
- **Owner must `fly deploy`** to activate the dormant state. Until deployed, the DB runs normally.
- Resume feature roadmap — Battle Planner planner UI, or faction economy / treasury / equity / contribution-ledger foundation, per `PRODUCTION_READINESS_ROADMAP.md`. Owner approval required before any sub-plot combat application-code PR.
- Owner-only follow-up (separate lane, NOT an app-code PR): reconfigure ASCEND ASA `764083761` on-chain URL to a valid endpoint. This is an OWNER-SIGNED ON-CHAIN ACTION (Algosdk `asset_config` tx signed by the ASA manager).

## 🛑 HARD RULES / off-limits (absolute)
- No funds/ASA/transfer code toward mainnet without **`/mainnet-gate` PASS + `algo-auditor` PASS** (both required).
- **Don't merge `wip/atomic-purchase`**; nothing in `ops/kestra/` may point at mainnet.
- Don't reintroduce mock/demo data into plot/HUD surfaces (they are live, server-driven).
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- **Standing mainnet-gate item:** `VITE_DEV_MODE` + `DEV_LOGIN_ENABLED` ship `'true'` in prod `fly.toml` — deliberate for TestNet; M3-4 is the exit path.
- **Do NOT unify `mem.ts`/`db.ts`** game methods (combat/economy divergence risk).
- Pre-deploy: migrations `0000`–`0016` applied; `VITE_TEST_GLOBE` reads `false`; keep `SESSION_SECRET` stable.
- **Standing owner directive:** proceed without asking when approval is a foregone conclusion; still one-PR-at-a-time and HARD RULES remain absolute.
- One open PR at a time; never commit to `main` directly; never over-claim — say "untested" when untested.
