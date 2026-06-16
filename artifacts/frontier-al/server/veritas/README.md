# VERITAS — Verification Grind Engine

> An always-on agent that walks the chain/game flows on a loop and reports exactly where
> things break. Read/test-only — point it at **testnet**, never mainnet.

VERITAS runs as an external client (a CLI) that pokes the live backend the way a real
player would. It is designed to run on persistent compute (e.g. Lightning AI) so it keeps
grinding the flows continuously and catches **drift** — when the DB and the chain disagree —
before a player does.

## What it checks

| Flow | Status | Notes |
|------|--------|-------|
| market | ✅ implemented | create → bet-lock → resolve → proof, and **independently re-runs the published resolver** on the proof's public inputs to confirm the outcome + sha256 hash. |
| token | ✅ implemented | uses the test wallet: funding (auto top-up), **opt-in idempotency**, on-chain ASA balance read. |
| land / commander / trade | ⏭️ pending | scaffolded; need the purchase/auth choreography on top of the wallet manager. |

The market flow asserts the provably-fair guarantees directly: the source is persisted
immutably, resolution is refused before the cutoff, an injected `winningOutcome` is ignored
(the dev cannot pick the winner), and the recorded outcome + hash are reproducible by anyone.

## Run

```bash
# one pass (exit 1 if anything FAILs or DRIFTs)
VERITAS_TARGET_URL=https://<testnet-backend> VERITAS_ADMIN_KEY=<key> pnpm run veritas

# always-on grind (every 30 min)
VERITAS_TARGET_URL=https://<testnet-backend> \
VERITAS_ADMIN_KEY=<key> \
VERITAS_INTERVAL_MS=1800000 \
VERITAS_DISCORD_WEBHOOK=<webhook> \
pnpm run veritas
```

### Env

| Var | Purpose |
|-----|---------|
| `VERITAS_TARGET_URL` | base URL of the backend under test (default `http://localhost:5000`) |
| `VERITAS_ADMIN_KEY` | admin key (`x-admin-key`) for market create/resolve |
| `VERITAS_PLAYER_ID` | optional player id for flows that need an actor |
| `VERITAS_FLOWS` | optional comma list to filter flows (e.g. `market`) |
| `VERITAS_INTERVAL_MS` | if set, loop every N ms instead of a single pass |
| `VERITAS_DISCORD_WEBHOOK` | optional alert webhook (posts the report on FAIL/DRIFT) |
| `VERITAS_JSON` | `1` (or `--json` flag): JSON report on stdout (`{ severity, totals, flows }`, `severity` ∈ `OK`/`SEV2`/`SEV1`), text report on stderr — for Kestra/orchestrators, see `ops/kestra/` |
| `VERITAS_TEST_MNEMONIC` | testnet test-wallet 25-word mnemonic (the player the chain flows act as) |
| `VERITAS_FUNDER_MNEMONIC` | optional funded account used to auto top-up the test wallet |
| `VERITAS_FRONTIER_ASA_ID` | $FRNTR ASA id, for the token flow |
| `VERITAS_ALGOD_URL` / `VERITAS_ALGOD_TOKEN` | algod endpoint (default testnet algonode) |

> The wallet runs as an external client — point it at **testnet**. On first run with no
> `VERITAS_TEST_MNEMONIC`, generate one with `pnpm exec tsx -e "import a from 'algosdk'; const x=a.generateAccount(); console.log(a.secretKeyToMnemonic(x.sk), x.addr.toString())"`, fund the address from the testnet dispenser, and set the mnemonic.

## Report

```
VERITAS RUN [2026-06-07T19:30:00.000Z]
──────────────────────────────────────────────────
MARKET FLOW        ✅ PASS  (4.6s)
COMMANDER FLOW     ⏭️ SKIP  (0.0s)
──────────────────────────────────────────────────
0 FAIL, 0 DRIFT, 5 PASS, 4 SKIP — 4.6s
```

Each FAIL/DRIFT line is specific enough to hand straight to Claude Code as a fix prompt.

## Architecture

```
server/veritas/
  types.ts        StepResult / FlowResult / RunResult / FlowRunner
  assert.ts       pure assertion engine (PASS / FAIL / DRIFT / SKIP) + drift reconciliation
  reporter.ts     LUT-style report + optional Discord alert
  httpClient.ts   minimal JSON client (adds x-admin-key)
  flows/
    market.ts     provably-fair market verification (implemented)
    index.ts      flow registry (land/commander/token/trade pending)
  run.ts          CLI: run once or loop; non-zero exit on FAIL/DRIFT
```

Pure logic (`assert.ts`, `reporter.ts`) is unit-tested in `veritas.spec.ts`. Adding a flow
is: implement a `FlowRunner` and list it in `flows/index.ts`.
