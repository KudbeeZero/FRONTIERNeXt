# Backlog — Market fact snapshotting + on-chain reconciliation

Spun out of the 2026-06-07 money-path follow-up audit
(`docs/audit/2026-06-07-money-path-and-epi-followup.md` §4). These are real but more
involved than the fix-in-place items that pass closed; each deserves its own focused PR.

## 1. Snapshot resolving facts at the staking cutoff  *(provably-fair integrity)*

**Problem.** `DatabaseStorage.computeOutcome` (`server/storage/db.ts`) reads aggregate
facts from **current** state at resolution time:
- `burn_threshold` → `SUM(players.totalFrontierBurned)` (live, all players)
- `territory_count` → live `COUNT(parcels WHERE ownerId = …)`
- `ownership_at_turn` → live `parcels.ownerId` for the plot

Staking closes at `resolutionCutoffTs` (enforced in `placeBet`), but resolution can fire
later, and the recorded `turn`/`byTurn` on the source are **stored in `inputs` but never
used to constrain the query**. So state that changes between cutoff and resolution can
flip the outcome — a manipulation window. (`battle_outcome` is unaffected: a resolved
battle is immutable.)

**Direction.**
- Capture a **fact snapshot at `resolutionCutoffTs`** (or at the target turn) and persist
  it on the market row, ideally anchored on-chain (Algorand txn note) for verifiability.
- `resolveMarketTrustlessly` derives the outcome from the snapshot, not live state.
- Use the recorded `turn`/`byTurn` to select the snapshot for turn-based sources.
- Add an optional challenge window: if someone proves the recorded fact is wrong, reverse.
- Tests: outcome is stable regardless of post-cutoff state mutation.

## 2. Clawback / payout on-chain reconciliation job

**Problem.** `clawbackFrontierAsa` (`server/services/chain/asa.ts`) is fire-and-forget
(`routes.ts` `fireBurn`) and returns `null` on failure, while the in-game DB debit
proceeds. On a clawback failure the DB says "spent" but the on-chain balance is unchanged
→ DB/chain divergence. Same class of risk for queued `enqueueFrontierTransfer` payouts
that silently fail.

**Direction.**
- Periodic reconciliation comparing DB `frontier` balances to on-chain ASA holdings;
  flag/queue corrections for divergent accounts.
- Persist a pending-clawback ledger with retry + alerting instead of fire-and-forget.

## 3. Integer/BigInt token math end-to-end

Replace float `Math.floor`/`Math.round` conversions (payout split; ASA `amountUnits` /
`microAmount`) with integer micro-FRNTR throughout, eliminating rounding dust and the
floor-vs-round inconsistency between `batchedTransferFrontierAsa` and `clawbackFrontierAsa`.

## 4. Operational fail-closed guards (from prior audit's remaining recommendations)

- `SESSION_SECRET`: throw in production if unset/short (today: ephemeral-key warning).
- CORS: fail-closed for browser requests when `CLIENT_ORIGIN` is unset.
- `WALLET_AUTH_REQUIRED=false` in production: refuse to boot.
- `ALGORAND_ADMIN_MNEMONIC`: load from a secrets manager, never `.env`.
- Welcome-bonus Sybil: add an account-age heuristic on top of the min-ALGO gate.
