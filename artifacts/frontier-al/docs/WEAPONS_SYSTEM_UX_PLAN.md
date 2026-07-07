# Weapons System UX & Architecture Plan

> Owner directive (2026-07-07): map the entire weapons system, organize it so it looks great on
> mobile AND desktop, polish missile flight/animation, make plot/sub-parcel attack targeting
> clear, tied into the game logic and the Algorand chain layer. This doc is the mapped-out
> architecture + gap list + phased unit plan produced from that directive. Mirrors the
> established format of
> [`BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md`](./BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md).
> Executed one unit per chat, same audited PR flow as the rest of the roadmap (Phase 25).

Baseline already on record before this pass (not re-derived, cited by ID):
[`FRONTIER_MASTER_ROADMAP.md`](./../../../docs/FRONTIER_MASTER_ROADMAP.md) Phases 8/10/26
(findings W1–W5), `BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md` (Muster/Shield-Wall/Battle-Scars),
`docs/audit/chain-services-audit.md`.

## What "tied into the smart contract" actually means here

Confirmed architecturally: Algorand doesn't run this game's combat logic in an on-chain
contract — game logic is server-authoritative (Postgres + Express); the only on-chain pieces
are ASA mint/custody (land, commander, weapon NFTs; the ASCEND token) and config-note
transactions. `server/weapons/*` has zero algosdk imports. So "tied into the ALGO smart
contract" for weapons correctly and completely reduces to **weapon-NFT mint/custody/claim
parity** (already tracked as W5) — nothing more is missing at the resolution layer.

## Architecture map (condensed — full file:line evidence in the research agent's report,
session-notes reference below)

- **Catalog**: 42 weapons (`shared/weapons/catalog.ts`) across offensive (ballistic/cruise/
  hypersonic/artillery/rocket-artillery/loitering, 28 weapons) and defensive (anti-air/missile
  defense, 14 weapons — 33% of the catalog). Deterministic closed-form ballistics
  (`shared/weapons/ballistics.ts`), a real intercept solver (`intercept.ts`), a 60-point
  attribute/badge/archetype system.
- **Server runtime**: `server/weapons/engagementStore.ts` (in-memory engagement store) +
  `service.ts` (fire/deploy/build/upgrade). `fireWeapon` looks up weapons by explicit `specId`,
  never consults `profile.loadout` (W2). Status `"impacted"` is defined but never assigned
  anywhere (W1). Stats/badges credit on "not intercepted," not on true impact (W4). **No
  cooldown enforcement anywhere** — every spec defines `cooldownMs` (8s–400s) but nothing
  checks it, client or server (new finding, G-E).
- **Battle engine**: `server/engine/battle/resolve.ts`'s `BattleInput` has no field for weapon
  damage at all — the resolver-level proof that weapon engagements and plot-conquest are fully
  disconnected (W3).
- **Client Armory** (`ArmoryPanel.tsx`, 291 lines): one component mounted in 4 places
  (standalone page, desktop rail, mobile fullscreen tab, dashboard registry) with **exactly one**
  responsive class in the whole file (`sm:grid-cols-2`) — a *viewport* breakpoint, not a
  *container* one, so the ~250px-wide desktop rail always gets the 2-column layout meant for a
  ≥640px viewport. This is the root mechanical cause of the already-known rail grid-squeeze
  (new finding, G-J). "FR"/ASCEND mislabel and hidden upgrade cost confirmed (U3).
- **Client targeting/fire** (`StrikePanel.tsx`, `weaponStrike.ts`): full flow traced — globe
  click → `ParcelHUD` → "Weapon Strike" button → `StrikePanel` → `eligibleStrikes()`. That
  helper also ignores `profile.loadout` (client-side confirmation of W2, new evidence). Source
  parcel for firing is always auto-selected to nearest-owned, no player choice (minor, new).
  Range + cost validated both client and server (genuinely in sync); **no cooldown check
  anywhere**, **no confirm step before spending ASCEND**.
- **Defensive weapons have ZERO client UI** — ownable/unlockable/upgradable but no way to ever
  deploy one. No read endpoint even exists for a player's own batteries. This makes the entire
  interception half of the game (14/42 weapons) inert for players today (new finding, G-A —
  the single highest-impact gap this pass found).
- **Missile flight/animation** (`WeaponProjectile.tsx`, `ImpactBurst.tsx`, `WeaponScene.tsx`,
  `LiveWeaponLayer.tsx`): a real closed-form flight-curve renderer (not a physics sim), fed by
  the server's `weapon_engagement` WS event. **Architecturally disconnected from the shipped
  battle-cinematics `cinematicBus`** — no shared camera, no HUD callout, no incoming-telegraph
  warning for weapon strikes (only for troop battles). 13 badge-gated animation-unlock variants
  are computed and persisted (`unlocks.ts`) but **never rendered** — one fixed visual regardless
  of badge tier (both new findings).
- **Targeting granularity**: whole-plot only. `SubParcelOverlay` is read-only (zero pointer
  handlers) — sub-parcel combat targeting does not exist at all, not just "DB-only on-chain"
  (new finding, extends the existing sub-parcel note into the UI-selection layer).
- **Weapon-NFT chain tie-in**: the mint/custody/transfer code mirrors land/commander exactly
  (genuine parity), but weapon has **no retry-delivery route** (land/commander both have one)
  and — bigger gap than previously tracked — **zero client caller of `/api/weapons/mint-nft`
  exists at all**. Weapon-NFT minting is a complete server-only feature today, unreachable from
  the UI (sharpens W5 from "partial" to "entirely unreachable").
- **Tests**: server has decent coverage of *current* behavior (including the buggy W2/W4
  behavior — fixing those needs new tests, not just green existing ones). Client has **zero**
  test coverage of Armory, Strike, or any missile FX layer.

## Phased unit plan

Ordered; sizes/gates per this repo's roadmap convention. Units already named in the roadmap
(M2-1, M2-2, M2-3, M2-5) are referenced, not redefined — new units below fill gaps this pass
found that weren't yet queued. Unit 3 and 5 are the least design-dependent and highest
value-per-risk — good candidates to execute first.

| # | Unit | Branch | Depends on | ⛓ | Design call needed? |
|---|---|---|---|---|---|
| 1 | `feat/weapon-damage-settlement` (=M2-1/W1) — flip `"impacted"` for real, something reads it | `feat/weapon-damage-settlement` | — | write | No |
| 2 | `feat/combat-convergence` (=M2-2/W3+W4) — settled damage feeds `BattleInput`; badges/stats credit on impact only | `feat/combat-convergence` | 1 | write | No |
| 3 | `feat/weapons-cooldown-enforcement` (NEW) — persist last-fired per weapon, reject fire inside cooldown server-side, extend the rate-limiter (ties into M1-6), show cooldown countdown client-side | `feat/weapons-cooldown-enforcement` | — | none | No |
| 4 | `feat/defense-deploy-ui` (NEW) — `GET /api/weapons/batteries` (owner-only read) + a real deploy flow from `ParcelHUD`, owner-visible battery indicator | `feat/defense-deploy-ui` | — | write | **Yes** — where does "Deploy" live (new panel vs. Armory tab)? |
| 5 | `feat/armory-loadout-polish` (=M2-3/W2+U1+U2+U3) — extend to also fix `weaponStrike.ts`'s `eligibleStrikes` loadout filter (client-side W2), surface upgrade cost, fix FR label, delete dead `BottomNav.tsx`, `/university` WalletProvider caveat per existing audit note | `feat/armory-loadout-polish` | — | none | No |
| 6 | `feat/armory-responsive-layout` (NEW) — container-query-based grid (not viewport `sm:`) so the same component reads correctly in all 4 mount contexts | `feat/armory-responsive-layout` | — | none for the mechanical fix | **Yes** — should the desktop rail get a genuinely denser/different IA (accordion, icon-only cards)? Flagged, not decided here. |
| 7 | `feat/weapon-nft-claim` (=M2-5/W5) — add `POST /api/nft/deliver-weapon/:id` (mirrors land/commander exactly) + the missing client mint/claim entry point on an owned-weapon card | `feat/weapon-nft-claim` | — | write | No |
| 8 | `feat/missile-cinematic-integration` (NEW) — publish a cinematic-bus-style event on `weapon_engagement` so camera/HUD/telegraph can optionally react, without touching `GlobeBattleSequence.tsx`/`battle-sequence.ts` (🚫 guard) | `feat/missile-cinematic-integration` | 1 (for a delayed-impact telegraph) | none | **Yes** — should weapon fire get its own visual identity vs. feeding the same "front-line heat" narrative? |
| 9 | `feat/weapon-animation-tiers` (NEW) — wire `profile.unlockedAnimations` into `WeaponScene`/`WeaponProjectile`/`ImpactBurst`; ship 2-3 concrete variants as a first slice, not all 13 | `feat/weapon-animation-tiers` | — | none | **Yes** — the actual visual treatment per tier is an art/motion-design call; this unit only builds the plumbing |
| 10 | `test/weapons-ui-coverage` (NEW) — client tests for `weaponStrike.ts`/`StrikePanel`, headless-visual smoke of the Armory grid + a fired missile arc | `test/weapons-ui-coverage` | — | none | No |

**Sequencing**: 1→2 must land before 2's "stats on impact" piece and before 8's telegraph piece
are meaningful. 4 (defense deploy) and 7 (NFT claim) are independent, can run in parallel with
anything. 3 (cooldown) is independent, self-contained, no design decision — best first pick.

## 🚫 Don't touch (carried forward, absolute)

`GlobeBattleSequence.tsx`, `battle-sequence.ts` (the shipped, HARD-RULE-gated cinematic code) —
unit 8 must be an additive sibling subscriber, same pattern already proven safe by the
Muster/Shield-Wall/Battle-Scars units. No change to `resolve.ts`'s own resolution math (unit 2
feeds it an input, doesn't touch the math). No mainnet/ASA-param changes (unit 7 is TestNet
click-test + funds-gated like every other NFT unit).
