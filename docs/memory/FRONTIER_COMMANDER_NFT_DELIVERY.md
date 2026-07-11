# FRONTIER Commander NFT Delivery — Recovery

Related lane: `fix/frontier-commander-nft-delivery` (targets `main`).

## Symptom (Production, TestNet)
After the wallet-auth 401 fix (PR #237) landed, land purchase, ASA opt-in, land
ownership, and land NFT delivery all work on production. Commander NFT mint/delivery
does **not** consistently complete:

- Sentinel #1 / #3 / #4 cards show `Mint Failed — Tap Retry`
- ASA opt-in completes
- plot purchase completes; land ownership updates; land NFT delivery succeeds
- Commander NFT mint/delivery does not reliably finish

This is a **separate issue** from the resolved wallet-authentication 401 defect.

## Root Cause
The Commander NFT mint is fire-and-forget and its only state record is
`commander_mint_idempotency.status` (`pending` | `confirmed` | `failed`). Two gaps:

1. **No reconciliation after a chain-success / DB-write-failure (failure category C).**
   In both `mint-avatar` (post-response) and `retry-commander`, the `.catch` handler
   set `status = 'failed'` and **cleared `assetId`** with no check against
   `commander_nfts`. If `mintCommanderNft` created the ASA on-chain but the
   subsequent `db.insert(commander_nfts)` in the `.then` failed (transient DB error,
   process hiccup, etc.), the ASA was orphaned with **no DB row** → status `failed`
   → UI shows `Mint Failed — Tap Retry`.

2. **Duplicate mint + no in-flight guard (failure categories E + A).**
   `retry-commander` only blocked a re-mint when `commander_nfts.assetId` existed.
   Two rapid "Tap Retry" clicks both passed that check and both called
   `mintCommanderNft` → **two ASAs minted**. A genuine chain success followed by a
   failed DB insert, then a retry, also minted a second (orphaned) ASA. There was no
   single-flight lock and no `pending`-state guard.

## Exact Failure Boundary
- Server: `server/routes.ts`
  - `POST /api/actions/mint-avatar` post-response mint (idempotency key
    `cmdr:mint:{playerId}:{commanderId}`)
  - `POST /api/nft/retry-commander/:commanderId`
- Status source: `GET /api/nft/commander/:commanderId` → `failed` when idempotency
  status is `failed` → `NftClaimNotification.tsx` renders `Mint failed — tap Retry`.
- Client: `client/src/components/game/GameLayout.tsx` `handleRetryCommanderMint`
  (no parallel-click guard; surfaced raw backend JSON on error).

## Files Changed
- `server/services/chain/commander.ts`
  - `withCommanderMintLock(key, fn)` — single-flight lock (module-scoped `Map`);
    concurrent callers share ONE in-flight promise; released on settle so later
    calls re-run. Mirrors the PR #237 wallet-operation lock pattern.
  - `decideCommanderRetry({ existingNftAssetId, idempotencyStatus, idempotencyAssetId })`
    — pure decision: `already_minted` (NFT row or confirmed idempotency with an
    assetId), `already_minting` (idempotency still `pending`), or `mint`.
- `server/routes.ts`
  - `retry-commander`: uses `decideCommanderRetry` to short-circuit
    (`already_minted` / `already_minting`); wraps the mint in `withCommanderMintLock`;
    on failure **reconciles** — if `commander_nfts` now has an assetId, recovers
    idempotency to `confirmed` (category C) instead of failing.
  - `mint-avatar` post-response mint: wrapped in `withCommanderMintLock`; same
    reconcile-on-failure logic.
- `client/src/components/game/GameLayout.tsx`
  - `handleRetryCommanderMint`: synchronous `retryingCommanderRef` set blocks parallel
    clicks; handles `already_minting` reason; converts raw backend JSON (incl. 401)
    into a clean user-facing status.
  - `handleMintAvatar` `onError`: converts raw backend JSON into a clean status
    (keeps `Insufficient ASCEND` verbatim; never leaks the raw payload).
- `server/services/chain/commanderMint.spec.ts` (new) — focused regression tests.

## Retry / Idempotency Design
- One ASA per commander: `commander_nfts.commanderId` is the PRIMARY KEY and
  `onConflictDoUpdate` is used on every write, so a row is never duplicated.
- Retry reuses an existing Commander ASA when `commander_nfts` or a `confirmed`
  idempotency row already carries an `assetId` (no second mint).
- Transfer/delivery already keyed on the existing `assetId` — never transfers the
  same NFT twice, never requests another opt-in if already opted in
  (`isAddressOptedIn` short-circuits in `attemptNftDelivery`).
- `withCommanderMintLock` guarantees exactly one in-flight chain mint per commander,
  so rapid "Tap Retry" clicks cannot mint duplicate ASAs.
- No automatic retry after wallet rejection (the mint is a server-side admin txn; the
  buyer only signs the ALGO payment + later the opt-in/claim — rejection aborts
  cleanly, no loop).
- One notification sequence per attempt; UI refetches `/api/nft/commander/:id` on
  every success (`queryClient.invalidateQueries`).

## Tests
- `commanderMint.spec.ts`: `decideCommanderRetry` matrix (already_minted via NFT row /
  confirmed idempotency; already_minting via pending; mint otherwise) and
  `withCommanderMintLock` single-flight (1 call for 3 concurrent; releases on success;
  releases + retries after rejection; distinct keys independent).
- Affected suites green: focused (25), full server (489 passed), GameLayout client
  (9 passed), `tsc` (0 errors), `build` (client + server) succeeded.

## Remaining Owner Verification (Production, mobile Safari)
Exact retest steps are listed in the PR comment. Confirm: one Retry Mint → at most one
wallet/opt-in prompt; delivery success; final Commander card shows owned/delivered; no
duplicate ASA or transaction; rejection shows one clean status; rapid clicks stay
single-flight.

## Untouched (Verified)
Wallet/auth architecture, prices, transaction amounts, treasury/admin addresses,
existing ASA IDs, land NFT delivery, funds path, and unrelated game systems were NOT
changed. Backend ownership + authentication checks (`assertPlayerOwnership`,
`evaluateNftDeliveryClaim`, `isAddressOptedIn`) remain intact.
