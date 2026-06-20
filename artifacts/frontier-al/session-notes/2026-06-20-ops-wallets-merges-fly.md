# 2026-06-20 — Ops session: testnet wallets, PR merges, Fly backend, baton refresh

## What happened (ops + housekeeping, owner-directed)
A long live-ops session, not a single feature unit.

- **Testnet wallets generated** (5 Algorand TestNet accounts, round-trip validated, **not committed**):
  ADMIN + NEXUS-7 / KRONOS / VANGUARD / SPECTRE. Handed to the owner in chat (owner chose "show in chat";
  testnet-only, rotate before mainnet). ADMIN → `ALGORAND_ADMIN_MNEMONIC` + `ALGORAND_ADMIN_ADDRESS`.
- **Merged the open stack** (owner authorized): #78 (Strategic Depth design doc), #79 (Comm Terminal) —
  resolved the `docs/HANDOFF.md` baton conflicts, re-verified the merged tree green (check ✓, server 332,
  client 85, build ✓). #80 (living-map) already merged earlier; #82 (Fly launch files) merged by Fly flow.
- **Fly backend:** repo already had `fly.toml` (app `frontiernext`, port 5000, `/health`) + monorepo
  `Dockerfile`. Added **#81** — a one-tap `workflow_dispatch` "Deploy to Fly" GitHub Action (needs repo
  secret `FLY_API_TOKEN`), since the owner deploys from mobile. **Could not deploy from this env** (no
  flyctl / Fly creds).
- **Diagnosed the crash loop:** `frontiernext` crash-loops because required secrets aren't set — the server
  throws on boot at `server/db.ts:5` (`DATABASE_URL`) and `assertChainConfig` (`SESSION_SECRET`,
  `PUBLIC_BASE_URL`, `ALGORAND_ADMIN_MNEMONIC`, `ALGORAND_ADMIN_ADDRESS`). `ALGORAND_NETWORK` is in
  `fly.toml`. Needs a real Postgres + `pnpm db:push`.
- **Clarified a project mix-up:** `growverse-api.fly.dev` is a **separate app** (GROWv2 / cannabis game),
  not this repo. Flagged to verify `api.frontierprotocol.app` DNS → `frontiernext.fly.dev` (not growverse).
  Probe: `frontiernext.fly.dev` down; `growverse-api` 200; `api.frontierprotocol.app` behind a CF challenge.
- **This unit:** refreshed the stale baton (`docs/HANDOFF.md`) to reflect all merges + the deploy state +
  the DNS/secret caveats + queued next units. Doc-only.

## State at end
`main` @ `e459d2f`, no open PRs (before this baton-refresh PR), app v2.0.0. FRONTIER backend NOT yet
serving (awaiting Fly secrets). Frontend on Cloudflare Pages.

## Next units (queued)
1. Faction-wallet wiring (GATED: `/security-pass` + `/mainnet-gate` + `algo-auditor`, testnet-first).
2. SD-A1 — wire `data_centre` `yieldMultiplier` into mining (first Strategic Depth code unit).
3. Phase-2 leftovers (battle-stats client wire-up; commander stats/leaderboard; veritas; replay-log persistence).
