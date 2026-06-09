---
name: atomic-plot-purchase
description: Invariants + known gaps for the atomic 3-txn plot-purchase redesign (/prepare + /submit, plot-purchase-group.ts)
metadata:
  type: project
---

Atomic plot-purchase redesign (server/services/chain/plot-purchase-group.ts + routes.ts /api/actions/purchase/{prepare,submit}).

**Confirmed-good patterns (don't re-flag):**
- Group order [0] buyer pays admin, [1] buyer 0-amount self opt-in, [2] admin transfers 1-of-1 NFT. assignGroupID binds them. All three built from ONE `sp` (plot-purchase-group.ts:86) so lastValid is uniform (~1000 rounds ≈ 50 min); admin-signed txn2 dies with the window → a stale prepare row CANNOT produce a transfer.
- assertNoRekeyOrClose guards rekeyTo/closeRemainderTo/assetCloseTo (lines 37-42); /submit re-proves via txID match (181-186).
- AUTH solid by default: assertPlayerOwnership on BOTH /prepare (routes.ts:1962) + /submit (2052); buyer addr from session player not client; /submit re-binds `prep.playerId !== verifiedId` 403 (2063).
- C2 clean: price server-derived from parcel.purchasePriceAlgo, rejected on null/<=0/<floor BEFORE mint (routes.ts:1988-1992). landPriceFloorAlgo uses `?? MIN_LAND_PRICE_ALGO` (economy-config.ts:88), NOT `?? 0`. MIN_LAND_PRICE_ALGO=0.05.
- Treasury == custodian: payment receiver and NFT sender both getAdminAddress() by construction (plot-purchase-group.ts:85,109).
- C1 replay: plot_purchases.payment_tx_id is PK, /submit insert onConflictDoNothing (routes.ts:2106-2117).

**Known gaps found (2026-06 review):**
- HIGH: mint-on-prepare DoS — /prepare mints ASA on demand (routes.ts:1996), NO rate limiter on /api/actions/* (enumerationLimiter is GET-only, 294-305), no per-player prepared-row cap. One funded wallet → ~21k ASA creates → ~2,100 ALGO MBR locked + purchase-system halt. MBR recoverable (admin=manager+reserve, land.ts:62-63).
- MEDIUM: double-mint if mintLandNft waitForConfirmation (land.ts:74) throws AFTER create lands → sentinel marked failed, plot_nfts unwritten, next /prepare reclaims+mints 2nd ASA.
- LOW: plotPurchasePrepare rows never pruned (DB growth only, not submittable forever).
- Config caveat: WALLET_AUTH_REQUIRED=false (auth.ts:43-44, default ON) makes assertPlayerOwnership fall back to client req.body.playerId → unauthenticated caller reaches mint-DoS. Incompatible with on-demand mint.

**Stale comment:** db-schema.ts:36,42 says mint_idempotency key is `mint:{playerId}:{plotId}` but code uses `mint:plot:${plotId}` (routes.ts:1898) — code correct.

See [[human-audit-areas]] for single-hot-wallet key concentration (treasury+custodian+signer all getAdminAddress()).
