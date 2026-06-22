# 2026-06-22 — FREE_PURCHASES toggle (TestNet)

## Why
Owner couldn't buy a plot of land on live `/game`. On-chain check of their wallet
(`OC6L…L5B74A`): 14.889 ALGO total but only ~2.53 spendable (106 ASA opt-ins lock
~10.6 ALGO in min-balance). Owner directed: "make everything free to purchase so I
don't have to worry about it." Scoped to the two ALGO-gated purchases: **plots +
commanders**.

## What shipped
Env-gated, **TestNet-only** free-purchase toggle. `FREE_PURCHASES=true` makes plot
and commander purchases skip the ALGO payment entirely — no wallet charge, no
on-chain verification, no ASCEND charge for commanders.

- `shared/economy-config.ts` — `computeFreePurchases({requested, economyMode,
  network})` (pure) + `FREE_PURCHASES` export. **HARD-RULE safety:** force-disabled
  in `ECONOMY_MODE=production` and on `mainnet`, even if the flag is set.
- `server/routes.ts`:
  - `/api/blockchain/status` now returns `freePurchases`.
  - Plot purchase (`/api/actions/purchase`): when free, skip `algoPaymentTxId`
    requirement + `verifyAlgoPayment` + replay claim/release; price treated as 0.
  - Commander purchase (`/api/actions/mint-avatar`): when free, skip ALGO payment
    requirement/verify and zero the ASCEND cost (so no clawback burn). Replay/burn
    already key off `algoPaymentTxId`/`ascendCost`, so they no-op.
- Client: `fetchBlockchainStatus` carries `freePurchases`; `useBlockchainActions`
  exposes it; `GameLayout` skips the wallet payment for both plots and commanders
  when free (no Pera/Lute popup), posting with `algoPaymentTxId` undefined.
- `fly.toml` — `FREE_PURCHASES='true'` in `[env]` (testnet; `ALGORAND_NETWORK=testnet`,
  `ECONOMY_MODE` unset → testing).

## Tests
`shared/economy-free-purchases.spec.ts` — `computeFreePurchases` truth table,
incl. the mainnet/production refusal (the HARD-RULE property). Fail-before would be
N/A (new fn); the refusal cases are the load-bearing assertions.

- `pnpm --filter @workspace/frontier-al run check` — clean.
- `test:server` — **336 pass** / 11 skipped (incl. new spec).
- `test` (client) — **98 pass**.
- `build` — green.

## Safety / HARD RULES
- Pricing change, but **TestNet-scoped and mainnet-refusing by construction** — no
  funds/ASA code moves toward mainnet; `computeFreePurchases` is the single gate.
- Before any mainnet deploy: remove `FREE_PURCHASES` from config (documented in
  ENV_VARS + DEPLOYMENT_ENV_CHECKLIST). `/mainnet-gate` should flag it if present.

## Caveat surfaced to owner
Free removes the *payment*, not the *wallet requirement* — the plot/commander must
still be owned by a connected address. If the residual blocker is wallet
connection (the reconnect-gap fix, shipped earlier), free mode won't mask that.

## Status
⚠️ Code + local tests green. Not yet confirmed on live bundle — needs deploy of
this branch + owner buying a plot/commander with no charge. One open PR (this unit).
