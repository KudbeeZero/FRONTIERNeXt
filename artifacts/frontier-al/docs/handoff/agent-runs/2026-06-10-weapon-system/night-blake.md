# Blake — Night Shift Report

**Focus**: PR #9 chain surface (merged at d9bbab5): `server/services/chain/weapon.ts`, `shared/weapon-economy.ts`, weapon routes in `server/routes.ts` (2043–2267), vs existing chain patterns (`commander.ts`, `asa.ts`, `transferQueue.ts`, `client.ts`, idempotency tables in `server/db-schema.ts`). All paths relative to `artifacts/frontier-al/`. Read-only review; no code modified.

**Findings Table**

| ID | Severity | Category | File(s) | Description | Impact | Suggested Fix | Test Idea |
|----|----------|----------|---------|-------------|--------|---------------|-----------|
| B1 | High | Idempotency | routes.ts:2048,2187,2193–2210; weapons/service.ts:138–151 | Mint dedupe is only an in-memory `weaponMintInFlight` Set + `nftAssetId` profile check. If `recordWeaponNft` (routes.ts:2204) throws after the on-chain mint, or the process crashes/restarts mid-mint, no DB record exists; a retry mints a duplicate 1-of-1 ASA. Repo already has `mint_idempotency` / `commander_mint_idempotency` (db-schema.ts:41,69) — weapon mint uses neither. | Orphaned ASAs; admin ALGO fee + 0.1 ALGO min-balance lost per duplicate; player sees "Mint failed" despite on-chain success. | Add `weapon_mint_idempotency` keyed `wpn:mint:{playerId}:{ownedWeaponId}`, write `pending` before mint, `confirmed` after record (commander pattern, routes.ts:1884–1938). | Stub `recordWeaponNft` to throw once; assert second mint call returns the original assetId, not a new ASA. |
| B2 | High | Delivery/retry | weapon.ts:121–135; routes.ts:2187,2205 | No delivery-retry endpoint for weapon NFTs. Land has `/api/nft/deliver/:plotId` (routes.ts:736), commander has `/api/nft/deliver-commander/:commanderId` (routes.ts:1020). If `attemptWeaponDelivery` returns `not_opted_in`/`transfer_failed`, re-calling mint-nft 409s on `nftAssetId` (routes.ts:2187). | NFT stranded in admin custody permanently; player paid nothing (see B4) but owns an undeliverable asset; admin min-balance grows. | Add `POST /api/nft/deliver-weapon/:ownedWeaponId` mirroring routes.ts:1020–1063, calling `attemptWeaponDelivery`. | Mint with non-opted-in receiver, opt in, call new route, assert `delivered:true`. |
| B3 | Med | Input validation | shared/weapons/profile.ts:128; routes.ts:2182,2201 | `receiverAddress` is `z.string().min(1)` — never checked with `algosdk.isValidAddress` before minting. Commander uses the DB-stored `mintPlayer.address` instead of body input (routes.ts:1914). | Garbage address → ASA minted, delivery fails forever (compounds B2). | Validate `algosdk.isValidAddress(action.receiverAddress)` and 400 before the mint at routes.ts:2198. | POST mint-nft with `receiverAddress:"x"`; expect 400 and no ASA created. |
| B4 | Med | Fee/economy | routes.ts:2178–2215; shared/weapon-economy.ts:54 | Weapon NFT mint is free: no FRNTR spend, no `verifyAlgoPayment` — unlike commander mint (FRNTR burn routes.ts:1866, ALGO verify routes.ts:1826). `WEAPON_NFT_ALGO_NETWORK_FEE` (weapon-economy.ts:54) is declared but never imported anywhere. | Admin pays ~0.002 ALGO fees + 0.1 ALGO reserve per custody ASA; bounded per player by catalog size but multiplies across players. Dead constant suggests unfinished intent. | Charge a FRNTR mint cost (or verify an ALGO payment) before minting; wire or delete the constant. | Assert mint-nft debits the configured cost; grep CI for unused exports. |
| B5 | Med | FRNTR consistency | weapons/service.ts:91,130,179,239; routes.ts:2069–2175 | All weapon FRNTR sinks use `storage.spendFrontier` (DB only). Routes never call `fireBurn`, unlike drone (routes.ts:2276), satellite (2307), crystal burn (1499), improvements (1548), commander (1866). | On-chain FRNTR wallet balances diverge from DB economy; breaks the established clawback-burn convention for real wallets. | After each successful spend, `fireBurn(player.address, cost, "Weapon …")` in the four routes (fire-and-forget, matching convention). | Mock `clawbackFrontierAsa`; fire a weapon; assert burn invoked with fire cost. |
| B6 | Med | Perf/DoS + metadata | routes.ts:2228–2236,2244,2256 | ARC-3 metadata route selects `weaponProfile` for **all** players and linearly scans per request, unauthenticated. Also returns mutable `upgradeTier` under `Cache-Control: max-age=86400`. | O(players) DB load per hit — cheap DoS vector; NFT traits drift after post-mint upgrades while caches hold stale data. | Query with a JSONB containment filter (or index ownedWeapon id → playerId); decide mutable-vs-frozen traits at mint. | Load test endpoint with 10k players seeded; assert single-row query plan. |
| B7 | Low | Chain limits | weapon.ts:58 | `assetURL` = baseUrl + 62 fixed chars (`/nft/metadata/weapon/<uuid36>#arc3`). Algorand ASA URL max is 96 bytes → baseUrl >34 chars (typical Replit domain) makes the create txn throw. Same latent issue as commander.ts:66; unverified what PUBLIC_BASE_URL is in prod — flagging, not asserting breakage. | Mint hard-fails at txn construction on long domains. | Assert URL byte length ≤96 before mint with a clear error. | Unit test mint with 40-char baseUrl expecting explicit length error. |
| B8 | Low | Concurrency | weapons/service.ts:144–150; storage/db.ts:845–861 | `recordWeaponNft`/`upgradeWeapon` do read-modify-write of the whole `ownedWeapons` array; the DB merge re-reads the row but applies the stale array patch (no row lock). Concurrent unlock/upgrade during the multi-second mint window can be silently overwritten. | Lost upgrades/unlocks; low likelihood (single process) but mint window is seconds long. | Apply per-weapon patches inside the storage transaction (merge by weapon id, or `SELECT … FOR UPDATE`). | Run upgrade concurrently with a stubbed slow mint; assert both mutations persist. |
| B9 | Low | Error handling | routes.ts:2207 vs 2127–2132 | In mint-nft, `markDirty()` runs after `res.json` inside the try; if it throws, the catch (routes.ts:2211) sets status on an already-sent response (ERR_HTTP_HEADERS_SENT). The fire route guards this exact pattern; mint doesn't. | Noisy crash-log / unhandled error path on an otherwise successful mint. | Wrap post-response side effects in their own try/catch as at routes.ts:2129–2132. | Stub markDirty to throw; assert no headers-sent error. |

**Key Insights**

- `weapon.ts` does mirror `commander.ts` faithfully at the txn level (custody model, mainnet freeze/clawback unset weapon.ts:61–62, 32-byte name cap weapon.ts:48, 2-round confirmation, no secret logging; mnemonic only via memoized `getAdminAccount`, client.ts:157–159). The gaps are all in the *route orchestration* around it — the commander route's persistent idempotency + delivery-retry + payment scaffolding was not carried over.
- No atomic-grouping issue exists: mint→transfer cannot be grouped (asset id unknown until confirmation), matching all existing NFT services; fees use suggested params consistently.
- Opt-in checks use algod `accountInformation` (asa.ts:167–182), not the indexer — no indexer-lag false negatives; good.
- The existing `pendingFrontierTransfers` retry queue (transferQueue.ts) is FRNTR-payout-specific; weapon code correctly doesn't reuse it, but has no equivalent for NFT delivery (B2).
- Auth on all weapon routes goes through `assertPlayerOwnership` (routes.ts:208) — consistent, but identity remains body-trust until wallet auth is enforced (known systemic, agent-memory L4); `receiverAddress` being caller-supplied (B3) matters more in that world.

**Code Suggestions**

B1+B2 (sketch, route-level):
```ts
// before mint (routes.ts:2196):
await db.insert(weaponMintIdempotency).values({ key: `wpn:mint:${playerId}:${owned.id}`,
  status: "pending", createdAt: now, updatedAt: now }).onConflictDoNothing();
// after recordWeaponNft: set status "confirmed", assetId, txId.
// new route: app.post("/api/nft/deliver-weapon/:ownedWeaponId", …) → look up nftAssetId,
// verify custody via getAssetHolding(adminAddr), then attemptWeaponDelivery(...).
```

B3 (routes.ts, before line 2198):
```ts
if (!algosdk.isValidAddress(action.receiverAddress))
  return res.status(400).json({ error: "Invalid Algorand receiver address" });
```

B5 (each spending route, after success, e.g. fire at routes.ts:2126):
```ts
const p = await storage.getPlayer(playerId);
if (p) fireBurn(p.address, fireCostFrntr(spec), `Weapon fire ${action.specId}`);
```

**Confidence Score**: 8/10
