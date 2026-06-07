# Session — Provably-Fair Prediction Markets (trustless resolution)

Date: 2026-06-07
Branch: `claude/senior-architect-fullstack-yoQTu`
Source LUT: `docs/ASCENDANCY_PROVABLY_FAIR_MARKET_LUT.md` (uploaded)

Implemented the Provably-Fair Prediction Market from the LUT. Removed the admin-chosen
outcome path entirely; market outcomes are now **derived** from deterministic public facts
by code anyone can re-run. Additive + back-compatible (legacy market rows keep null source).
All three gates green: `pnpm run check` (tsc), `pnpm run test:server` (13 files / 85 tests),
`pnpm run build` (Vite + esbuild).

## The trust move
Before: `resolveMarket(marketId, winningOutcome)` took the winner as an admin parameter —
the house picked who won. That signature is **deleted**. Outcomes are now derived from a
per-market **immutable `resolutionSource`** declared at creation, recorded with the exact
inputs + a sha256 hash so anyone can verify.

## What was built
- **Resolution sources** (`shared/schema.ts`): discriminated union `ResolutionSource`
  + `resolutionSourceSchema` (zod). Types: `battle_outcome`, `ownership_at_turn`,
  `burn_threshold`, `territory_count`. `createMarketSchema` now **requires** a source +
  `resolutionCutoffTs` (every new market is provable). Removed `resolveMarketSchema`.
- **Schema/migration**: 4 nullable columns on `prediction_markets`
  (`resolution_source`, `resolution_cutoff_ts`, `resolved_inputs`, `resolution_hash`) —
  `db-schema.ts` + `migrations/0004_provably_fair_markets.sql`.
- **Pure resolver core** (`server/engine/markets/resolve.ts`, NEW, no I/O): `deriveOutcome`,
  `isResolvable`, `hashResolution` (+ `stableStringify` for order-independent hashing).
  Mirrors the battle-engine pure-core + spec pattern. Tested in `resolve.spec.ts` (NEW).
- **Storage** (`server/storage/db.ts`): deleted `resolveMarket(winningOutcome)`; added
  `computeOutcome` (reads facts via `getBattle`, parcel owner, `sum(totalFrontierBurned)`,
  territory count), `resolveMarketTrustlessly` (derives + hashes + records), plus
  `getResolvableMarkets` / `resolveReadyMarkets`. Interface + MemStorage stubs updated.
- **Routes** (`server/routes.ts`): 60s scheduler also calls `resolveReadyMarkets()`; admin
  resolve route repurposed to **trigger-only** `resolveMarketTrustlessly` (no outcome param);
  new public `GET /api/markets/:id/proof`.
- **UI** (`client/src/components/game/PredictionMarkets.tsx`): shows the resolution source
  up front on every card, a "Verify resolution" link (fetches `/proof`) on resolved markets,
  and updated the closed-market copy to "trustless resolution".

## Key design decision (no history table needed)
For `*_at_turn` / `burn_threshold` sources, `isResolvable` gates on `gameMeta.currentTurn >=
targetTurn` so the automated resolver fires when the turn is reached and reads the live fact
(= state at that turn), then snapshots `resolvedInputs` + `resolutionHash`. Battle markets
read the already-immutable, seed-replayable battle outcome. This avoids an ownership-history
table while keeping every resolution self-contained and verifiable.

## Staking lock (front-run defense)
`placeBet` now rejects once `resolutionCutoffTs` has passed (server guard) and the UI hides
the bet form past the cutoff. Without this, a player could stake in the window after a battle
resolved but before the 60s resolver fired — the exact front-running hole the LUT forbids.

## Settlement
Payouts stay pull-based via the existing `claimWinnings` (5% fee, treasury ledger) — unchanged.

## Follow-up (next pass)
VERITAS verification grind engine — in-repo harness runnable on Lightning AI (flow runners +
assertion engine + drift detector + reporter); its MARKET FLOW asserts this resolver.
