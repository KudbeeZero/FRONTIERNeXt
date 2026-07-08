# 2026-07-07 — Batch NFT claim (one wallet approval, not N) + signing concurrency lock

## What prompted this

Owner feedback after several rounds of testing the newly-working claim flow:
repeatedly buying/claiming land triggers a separate wallet popup per plot,
and asked directly — "why don't you have a queue system for claiming the
NFTs?" Separately, a formatted bug report described the exact symptom this
naturally leads to: the wallet SDK rejects a second signing request with
"another request... in progress" if two are triggered close together
(e.g. an auto-claim poll for a fresh purchase overlapping a manual "Claim
NFT" click). Both point at the same root need: serialize wallet-signing
requests and let players batch multiple claims into one approval.

## Fix 1 — batch opt-in, one wallet approval for many plots

Algorand can't merge distinct ASA opt-ins into a single transaction, but it
CAN group multiple transactions into one atomic group that the wallet signs
in a single approval action. This repo already has exactly that plumbing for
the game-action batch queue (`assignGroupID` + `signGroupedTransactionsWithActiveWallet`,
`MAX_GROUP_SIZE = 16`) — reused it rather than inventing a new pattern:

- `client/src/lib/algorand.ts`: new `batchOptInToASAs(address, assetIds)`.
  Chunks at the 16-txn Algorand group cap, signs each chunk as one grouped
  approval, submits, confirms.
- `client/src/components/game/GameLayout.tsx`: new `handleClaimAllPlotNfts`
  — one wallet approval to opt into every pending plot's ASA, then delivers
  all of them concurrently (delivery itself is admin-signed, no wallet
  needed once opted in).
- `client/src/components/game/CommanderPanel.tsx`: "Claim All (N)" button in
  the pending-claims header, shown whenever there's more than one pending.

N popups → ceil(N/16) popups. For most players (well under 16 pending
plots) that's N → 1.

## Fix 2 — wallet-sign serialization lock (prevents the underlying error class)

`client/src/lib/algorand.ts`: every signing path funnels through exactly two
functions (`signTransactionWithActiveWallet`,
`signGroupedTransactionsWithActiveWallet`), both of which call the single
registered wallet signer. Added a promise-chain mutex
(`withWalletSignLock`) at that shared chokepoint, so ANY two signing
requests from ANY call site — the new batch claim, the existing per-plot
claim, the auto-claim-on-purchase poll, commander mint, a payment — now
queue instead of racing. A second call simply waits for the first to settle
(approved, rejected, or errored) and then runs; a failed/cancelled prior
call does not wedge the queue for later callers.

Chose this over introducing a new SDK/framework (a "modernize to an
AlgoKit-style unified client" request arrived mid-session) because: this
repo's stack is raw `algosdk` end-to-end (confirmed — no AlgoKit dependency
anywhere in package.json or imports), the actual reported symptom is fully
solved by serializing the existing single signer chokepoint, and swapping
SDKs mid-session would be an unrequested, unbounded architecture change
touching every transaction in the game — well outside "one unit of work."

## Tests

New `client/src/lib/algorand.spec.ts` — pure async logic, no live wallet
needed, register a fake signer and assert:
- two/three concurrent `signTransactionWithActiveWallet` calls never overlap
  (max 1 in flight at a time)
- a grouped-sign call queues behind an in-flight single-sign call (proves
  the lock is shared across both entry points, not per-function)
- a rejected signature doesn't permanently wedge the queue for the next
  caller

## Scope check

Client-only. No server code, no funds/ASA transfer *logic* touched (the
existing `/api/nft/deliver/:plotId` endpoint — already correct — is just
called concurrently now instead of sequentially). No mainnet-adjacent code.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 329 passed (was 326, +3 new — the lock tests)
- `pnpm run test:server` — 454 passed, 24 skipped, unchanged (no server
  files touched)
- `pnpm run build` — clean production build

The batch-claim UI flow itself (button click → grouped sign → concurrent
deliver) is the same testing-gap class as the individual claim flow from the
prior fix — no jsdom/interaction harness in this repo for these deep game
panels. The lock IS test-backed (pure logic, `algorand.spec.ts`); the UI
wiring around it needs live verification on the next multi-plot claim.
