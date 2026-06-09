# CLAUDE.md — FRONTIER (Algorand strategy game)

Stable project facts and non-negotiable rules. Multi-step procedures live in
skills, not here. Keep this concise.

## Stack
- **Client**: React 18 + Vite 7 + Three.js (react-three-fiber/drei), wouter, TanStack Query, Tailwind.
- **Server**: Express 5 + TypeScript (run via `tsx`), Drizzle ORM + PostgreSQL, `algosdk`.
- **Chain**: Algorand. No deployed TEAL — on-chain logic is admin-signed ASA create/transfer/clawback. FRONTIER/FRNTR ASA: total `1_000_000_000`, decimals `6`.
- **Repo**: pnpm monorepo. This app is the `artifacts/frontier-al` package; the git repo root is `FRONTIERNeXt/`.

## Layout
- `server/` — Express API (`routes.ts`), auth (`auth.ts`, `adminAuth.ts`), security (`security.ts`), chain services (`server/services/chain/*`), economy (`treasury.ts`, `priceOracle.ts`).
- `client/src/` — React app. Globe in `components/game/globe/`; pages in `pages/`; libs in `lib/`.
- `shared/` — `schema.ts` (Drizzle + types), `economy-config.ts`, `fog.ts`.
- `migrations/` — Drizzle SQL.

## Commands (run from `artifacts/frontier-al`)
- Install: `pnpm install` (pnpm only; run from repo root).
- API server (`:5000`): `NODE_ENV=development node_modules/.bin/tsx server/index.ts` (auto-loads `.env`).
- Client (`:3000`): `node_modules/.bin/vite --port 3000 --strictPort` → open http://localhost:3000.
- Typecheck: `node_modules/.bin/tsc --noEmit`. Tests: `vitest run` (server: `vitest run --config vitest.server.config.ts`).
- DB schema: `node_modules/.bin/drizzle-kit push` (needs `DATABASE_URL`). Build: `tsx script/build.ts`.

## Run locally
- DB: local Postgres `frontier`/`frontier`. `.env` holds `DATABASE_URL`, `SESSION_SECRET`, and a TestNet admin account.
- Fund the TestNet admin (for on-chain ops): `algokit dispenser login` → `algokit dispenser fund -r <ADMIN_ADDRESS> -a 10 --whole-units`. On WSL this needs a keyring backend: `pipx inject algokit keyrings.alt` and `PYTHON_KEYRING_BACKEND=keyrings.alt.file.PlaintextKeyring`.
- Boot straight into the globe (local testing only): set `VITE_TEST_GLOBE=true` in `.env`.
- Admin dashboard: real login (username + password + SMS 2FA). Seed: `tsx server/scripts/seedAdmin.ts <user> <pass> <+E164phone>`. Set `TWILIO_*` for real SMS; in dev with no Twilio the code prints to the server console.

## HARD RULES (non-negotiable)
1. **Pricing is server-authoritative.** The server ALWAYS re-derives the plot price from the oracle (`server/services/priceOracle.ts` + `shared/economy-config.ts`). It NEVER trusts a client-sent amount. Verify the on-chain payment ≥ the server-computed price.
2. **Payment finality via ALGOD, not the indexer.** Confirm payments with `algod` (`waitForConfirmation` / pending-txn-info). The indexer lags and caused paid-but-no-land 402s — never gate delivery on it.
3. **Payment + plot delivery are atomic and idempotent.** Use the payment `txid` as the idempotency key. A retry must never double-deliver a plot or double-charge.
4. **Auth and purchase are SEPARATE flows to SEPARATE endpoints.** Auth challenge note = `FRONTIER-AUTH:v1:<nonce>` → `/api/auth/verify`. Purchase txn note = `FRNTR:{…}` → `/api/actions/purchase`. Each endpoint validates its own note prefix; a note of one type must NEVER be accepted by the other endpoint.
5. **Wallet signing is serialized.** Never run two wallet signs concurrently — overlap crosses the auth and purchase signatures and is the root cause of the recurring 401.

## algo-auditor gate (MANDATORY)
Invoke the **algo-auditor** subagent before commit/deploy on any change to: TEAL/PyTeal; ASA config (`server/services/chain/asa.ts`, `commander.ts`, `land.ts`, `factions.ts`); atomic groups (`asa.ts` batcher, `transferQueue.ts`); treasury/staking/pricing (`treasury.ts`, `priceOracle.ts`, `shared/economy-config.ts`, `server/storage/game-rules.ts`); or token supply/decimals. Subagents are NOT scheduled — invoke manually. Address CRITICAL/HIGH findings before shipping.

## Plan-then-execute (economy / contracts / auth)
Any change touching **economy, contracts, or auth** MUST use the **Plan agent first**: plan in one context → get user approval → execute in a fresh context. Do not edit these paths ad-hoc.

## Conventions
- TypeScript, ESM, many small files. Run `tsc --noEmit` before declaring work done.
- Feature branches only; never commit straight to `main`. One feature per commit/PR.
- Session logs: write a dated file in `session-notes/` at session end (see `session-notes/README.md`).
