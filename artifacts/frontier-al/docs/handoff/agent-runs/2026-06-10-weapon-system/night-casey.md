# Night Casey — 2026-06-10 — Weapon System (PR #9) Test Coverage

## Casey — Night Shift Report
**Focus**: PR #9 weapon system test coverage (branch `origin/pr/9`). Mapped 6 existing specs (catalog/progression/sim/engagementStore/service/weaponProfile — 160 tests, suite GREEN at 6.0s) against the untested surface: shared/weapons/{ballistics,intercept,scale,attributes,badges,unlocks,defense,antiAir,artillery,missiles,profile}.ts, server/weapons/{service,engagementStore}.ts uncovered paths, weapon routes (routes.ts:2056–2270), server/services/chain/weapon.ts, storage db/mem weapon methods. All paths below are under `artifacts/frontier-al/` at the PR #9 ref.

**Findings Table**
| ID | Severity | Category | File(s) | Description | Impact | Suggested Fix | Test Idea |
|----|----------|----------|---------|-------------|--------|---------------|-----------|
| C1 | High | Coverage gap | server/weapons/service.ts:155–219 | `fireWeapon` SUCCESS path has zero tests — service.spec.ts only covers guards. Untested: FRNTR spend on fire, range gate (`:174`), source-ownership (`:173`), stats increments (shotsFired/kills `:194–198`, longRangeHits >0.6·range, precisionHits cepM≤10), defender intercept credit (`:211`) | Core gameplay+economy loop unverified; a regression in stat math or spend silently breaks badge progression | New `server/weapons/service.fire.spec.ts` with owned parcels in MemStorage | Fire owned msl_ballistic_1 between two in-range owned/enemy parcels; assert frontier debit, shotsFired=1, kills=1; loop with def_aegis battery until intercepted → assert defender intercepts+1 |
| C2 | High | Coverage gap | server/routes.ts:2056–2270 | All 8 weapon routes have zero HTTP tests: `assertPlayerOwnership` (routes.ts:208) auth on every route, Zod 400s, mint-nft in-flight lock (`:2197–2199`), already-minted 409 (`:2187`), missing PUBLIC_BASE_URL 503 (`:2190`), metadata 404/format (`:2218+`) | Body-trust identity (agent-memory L4): an auth-wiring regression lets any player build/fire/mint as another; mint race drains admin ALGO | Throwaway tsx/supertest integration test per repo close-out convention (mount real router, mock chain) | POST /api/weapons/fire with mismatched playerId → expect 401/403; two parallel mint-nft for same ownedWeaponId (stub mint slow) → exactly one 200, one 409 |
| C3 | High | Concurrency | server/weapons/service.ts:165,192–207 | Lost-update race: `fireWeapon` reads profile at `:165`, computes stats from that snapshot, writes at `:207`. Two concurrent fires by one player drop a shotsFired/kills increment (mem AND db — db tx re-reads base but patch overwrites stats wholesale) | Stats/badge progression undercounts under rapid fire; also `engagementStore` singleton (engagementStore.ts:228) shared across requests untested under interleaving | Test pins behavior; fix later via read-modify-write inside storage tx or atomic stat-increment API | `await Promise.all([fire(), fire()])` on funded player → EXPECT shotsFired=2 (currently fails → documents bug) |
| C4 | Med | Edge cases | shared/weapons/intercept.ts:79,83,86–88 | Solver boundaries untested: reactionMs gate (close-in shot with tof < reactionMs → no intercept), maxAltKm ceiling (high ballistic apex over low-ceiling def_cram → detected=true/intercepted=false), zero-distance from==to (tof=0), non-defense spec guard (`:60`), pk clamp [0.02,0.98] | Envelope math regressions (e.g. unit slip in flyout `km·1e6/speed`) would pass current happy-path specs | New `shared/weapons/intercept.edge.spec.ts` | aa_short battery at target vs msl_ballistic_3 at max range → assert detected && !intercepted (apex above maxAltKm); from==to launch → no NaN, no intercept |
| C5 | Med | Edge cases | server/weapons/engagementStore.ts:170–199,181 | Layered defense untested: multi-battery ordering (earliest `timeToInterceptMs` fires first), magazine→0 battery deletion (`:181`), `active()` using interceptTs for intercepted tracks (`:210`), `launch` unknown-spec throw (`:131`), `removeBattery`/`clear` | Layered-defense regression (wrong battery credited / spent battery re-walked) invisible to current single-battery spec | Extend engagementStore.spec.ts | Deploy def_cram (1-round magazine) + def_aegis on target; fire until cram expends → assert cram removed from listBatteries() and aegis engages next track |
| C6 | Med | Coverage gap | server/storage/db.ts:832–861 | `DatabaseStorage.getWeaponProfile/updateWeaponProfile/spendFrontier` untested (only MemStorage covered); mem/db parity unverified — db merges `{...base, ...patch}` on a JSON column; shallow-merge contract (partial `stats` patch wipes siblings) pinned nowhere | Mem-tested green suite can still break prod (Postgres) persistence; micro-FRNTR conversion (`:863+`) unchecked | Parity spec via pg-mem or contract test run against both IStorage impls | Same updateWeaponProfile patch sequence on Mem + Db → deep-equal resulting profiles; spend exact balance → succeeds, +1 micro → throws |
| C7 | Med | Stat farming | server/weapons/service.ts:173,196–198 | Target parcel ownership never checked: firing at YOUR OWN parcel credits kills/longRangeHits/precisionHits. Badges (→ unlocks) grindable by shelling yourself; no test pins intended behavior | Pay-to-grind exploit path to hall_of_fame unlocks (msl_hyper_4) | Decide intent; likely exclude self-owned targets from kill credit | Fire at own second parcel → assert kills stays 0 (currently 1 — expected-fail documents the hole) |
| C8 | Med | Coverage gap | server/services/chain/weapon.ts:36–135 | Entire NFT module untested: 32-byte assetName truncation (`:48`), mainnet freeze/clawback unset (`:62–63`), missing assetIndex throw (`:73`), `attemptWeaponDelivery` not_opted_in / transfer_failed branches (`:122–133`); `recordWeaponNft` (service.ts:138) can silently overwrite an existing nftAssetId | On-chain money path; eligibility.spec.ts proves chain dir is mockable | Mock algosdk client like chain/eligibility.spec.ts | Long category + UUID → assetName.length ≤ 32; isAddressOptedIn=false → {delivered:false, reason:"not_opted_in"} |
| C9 | Low | Boundary values | shared/weapons/attributes.ts:73–88,97–113 | `validateBuild` negative/float/NaN rejection untested (only over-budget/over-max); `effectiveAttributes` double-tension (firepower>cap AND interception>cap both taxing firepower) and clamp-to-0 untested | Zod blocks negatives at routes, but service is also called internally — drift risk | Add cases to progression.spec.ts | `validateBuild({firepower:-1})`, `{firepower:1.5}`, `{firepower:NaN}` → ok:false; build(fp:20, int:20, log:0) → eff.firepower clamped, never <0 |
| C10 | Low | Coverage gap | shared/weapon-economy.ts:26–48 | All four cost fns untested: test-mode floor `Math.max(1,…)`, production rounding, upgrade `Math.max(1,toTier)` for toTier 0/negative | Mispricing every weapon action if ECONOMY_MODE handling regresses | Tiny `shared/weapon-economy.spec.ts` | cheapest spec → fireCostFrntr ≥ 1; upgradeCostFrntr(spec, 0) === upgradeCostFrntr(spec, 1) |
| C11 | Low | Edge cases | server/weapons/service.ts:103–113; shared/weapons/profile.ts:106 | `setLoadout` service-level: duplicates allowed, >8 entries only capped by route Zod, empty-clear path untested | Internal callers bypass the cap; loadout semantics unpinned | Service-level cases | setLoadout 9 ids via service → currently succeeds (pin or fix); duplicates → decide |
| C12 | Low | Edge cases | shared/weapons/scale.ts:94–96,63–66; badges.ts:108–114 | slerpGeo antipodal/identical fallback, unitVecToGeo asin clamp, km↔arc round-trip untested; badgeTierForScore silver/gold boundaries and threshold-minus-1 untested | Antipodal NaN would poison positionAt/intercept downstream | Add to sim.spec.ts / progression.spec.ts | slerpGeo({0,0},{0,180},0.5) → finite lat/lng; badgeTierForScore(34)="bronze", (35)="silver", (64)="silver", (65)="gold" |

**Key Insights**
- The suite is green (23 files / 160 tests) but coverage is happy-path-shaped: every guard/error throw is tested, while the success paths that move money and stats (`fireWeapon`, `deployDefense` spend+geo, mint flow) are not.
- Zero HTTP-level tests for +239 route lines despite body-trust identity — auth wiring (`assertPlayerOwnership`) is the single most security-sensitive untested seam.
- Concurrency is the blind spot: stats lost-update (C3), mint in-flight lock (C2), and singleton engagementStore interleaving have no tests; everything currently runs serially in specs.
- Shared math modules are well-covered at the center, untested at the envelope edges (reaction time, altitude ceiling, antipodes, zero distance) — exactly where unit-conversion bugs hide.
- Top 5 new test files, in order of value: (1) service.fire.spec.ts (C1+C3+C7), (2) weapons routes integration spec (C2), (3) intercept.edge.spec.ts (C4+C12), (4) engagementStore layered-defense cases (C5), (5) storage parity + economy spec (C6+C10).

**Code Suggestions**
```ts
// 1. server/weapons/service.fire.spec.ts — happy path + stats (C1)
it("fires, spends FRNTR, and credits shot/kill stats", async () => {
  const { storage, store, playerId, player } = await setup(100_000);
  const src = await storage.createParcel({ lat: 0, lng: 0, ownerId: playerId } as any);
  const dst = await storage.createParcel({ lat: 0, lng: 2 } as any); // ~42 km
  await svc.unlockWeapon(storage, playerId, "msl_ballistic_1");
  const before = player.frontier;
  const e = await svc.fireWeapon(storage, store, {
    playerId, specId: "msl_ballistic_1", sourceParcelId: src.id, targetParcelId: dst.id,
  });
  expect(["in_flight", "intercepted"]).toContain(e.status);
  expect(player.frontier).toBeLessThan(before);
  const prof = await storage.getWeaponProfile(playerId);
  expect(prof.stats.shotsFired).toBe(1);
  expect(prof.stats.kills).toBe(1); // undefended → reaches target
});

// 2. shared/weapons/intercept.edge.spec.ts — envelope boundaries (C4)
it("cannot engage when the track's apex exceeds the battery's ceiling", () => {
  const incoming = getWeapon("msl_ballistic_3")!;          // lofted apex
  const cram = getWeapon("def_cram")!;                     // low maxAltKm bubble
  const res = solveIntercept({
    incoming, from: { lat: 0, lng: 0 }, to: { lat: 0, lng: 20 },
    defense: cram, defenseAt: { lat: 0, lng: 10 },         // mid-track, apex overhead
  });
  expect(res.intercepted).toBe(false);                     // detected ≠ engageable
  expect(res.pk).toBe(0);
});
```

**Confidence Score**: 8/10
