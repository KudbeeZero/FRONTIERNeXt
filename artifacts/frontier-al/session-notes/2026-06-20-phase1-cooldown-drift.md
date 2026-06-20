# 2026-06-20 — Phase 1 (battle clock) PR2: cooldown-badge drift fix

## Unit
Continues #71 (server clock). The morale + attack-cooldown HUD badges in `GameLayout.tsx`
compared the **server** timestamps `player.moraleDebuffUntil` / `player.attackCooldownUntil`
against the **client** `Date.now()` — so a skewed device clock showed wrong (or missing)
cooldown timers. Point them at `serverNow()` from the existing `serverClock` (shipped in #71).

## What shipped (1 file)
- `client/src/components/game/GameLayout.tsx` — the morale badge gate + countdown (`:888`,`:903`)
  and the attack-cooldown badge gate + countdown (`:913`,`:928`) now use `serverNow()` instead of
  `Date.now()`. Added the `serverClock` import.

## Scope / safety
HUD-display correctness only — same drift class as #71, reuses its util. No new infra, no
combat-resolution / globe-canvas / schema / funds / deps change.

## Verification
`check` ✓ · client `test` **76 pass** (unchanged) · (server untouched).

## Follow-ups (still Phase 1)
- **CommanderPanel drift** (next slice): `cmd.lockedUntil`/`attackCooldownUntil`/satellite
  `expiresAt` comparisons (`CommanderPanel.tsx:221,553,569,570` + drone/satellite "elapsed since"
  spots) — its own focused PR to avoid partial edits in a 1k-line component.
- Env-configurable background cadences; optional `battle_tick`.
