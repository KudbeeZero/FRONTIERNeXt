# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** Database kill switch (`HALT_DB=true` halts all DB communication) — **DONE & MERGED** (PR #279 `0cc5c3b`, 2026-07-20).
  - Three defense-in-depth layers: `withDbRetry` pool guard throws before any query; `/api` middleware returns 503; all background intervals (battle resolver, debuff cleanup, AI turns, orbital checks, battle ticks, market resolvers, WS flush, transfer/mint retry workers, season manager) check `isDbHalted()` and skip work.
  - New files: `server/dbHalt.ts`, `server/dbHaltMiddleware.ts`, `server/dbHalt.spec.ts`, `server/dbHalt.db.spec.ts`, `server/dbHaltMiddleware.spec.ts`.
  - Reversible: unset or set `HALT_DB` to any value other than `"true"` to resume normal operation.
  - Verify gate green: `check` exit 0; `test:server` 719/719; `test` 10/10. CI green on head `0cc5c3b`: Typecheck & server tests ✅ + Cloudflare Pages ✅.
- **🔴 OWNER ACTION STILL REQUIRED — ROTATE the exposed GitHub token (from PR #278).** The mission-control generator historically committed an authenticated `remote.origin.url` into `generated.ts`. Code is fixed, but the token in git history is compromised. Revoke/rotate that token in GitHub. Git history was intentionally not rewritten.

## LAST RESULT
- **Shipped:** Database kill switch — PR #279 `0cc5c3b` (2026-07-20). `HALT_DB=true` stops all DB reads/writes and background tasks. Gate green: `check` exit 0; `test:server` 719/719; `test` 10/10. CI green on `0cc5c3b`.

## NEXT
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
