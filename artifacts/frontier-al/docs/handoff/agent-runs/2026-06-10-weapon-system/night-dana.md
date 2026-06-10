## Dana — Night Shift Report
**Focus**: PR #9 weapon attack surface — the 9 weapon routes in `server/routes.ts` (L2043-2298), `server/weapons/service.ts`, `server/weapons/engagementStore.ts`, `server/services/chain/weapon.ts`, weapon zod schemas (`shared/weapons/profile.ts`), db-schema `weaponProfile` column, and `useGameSocket.ts` WS trust. Reviewed against existing hardening (`server/security.ts`, `index.ts` limiters, `assertPlayerOwnership`). Code on `origin/pr-9` (inspected via read-only worktree); not modified.

**Findings Table**

| ID | Severity | Category | File(s) | Description | Impact | Suggested Fix | Test Idea |
|----|----------|----------|---------|-------------|--------|---------------|-----------|
| D1 | High | Rate limiting | server/index.ts:152-153; routes.ts:2056-2215 | All weapon mutators live under `/api/weapons/*`, NOT `/api/actions/*`. The 60/min `actionsLimiter` never applies; only the coarse 1000/min `apiReadLimiter` does. Fire/unlock/upgrade/deploy/mint are value-moving yet effectively un-throttled. | FRNTR/treasury drain + spam; a script can fire 1000x/min, far above legit play. Existing attack/mine get 60/min. | Mount `actionsLimiter` (or a dedicated weapon limiter) on `/api/weapons`; add per-spec fire cooldown. | tsx integration: 61 rapid POSTs `/api/weapons/fire` → expect 429. |
| D2 | High | DoS / injection | routes.ts:2218-2237 | `/nft/metadata/weapon/:ownedWeaponId` is unauthenticated and runs `db.select(...).from(playersTable)` with NO where-clause, then JS-scans every player's `ownedWeapons`. O(players) full-table scan per request, no dedicated limiter (not in the `enumerationLimiter` list at L285-296). | Unauthenticated full-table scan amplifies into a cheap DoS; minor weapon-detail enumeration via 8-char ids. | Index/lookup by id (or a `weaponNfts` table like `commanderNftsTable`); add to `enumerationLimiter` list. | Seed N players; assert one metadata GET issues a bounded query, not a full scan. |
| D3 | High | Spend enforcement / idempotency | routes.ts:2178-2215; chain/weapon.ts:35-93 | `mint-nft` charges NO FRNTR (only admin pays the on-chain ALGO fee). Combined with cheap unlock, a player mints arbitrarily many ASAs, each draining admin ALGO. If `recordWeaponNft` (L2204) throws AFTER the on-chain create succeeds, the `nftAssetId` is never persisted → next mint re-mints (duplicate 1-of-1 ASA, more ALGO). | Admin-wallet ALGO drain; orphaned/duplicate ASAs. | Charge a FRNTR mint cost via `spendFrontier` before minting; persist intent/asset before delivery; reconcile orphans on chain-record failure. | Force `recordWeaponNft` to throw post-mint; assert no second create on retry. |
| D4 | Med | Input validation | profile.ts:125-129; routes.ts:2201-2205 | `receiverAddress: z.string().min(1)` is not validated as a real Algorand address (cf. `/api/auth/nonce` which uses `algosdk.isValidAddress`, routes.ts:307). Garbage address reaches the chain mint; ASA is created (admin ALGO spent) before transfer throws → wasted mint in admin custody. | Wasted mints / admin ALGO; junk baked into on-chain metadata path. | `z.string().refine(algosdk.isValidAddress)`; validate before `mintWeaponNft`. | POST mint with bad address → 400, no ASA created. |
| D5 | Med | Authz / identity | routes.ts:208-246, 2056-2215 | Weapon routes correctly funnel through `assertPlayerOwnership`, but per agent-memory identity is body-trust until wallet auth. With `WALLET_AUTH_REQUIRED=false` (auth.ts:43) any caller passes any `playerId` and fires/spends/mints on another's behalf. Inherited, documented gap — but weapon system now exposes spend + on-chain mint over it. | Act-as-anyone for all weapon spend/mint while auth disabled. | Keep `WALLET_AUTH_REQUIRED` default-on; treat weapon spend as auth-gated only. | With auth off, fire as player B using A's session → assert blocked once on. |
| D6 | Med | Idempotency | service.ts:179-188 | `fireWeapon` calls `spendFrontier` then `store.launch`; no idempotency key and no refund if `launch` throws after the spend. Duplicate/retried POSTs double-spend. | FRNTR lost on partial failure; replay double-charge. | Wrap spend+launch atomically or refund on launch failure; accept client idempotency key. | Mock `launch` to throw post-spend; assert balance refunded. |
| D7 | Low | DoS (unbounded) | engagementStore.ts:96-98,161-176 | `MAX_BATTERIES_PER_PLAYER=12` caps per player, but total batteries across all players is unbounded, and every `fire` walks ALL batteries via `solveIntercept`. Many players × batteries makes each fire O(total batteries). | Fire latency grows with global battery count. | Spatially pre-filter batteries by great-circle range before `solveIntercept`. | Deploy many batteries; measure fire resolution scaling. |
| D8 | Low | Client WS trust | useGameSocket.ts:80-108,166-169 | Client trusts `weapon_engagement` payload verbatim (no schema check) and `from/to` drive globe FX. Server is the only sender and `deploy-defense` is intentionally NOT broadcast (routes.ts:2150-2153, good fog-of-war). Low risk unless WS sender trust changes. | Malformed/forged event could distort client FX only (no state mutation). | Zod-parse inbound `weapon_engagement` client-side; ignore on failure. | Feed malformed payload; assert dispatcher swallows it. |

**Key Insights**
- Validation is otherwise solid: every mutator zod-parses and returns generic "Invalid request data" on `ZodError`; `loadout` is `.max(8)`; `fireWeapon`/`deployDefense` enforce parcel ownership server-side (service.ts:174,237); fire cost/range computed server-side from spec, not client.
- Mint race is partially handled: per-process `weaponMintInFlight` Set + `nftAssetId` guard (routes.ts:2184-2196) — but comment admits single-process only, and the post-mint record failure (D3) is the residual hole.
- Engagement pruning is correct and bounded (interval `.unref()` at L2053 + opportunistic prune on launch); no unbounded interval/array leak in the runtime store itself.
- Secrets: chain/weapon.ts uses admin account from `getAdminAccount()`; no key material logged. `PUBLIC_BASE_URL` gated (503 when unset). Good.
- Root cause of D1+D2: weapon routes were added outside the established `/api/actions` + `enumerationLimiter` hardening lanes — a wiring omission, not a logic flaw.

**Code Suggestions**
```ts
// D1 — routes.ts, before weapon route registration (mirror index.ts actionsLimiter)
app.use("/api/weapons", actionsLimiter);

// D2 — add the public metadata route to the enumeration limiter list (L285)
"/nft/metadata/weapon/:ownedWeaponId",

// D3 — charge FRNTR + record-before-deliver (routes.ts mint handler)
await weaponService.spendMintCost(storage, playerId, owned.specId); // new
const mint = await mintWeaponNft({ ... });
await weaponService.recordWeaponNft(storage, playerId, owned.id, mint.assetId); // persist FIRST
const delivery = await attemptWeaponDelivery(mint.assetId, action.receiverAddress, owned.id);

// D4 — profile.ts mintWeaponNftActionSchema
receiverAddress: z.string().refine(algosdk.isValidAddress, "Invalid Algorand address"),
```

**Confidence Score**: 8/10
(Routes/service/store/chain/schemas read in full on pr-9; limiter wiring confirmed. Uncertainty: exact prod value of `WALLET_AUTH_REQUIRED` and whether a weapon-specific limiter is added downstream of pr-9.)
