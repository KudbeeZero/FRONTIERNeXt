# First Playable Combat Loop — Proposed Scope (NOT YET APPROVED)

> Proposal only. No code has been written. Awaiting scope approval per the user's
> "READ-ONLY audit first" instruction.

## Goal

Make a single fired weapon **demonstrably change parcel state**, with a minimal UI to do
it and a test that proves it. Turn the weapon system from FX-only into the seed of a real
loop — without touching chain/admin/globe-render.

## The loop

1. Player selects an enemy parcel (existing globe pick).
2. Tactical panel shows target, equipped offensive weapon, range/cooldown/cost.
3. Player clicks **Fire** → `POST /api/weapons/fire` (existing route).
4. Server validates ownership + range + cooldown + ASCEND (existing) and launches an
   engagement (existing ballistics + interception).
5. **NEW (small):** when an engagement resolves to `impacted` (not intercepted), apply a
   bounded, deterministic effect to the target — e.g. reduce `defenseLevel` by a small
   amount or pillage a fixed fraction, clamped, logged.
6. Battle log + globe FX show the result (FX already exist; add a log entry).

## In scope

- One offensive weapon line wired end-to-end (recommend towed artillery).
- A `Fire` control in the parcel HUD / tactical panel (disabled-with-reason states).
- One server function that maps `impacted` → a tested parcel-state delta.
- A minimal `TacticalOverlay` stub bound to real selection/loadout data.
- Tests (see below).

## Explicitly NOT in scope (off-limits)

- Wallet / Algorand transaction flow / chain monitor / admin dashboard.
- NFT minting of weapons.
- The globe render core (use the projection seam only).
- PvP matchmaking; large balance retuning; renaming core concepts.
- Re-pointing anything at mainnet.

## Likely files to change (confirm before editing)

- `server/weapons/service.ts` / `server/weapons/engagementStore.ts` — apply impact effect.
- `server/engine/battle/*` — only if the effect reuses pillage/defense helpers.
- `client/src/components/game/globe/` — new `TacticalOverlay.tsx` + a Fire button in the
  parcel HUD.
- `shared/weapons/types.ts` — optional `description` field (+ populate the catalog).

## Tests to write (no fix without a test)

- Weapons load with id/name; **assert each weapon has a description** (after adding it) or
  is explicitly marked MISSING.
- Firing a weapon at a valid in-range enemy produces an engagement + (on impact) the
  expected, clamped parcel-state delta.
- Fire is rejected when: weapon locked, no target, out of range, on cooldown, insufficient
  ASCEND (extend `server/weapons/service.spec.ts`).
- Impact effect is deterministic given the same seed.
- `pnpm --filter @workspace/frontier-al check` + `test:server` + `test` stay green.

## Manual QA

- Run `dev:server` + `dev:client`; select enemy parcel; equip towed artillery; Fire;
  confirm FX + log + target defense change; confirm disabled states show reasons.
