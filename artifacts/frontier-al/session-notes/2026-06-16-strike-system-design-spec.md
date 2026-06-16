# Session note — 2026-06-16 — Strike System design spec (design-only)

**Branch:** `claude/strike-system-design-spec-jan40c`
**Type:** design doc only — **no game code / schema / config touched.**

## What shipped
- New doc: `artifacts/frontier-al/docs/design/strike-system-design.md` — a
  code-grounded rewrite of the proposed Strike System spec (server-authoritative,
  fail-closed strike lifecycle; weapon range/speed banding; the "AEGIS" arbiter;
  a Clerk admin/ops management layer; signed-off open decisions).

## Grounded against the real code (corrections to the draft's "NOT VERIFIED" claims)
- Geometry is **continuous lat/lng great-circle km**, not hex steps
  (`shared/weapons/ballistics.ts:103`, `scale.ts:22` planet radius 1,200 km).
- No P/T/B/S/H/O class — used the existing `WeaponSpec.category`/`tier`
  (`shared/weapons/types.ts:16-35,88-124`); `WeaponSpec` has no `description`.
- Parcel state is written by `server/storage/db.ts` `resolveBattles()` (`:1630`,
  atomic claim `:1693-1697`), **not** the pure reducer `resolve.ts`.
- Weapon damage confirmed **never reaches a parcel**: `fireWeapon()` resolves
  synchronously and only updates player stats ("no later server tick",
  `server/weapons/service.ts:196-197`).
- Upgrade wiring corrected: `radar` (`db.ts:1259-1270`), `data_centre` (`db.ts:1086`),
  `ai_lab` (`db.ts:676`) are **all wired** (draft said data_centre/ai_lab were not).
  No `interceptor` upgrade — point-defense is a deployable weapon (`service.ts:222`).
- Built the full **38-weapon** table from the four catalog files with real
  range/speed; ETA column derived via `timeOfFlightMs()` (`ballistics.ts:49`), all
  labeled PROPOSED.

## Decisions baked in (PROPOSED, sign-off pending)
- Clerk = admin/ops staff layer only (Organizations + roles replacing the static
  `ADMIN_KEY`); augments, not replaces, wallet auth. Player faction→org mapping is a
  future hook, out of scope.
- Scheduler = reuse the in-process `setInterval` resolve loop (no Kestra).
- Strikes = no-loot ASCEND sink. Offline-defender assist = IN (bounded). Dark-strike
  = very-late warning, not zero. AEGIS kept as working name (collision flag noted).

## Verification
- `check` (tsc) clean; `test:server` **244/244**; `test` (client) **55/55** — all
  identical to baseline (doc-only change broke nothing). Numbers in the doc are
  PROPOSED/untested by design.

## Honest flags
- Every gameplay number is PROPOSED — none balance-tested.
- "AEGIS" collides with the in-game `aegis` interception badge + `def_aegis` battery.
- Cruise-missile ETAs run ~2 hours at max range; doc recommends a tunable game-time
  factor rather than editing per-weapon speeds.

## PR / relay status
- Work committed + pushed to the branch. **PR HELD**: PR #52
  (`feat/admin-chain-agent-dashboard`) is open and AWAITING_AUDIT — the one-open-PR
  invariant blocks opening a second PR until #52 is audited/merged/closed.
