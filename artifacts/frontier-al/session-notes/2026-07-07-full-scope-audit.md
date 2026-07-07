# 2026-07-07 — Full-scope readiness audit → roadmap merge (docs-only)

**Branch:** `docs/roadmap-full-scope-audit` · **Unit:** one docs-only PR
**Owner ask:** full sweep — weapons arsenal, game flow, NFT system (land + sub-plots +
upgrades on-chain), battle system, menus/design, wallet multi-popup, index pages, AAA
security — plus a 3-month buildout plan for Sonnet. Owner /goal: **merge findings into the
existing roadmap, no parallel roadmap.**

## Method

Three parallel read-only exploration agents (weapons/battle · NFT/wallet/chain ·
UI/handoff/security). All findings file:line-anchored. **No code was changed or verified by
running it — findings are exploration-grade**; each queued unit must re-confirm its anchors
before coding.

## Headline findings

- **W1 (biggest gameplay gap):** the 42-weapon missile system is cosmetic — damage is computed
  (`server/weapons/engagementStore.ts:156`) but never settled to any plot; `"impacted"` never
  set; no server tick. Loadout is dead state (W2); badges credit no-effect shots (W4). The
  plot-conquest engine itself is deterministic, provably fair, well-tested.
- **N1 (worst funds gap):** no atomic delivery/rollback — paid purchase whose background mint
  fails leaves ALGO consumed, no NFT, no refund, no retry (`routes.ts:2091-2098`). Payment
  verification itself is solid.
- **N3:** ASCEND ASA id resolved by name-lookup only (`asa.ts:117,128`); `755818217` appears
  only in `handbook.html` — pin via env.
- **N4:** sub-parcels are DB-only (never minted); sub-parcel upgrades anchored as detached
  admin self-transfer notes (`upgrades.ts:28`) not tied to the plot ASA, and likely broken
  under algosdk v3.
- **N5/N6:** NFT metadata/images mutable + centrally hosted (no IPFS/integrity hash); mainnet
  ASAs would keep admin `manager`/`reserve`.
- **Wallet popups:** the #175/#176 popup-storm fix holds; residual vectors are P1 per-route
  `WalletProvider` remount re-arming auto-auth, P2 landing↔game cross-origin second connect,
  P3 purge-on-connect aborting session resume.
- **UI:** `/university` missing WalletProvider; dead `BottomNav.tsx`; armory label/price/radius
  bugs; `Date.now()` vs `serverNow()` drift; `/admin` unlinked; `index.html` lacks a loading
  state (meta/OG otherwise healthy). NFT claim flow + biome wallet images all exist and work.

## What shipped (this PR)

- `docs/FRONTIER_MASTER_ROADMAP.md` — Phases 6/8/10/15 extended with the findings (evidence
  inline); **new Phase 26 — NFT & On-Chain State Completeness** (ARC-69-notes-now /
  ARC-19+IPFS-at-mainnet approach); **Phase 25 rewritten as the 3-month unit queue**
  (M1 funds safety + wallet truth → M2 combat convergence + on-chain completeness →
  M3 security posture + launch path; 18 units with branches + gate lanes).
- `docs/HANDOFF.md` — baton rewritten: AWAITING_AUDIT for this PR; queue = M1→M3 with
  Sonnet execution notes; owner action items + risks + HARD RULES carried forward.
- `CLAUDE.md` (root) + `artifacts/frontier-al/CLAUDE.md` — roadmap/queue pointers added;
  fixed the root file's stale claim that the app CLAUDE.md holds the funds HARD RULES
  (it's a conventions doc; the rules live in root + the gate skills).
- `artifacts/frontier-al/docs/ROADMAP_90DAY.md` — supersession banner.
- `artifacts/frontier-al/docs/audit/chain-services-audit.md` — corrected stale
  "`attemptDelivery` never called" row (purchase path calls it at `routes.ts:2084`).

## Honest gaps

- Findings are read-only exploration, untested; line numbers will drift.
- P2 (cross-origin wallet re-connect) needs an owner decision before code.
- Nothing here changes game behavior; tests were not run against new code because there is
  no new code.
