# 2026-07-07 — Weapons unit 1: `feat/armory-loadout-polish` (plan unit 5 = M2-3/W2+U1+U2+U3)

First execution unit under the owner's weapons-system deep-dive directive
([`docs/HANDOFF.md`](../../docs/HANDOFF.md), [`WEAPONS_SYSTEM_UX_PLAN.md`](../docs/WEAPONS_SYSTEM_UX_PLAN.md)).
Picked as the first pick per the plan's own sequencing note ("least design-dependent and
highest value-per-risk"): no new UI surface, no chain work, just closing a real
client/server logic gap and two small UI bugs.

## What changed

**W2 — loadout wiring (the actual bug):** `PlayerWeaponProfile.loadout` existed and was
settable via `setLoadout`, but nothing ever consulted it. A player could equip a loadout
in the UI and the server would still let them fire *any* owned weapon — the equip screen
was cosmetic. Fixed both ends:

- `server/weapons/service.ts` — `fireWeapon()` now rejects firing an owned-but-unequipped
  weapon once the player has a non-empty loadout (`/not equipped/i`). An **empty loadout
  means no restriction** — this is the default for every profile and for every player who
  has never opened the equip UI, so existing behavior for players who never touch loadout
  is unchanged. The gate runs before the parcel lookup.
- `client/src/lib/weaponStrike.ts` — `eligibleStrikes()` gained the same `loadout` param
  with the same empty-means-unrestricted semantics, so the Strike panel never offers a
  weapon the server would then reject. New `hasOwnedOffensiveWeapons()` helper drives a
  clearer empty-state message ("equip an offensive weapon" vs. "you own none").
- `client/src/components/game/globe/StrikePanel.tsx` — wired `catalog.data.profile.loadout`
  into the `eligibleStrikes()` call and the new empty-state helper.

**U2/U3 — Armory UI bugs:**
- `ArmoryPanel.tsx` — the Unlock button showed "FR" instead of "ASCEND". The Upgrade button
  showed no cost and had no max-tier state (could show "Upgrade" forever past the cap). Now
  shows `Upgrade · {cost} ASCEND` and swaps to a disabled "Max tier" pill at
  `MAX_WEAPON_UPGRADE_TIER`.

**Dead code:** `BottomNav.tsx` (112 lines) was fully dead — the `<BottomNav>` component is
never rendered anywhere (superseded by `HudShell`) — but its `NavTab` type export was still
a live import for 3 files. Relocated `NavTab` into `client/src/lib/panelNav.ts` (which
already imported it) and updated all 4 call sites, then deleted the file.

## Design call made (owner delegated engineering judgment this session)

**Empty loadout = unrestricted**, not "equip nothing = can't fire anything." Rationale:
every existing player's profile has `loadout: []` today (no migration has ever populated
it), so the strict reading would silently disarm every player who has never opened the new
equip UI. Treating empty as "not customized yet" preserves current behavior for everyone
until they actively equip something.

## Tests

- `client/tests/weaponStrike.spec.ts` — new `"loadout gating"` describe (empty = 2/2
  eligible; non-empty = only equipped weapon eligible; omitted param defaults to
  unrestricted) + new `"hasOwnedOffensiveWeapons"` describe (2 cases).
- `server/weapons/service.spec.ts` — new `"loadout gate"` describe, 3 cases: empty loadout
  passes the gate (fails later on the bogus test parcel instead — isolates the gate from
  parcel plumbing, same style as the file's existing guard tests); non-empty loadout
  rejects an unequipped owned weapon (`/not equipped/i`); non-empty loadout passes an
  equipped weapon past the gate.
- `client/tests/hud-shell.spec.tsx` — import path updated for the `NavTab` relocation, no
  behavior change.

## Verified green (this session, local)

- `pnpm run check` (tsc) — clean
- `pnpm run test:server` — 449 passed, 24 skipped (was 446/24 before; +3 new)
- `pnpm run coverage:server` — 94.54% lines (gate is ≥80%)
- `pnpm run test` (client) — 303 passed (was 298 before; +5 new)
- `pnpm run build` — clean production build

Not independently re-verified in CI yet — that happens via the PR + `/handoff-audit` next
session, per protocol.

## Honest gaps / not done in this unit

- No headless visual/browser verification this unit — it's pure logic-gate + label/cost
  text, no new layout or interaction to screenshot. Flagged rather than assumed.
- This is 1 of 10 units in the weapons-system plan. Units 1-4, 6-10 (damage settlement,
  combat convergence, cooldown enforcement, defense-deploy UI, responsive layout, NFT
  claim, missile cinematics, animation tiers, UI test coverage) are **not started** —
  next session picks the next unit per the plan's sequencing note.
