# FRONTIER-AL: Algorand Fee Optimization (transaction coalescing)
## Status: BACKLOG — cost optimization, not urgent

## Context

The on-chain layer (`server/services/chain/*`) pays an Algorand min fee of **0.001 ALGO
per transaction**. High-volume flows (FRNTR claims, welcome bonuses, per-action clawbacks)
each emit one transaction, so fees scale with transaction count.

**Important — the fee-pooling myth:** Algorand atomic groups (max **16** txns) *pool* fees
but do **not** discount them. Every txn in a group still pays the min fee; one txn can
overpay to cover others, but the group total is always `N × 0.001 ALGO`. There is **no**
mechanism where one fee settles a whole batch. Therefore the only real lever is **sending
fewer transactions** — grouping alone saves nothing.

Magnitude check: 0.001 ALGO is a fraction of a cent and testnet is free. This matters only
at mainnet scale with sustained claim/burn traffic. Real optimization, low urgency.

## Genuine wins (reduce transaction count)

1. **Coalesce same-recipient pending FRNTR transfers** before sending.
   - Today `drainFrontierTransfers` (`services/chain/transferQueue.ts:~126`) sends one txn
     per pending row via `transferAsa`. Multiple rows to the *same* wallet → sum amounts and
     send **one** transfer. Real fee saving (3 payouts to one wallet → 1 txn).
   - Implementation: group pending rows by `recipientAddress`, sum `amount`, send once, mark
     all merged rows `sent` with the shared txId. Keep per-row audit.

2. **Deferred per-player clawback batching** (largest saver).
   - Today `clawbackFrontierAsa` (`services/chain/asa.ts:~287`, called from
     `routes.ts:~158`) fires one txn per costed action (build/attack/mint). A player doing
     10 actions/min = 10 clawback txns.
   - Implementation: enqueue clawbacks (mirror the transfer queue), batch per player per
     drain cycle into one clawback for the summed amount. Must stay fire-and-forget so the
     game action isn't blocked on chain confirmation. **Changes burn timing semantics** —
     decide if a short delay before the on-chain burn is acceptable.

## Explicit non-wins (do NOT bother)

- Wrapping the queue's N sends to *different* recipients in an atomic group — still N fees,
  only adds atomicity.
- Faster/slower drain intervals — still one txn per row unless rows are merged.
- Relying on "fee pooling" for a discount — it does not exist.

## Already good

- Treasury settlement (`services/chain/treasury.ts`) already consolidates many DB fee rows
  into a single on-chain self-transfer. No change needed.

## Minor cleanup spotted (independent of fees)

- `clawbackFrontierAsa` (`asa.ts:~303`) hardcodes `1_000_000` for micro-unit conversion
  instead of `10 ** FRONTIER_ASA_DECIMALS`; align with `transferAsa` to be decimals-safe.

## When picked up

- Add a `pending_frontier_clawbacks` table mirroring `pending_frontier_transfers` (if doing
  win #2). Win #1 needs no schema change — just coalesce in the drain loop.
- Verify with the standard gates (`check` / `test:server` / `build`) and a testnet dry run
  via VERITAS's token flow (opt-in/balance) to confirm balances reconcile after coalescing.
