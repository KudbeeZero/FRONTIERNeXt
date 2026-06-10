# Audit Report — Weapon System (PR #9) Night Run 2026-06-10

**Auditor**: Jordan (Quantum Synthesizer & Final Auditor). Code verified against `origin/main` (merge `d9bbab5`) via `git show` — working tree was NOT on the weapon branch. 85 raw findings from 9 agents consolidated to 28 final items. Paths relative to `artifacts/frontier-al/`.

## 1. Master Issues Table

| Final ID | Source IDs | Severity | Category | File:line | Description | Verified? |
|---|---|---|---|---|---|---|
| W-01 | E1, E4, I1 | **Critical** | Dark launch | GameLayout.tsx:946, BottomNav.tsx:7, App.tsx:71 | Weapon system unreachable: no nav entry to `/armory` AND zero client callers for fire/deploy-defense/mint-nft — equip loop has no payoff | **Verified** (grep origin/main client: 0 nav links, 0 fire callers) |
| W-02 | H1 ≡ I2 | High | Funds loss | weapons/service.ts:239-240 ↔ engagementStore.ts:96-99 | `deployDefense` burns FRNTR before store cap check; 13th battery → 400 error, cost kept | **Verified** (spend precedes `Battery limit reached` throw) |
| W-03 | H3 ≈ C7 (+cooldown) | High | Game integrity | weapons/service.ts:165-203 | Kill/precision/longRange stats credited with no target-ownership/self-target check; `cooldownMs` never enforced → badge-farm entire catalog by shelling own parcel | **Verified** (no ownership check on target; no cooldown read) |
| W-04 | D1 | High | Security | server/index.ts:152-153, routes.ts:2056+ | `/api/weapons/*` mutators outside `actionsLimiter` (60/min); only 1000/min apiReadLimiter applies | **Verified** (only `/api/actions` mounted) |
| W-05 | D2 ≈ B6 | High | Security/DoS | routes.ts:2218-2237 | Unauthenticated `/nft/metadata/weapon/:id` full-table scans ALL players per request; also caches mutable `upgradeTier` 86400s | **Verified** (`db.select().from(playersTable)` no where-clause) |
| W-06 | B1 ≈ D3 (+B4) | High | Chain/idempotency | routes.ts:2178-2215, service.ts:138-151 | Mint dedupe is in-memory Set only; `recordWeaponNft` failure after on-chain mint → retry mints duplicate 1-of-1 ASA. Mint also charges zero FRNTR (admin ALGO drain); `WEAPON_NFT_ALGO_NETWORK_FEE` declared, never used | **Verified** (record-after-mint, no spendFrontier in route, existing idempotency tables unused) |
| W-07 | H2 | High | Concurrency | weapons/service.ts:84-100, 121-134 | Unlock/upgrade read-check-spend-write spans awaits, no lock: concurrent calls double-charge one weapon/tier | **Verified** (code structure confirmed) |
| W-08 | A1 | High | Client lifecycle | useGameSocket.ts:173-188 | Cleanup closes ws but `onclose` stays attached and reschedules `connect`; reconnect cap resets on open → zombie sockets, duplicate FX/event dispatch on auth flip or /armory nav | **Verified** (onclose unconditionally reschedules; `onopen` resets count) |
| W-09 | I3 ≈ H5 | High | Durability | engagementStore.ts:85-87 | Paid defense batteries live only in process-singleton Maps; restart silently destroys them, FRNTR kept | **Verified** (class-private Maps, no persistence/rehydrate) |
| W-10 | I6 | High | Deploy | db-schema.ts:132, migrations/ | `weapon_profile` column has no SQL migration (0000-0004 only); migration-provisioned envs break every weapon route | **Verified** (`git ls-tree`: no 0005) |
| W-11 | E2 ≡ A2 | High | UX trust | ArmoryPanel.tsx:98-117 | All 4 mutations `onSuccess` only — insufficient-FRNTR/max-tier failures silently swallowed on paid actions | **Verified** (no onError in any of the 4) |
| W-12 | C1+C2+C3 | High | Test gap | service.ts:155-219, routes.ts:2056-2270 | Zero tests for fire success path (money+stats), zero HTTP tests for 8 routes (auth seam), zero concurrency tests | Verified (Casey ran suite: 160 tests, all guards/happy-path-shaped) |
| W-13 | H4 | Med | Logic | engagementStore.ts:178-181 ↔ service.ts:211 | Battery deleted when magazine empties BEFORE service's `listBatteries().find()` credit lookup → magazine-emptying intercept never credits defender | **Verified** (delete precedes hit-credit lookup path) |
| W-14 | H6 ≡ C3 ≡ I8 | Med | Concurrency | service.ts:165, 193-203 | Stats written from pre-spend snapshot; concurrent fires drop increments (known/accepted in session notes, still unpinned) | **Verified** (read-modify-write wholesale) |
| W-15 | B2 | Med | Chain | weapon.ts:121-135 | No delivery-retry endpoint (land/commander have one); `not_opted_in` NFT stranded in admin custody forever (mint-nft re-call 409s) | Verified by Blake (route grep consistent) |
| W-16 | B3 ≡ D4 | Med | Validation | profile.ts:128, routes.ts:2182 | `receiverAddress` only `z.string().min(1)` — no `algosdk.isValidAddress`; garbage address wastes a mint | Verified (schema cited consistently by 2 agents) |
| W-17 | B5 | Med | Chain/economy | service.ts:91,130,179,239 | Weapon FRNTR sinks DB-only; no `fireBurn` on-chain clawback unlike all sibling sinks → wallet/DB divergence | Verified by Blake |
| W-18 | F4 ≈ I7 | Med | Security/Perf | routes.ts:2130, wsServer.ts | `weapon_engagement` broadcast unscoped with full Engagement (attackerId, pk, batteryId = defense-quality intel) + markDirty full-state churn per fire | **Verified** (route broadcasts full object) |
| W-19 | G1 ≡ I5 (+G5) | Med | Docs | docs/WEAPON_SYSTEM.md:77 | Doc lists WS event `weapon_battery` that audit commit 33e4dd6 deliberately removed (fog-of-war) | Verified by Gabe (git grep = 0 hits) |
| W-20 | G2 | Med | Docs/economy | TOKENOMICS.md:63-75, ECONOMICS.md:121 | Weapon burns (4–230 FRNTR fire, 6x unlock, 3xN upgrade, 4x deploy) absent from both canonical sink tables | Verified by Gabe |
| W-21 | A3 ≈ E8 | Med | UX | ArmoryPanel.tsx:137-142, 246-250 | Equip toggle derives from stale snapshot, no optimistic update; all cards disabled while one mutation pending | Verified (code read) |
| W-22 | E5 + E9 | Med | A11y | ArmoryPanel.tsx:164-221 | Bare +/− glyph buttons no aria-labels, div progress bars, locked-state contrast ~1.9–3:1 | Verified by Evan (ratios estimated) |
| W-23 | E6 + A9 + E7 | Med | Design system | ArmoryPanel.tsx:64-271 | Raw hex/buttons outside shadcn DS, zero data-testid, "FR" currency label nonstandard, upgrade cost not shown | Verified by 2 agents |
| W-24 | E3 + E10 | Med | UX | pages/armory.tsx:20-30 | "Connect wallet" false-negative during load; mobile dead-end (no BottomNav, 12px back link) | Verified by Evan |
| W-25 | D5 | Med | Authz (inherited) | routes.ts:208 | Body-trust identity (known systemic) now fronts spend + on-chain mint | Verified — pre-existing, documented in L4 |
| W-26 | F1+F2+F5+F6+F8+A7 | Med | Perf (client FX) | WeaponProjectile.tsx, ImpactBurst.tsx | Per-frame allocs, per-shot geometry/material creation, ImpactBurst lacks settle gate, no shot cap/memo | Verified (convergent Alex+Fiona) |
| W-27 | H7 (+W-09 adjunct) | Low | Resync | routes.ts (no GET engagements) | At-most-once WS delivery; reconnecting client never learns of in-flight shots | Verified by 2 agents |
| W-28 | H8,H9,H10,C4,C12,B7,B8,B9,H11,F3,A8,C9-C11,I9,A4-A6,D7≡F7,D8,G3-G8 | Low | Grouped lows | various | Math edges (dateline lerp, 64-sample quantization, NaN guards), ASA URL 96-byte limit, markDirty-after-send, latent FX timing, stale doc misc, O(all-batteries) scan | Spot-checked; consistent |

## 2. Verification Pass (top 8+) — adjudications

- **W-01** Verified, **promoted to Critical umbrella** merging E1 (nav) + E4/I1 (no fire caller): not two gaps but one dark-launched feature. Evan's intent uncertainty noted — treat as gate, not bug.
- **W-02, W-03, W-04, W-05, W-06, W-07, W-08** all Verified directly against `origin/main` (see table). None inflated.
- **W-09** Harper rated Med, Ivy High → **resolved High**: paid-asset loss on every restart is player-facing funds loss.
- **D6 (Dana) REFUTED**: claimed fire double-spend if `store.launch` throws post-spend. `launch()` throws only on unknown spec, pre-validated at service.ts:161-162 before the spend. Ivy's Verified-OK note is correct. Demoted to non-issue (latent footgun only if launch gains throw paths).
- **A1 nuance**: `WS_MAX_RECONNECTS` cap exists but `onopen` resets the counter — zombie loop persists if reconnects succeed. Alex's High stands.
- **Contradiction resolved**: engagementStore comment claims routes "settle damage" — Ivy I4/Harper H3 agree no settlement exists anywhere. Code comment is the lie; folded into W-03 scope decision.
- **F9 / Fiona**: sandbox bundle isolation confirmed positive (no rollup input) — no action; matches Alex's independent check.

## 3. Sub-tables

### Test Gaps (Casey + corroborators)
| Gap | Source | Priority |
|---|---|---|
| fireWeapon success path: spend, range, stats, intercept credit | C1, H3, H4 | 1 |
| HTTP tests for all 8 routes: auth seam, Zod 400s, mint race | C2, D5 | 2 |
| Concurrency: parallel fire/unlock (pins W-07/W-14) | C3, H2, H6 | 3 |
| Intercept envelope edges: reactionMs, maxAltKm, zero-distance, antipodes | C4, C12, H8-H10 | 4 |
| Layered defense + magazine-empty deletion (pins W-13) | C5, H4 | 5 |
| Storage mem/db parity, economy cost fns, chain mocks | C6, C8, C10 | 6 |

### Security (Dana / Harper / Blake)
| Issue | Final ID | Live now? |
|---|---|---|
| Un-throttled value-moving routes | W-04 | Yes (curl-able on main) |
| Unauth full-table-scan metadata DoS | W-05 | Yes (public route) |
| Mint duplicate-ASA + free mint = admin ALGO drain | W-06 | Yes (API live) |
| Badge-farm via self-fire | W-03 | Yes (API live) |
| Intel leak: pk/attackerId/batteryId broadcast to all | W-18 | Yes (any WS client) |
| Body-trust identity fronting spends | W-25 | Inherited; gated by WALLET_AUTH_REQUIRED |

### Performance (Fiona)
| Issue | Final ID | Severity |
|---|---|---|
| Per-frame allocs + per-shot geometry (burst load) | W-26 | Med |
| Full-state flush per fire via markDirty | W-18 | Med |
| O(all batteries) solveIntercept per launch | W-28 | Low (grows with W-09 fix) |
| ImpactBurst no settle gate / redundant buffer uploads | W-26 | Low |

## 4. Traceability Matrix

| Final ID | Night reports | Code ref | Status |
|---|---|---|---|
| W-01 | evan E1/E4, ivy I1 | client nav + grep | Verified |
| W-02 | harper H1, ivy I2 | service.ts:239 | Verified |
| W-03 | harper H3, casey C7, ivy I4 | service.ts:165-203 | Verified |
| W-04 | dana D1 | index.ts:152 | Verified |
| W-05 | dana D2, blake B6 | routes.ts:2218 | Verified |
| W-06 | blake B1/B4, dana D3 | routes.ts:2178 | Verified |
| W-07 | harper H2 | service.ts:84-134 | Verified |
| W-08 | alex A1 | useGameSocket.ts:173 | Verified |
| W-09 | ivy I3, harper H5 | engagementStore.ts:85 | Verified |
| W-10 | ivy I6 | migrations/ | Verified |
| W-11 | evan E2, alex A2 | ArmoryPanel.tsx:98 | Verified |
| W-12 | casey C1-C3 | spec suite | Verified (suite run) |
| W-13 | harper H4 | engagementStore.ts:181 | Verified |
| W-14–W-28 | per table §1 | per table | Agent-verified, spot-checked |
| D6 | dana | service.ts:179 | **Refuted** |

**Overall**: 9 agents converged heavily (5 independent dedupe clusters); zero fabricated line refs found in spot checks; 1 refutation. Confidence in consolidated set: high (8.5/10).
