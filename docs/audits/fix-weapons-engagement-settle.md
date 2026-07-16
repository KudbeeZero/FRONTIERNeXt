# Audit — fix/weapons-engagement-settle

## Verdict
**PASS** — additive, self-contained bug fix; no gameplay-math, persisted-data, funds, ASA, or auth changes. Local tests green (tsc exit 0, server 708 pass, client 9 pass). One pre-existing, unrelated `precheck`-generator typecheck break on `main` is documented below and is NOT introduced by this diff.

## PR / branch / commit
- **Branch:** `fix/weapons-engagement-settle` (off clean `origin/main`)
- **Origin of change:** salvaged from stranded session branch `session/agent_169829a4-42fc-4032-9f0e-29a1caf33f5f`, which had committed but never opened a PR.
- **Scope shipped here:** the SAFE slice only — the additive `EngagementStore.settle()` method + `active()` status-handling cleanup + 2 tests.
- **Deliberately NOT shipped** (flagged, see Scope + Security): the firepower damage modifier and the `loadout` spec-id→instance-id data-model change from that branch.

## Claims vs. evidence
- ✅ **C-1: `settle()` transitions an in-flight engagement to `impacted` past `impactTs`, returning its damage payload.**
  `engagementStore.ts` — new `settle(engagementId, now)` method: returns `null` unless `status === "in_flight"` and `now >= e.impactTs`; otherwise sets `e.status = "impacted"` and returns `{ engagement, damage }`. Idempotent (a second call returns `null` because status is no longer `in_flight`).
- ✅ **`active()` cleanup — `impacted` engagements remain visible within the fade window.**
  `engagementStore.ts` `active()` — `intercepted` uses `interceptTs ?? impactTs`; `in_flight` and `impacted` both use `impactTs`. Behavior-equivalent to prior code for `in_flight`/`intercepted`; now also correctly retains `impacted` (previously `impacted` was unreachable via `settle`, so this is purely additive).
- ✅ **Tests added and passing.**
  `engagementStore.spec.ts` — 2 new tests: (1) no-op before `impactTs`, transition + damage at/after `impactTs`; (2) refuses to re-settle an already-impacted engagement. Both self-contained (only touch `store.settle`/`store.get`, no service/loadout/firepower deps).

## Tests
Run from `artifacts/frontier-al` (hooks bypassed to avoid the pre-existing generator break — see below):
- `npx tsc` → **exit 0** (typecheck clean with committed `generated.ts`).
- `npx vitest run --config vitest.server.config.ts server/weapons/` → **3 files, 28 passed** (incl. the 2 new).
- `npx vitest run --config vitest.server.config.ts` (full server) → **73 passed | 8 skipped; 708 tests passed | 26 skipped** (main is 706; +2 = new tests).
- `npx vitest run --config vitest.config.ts` (client) → **1 file, 9 passed**.

### Pre-existing, unrelated break (NOT introduced here)
`pnpm run check` fails via its `precheck` hook, which runs `scripts/generate-mission-control-data.mjs` and regenerates `client/src/components/mission-control/generated.ts` with `null` where `missionControlData.ts` expects `number` (`TS2322` at lines 184, 202). **Reproduced identically on clean `origin/main`** (git-stashed this diff, checked out `main`, same error). It is an environment/generator issue independent of this change. This diff reverts the byproduct `generated.ts` regen and does not touch mission-control code. Flagged in the baton for a separate fix.

## Scope creep
None in the shipped diff. Files changed: `server/weapons/engagementStore.ts`, `server/weapons/engagementStore.spec.ts` only.

**Explicitly dropped from the source branch (risky, out of scope):**
1. **`loadout` data-model change** (`service.ts` + `shared/weapons/profile.ts`): flips `loadout` from storing `specId` to storing `OwnedWeapon.id`. `loadout` is persisted (`db-schema.ts:217`); existing players' stored loadouts (spec ids) would silently fail the new instance-id lookup and un-equip their weapons. No migration/back-compat. **Needs owner decision + migration.**
2. **Firepower damage modifier** (`service.ts`): new `firepower * 0.1` (10%/point) multiplier on `upgradeTier`. This is a **combat-balance change**, not a bug fix — barred by the ship scope guard without an owner-approved gameplay unit.
3. **Settlement-flow rewrite** of the kill-crediting path in `fireWeapon` — coupled to (1)/(2); deferred with them.

## Untested assertions
- The `settle()` method is unit-tested but **not wired into any live route/interval** in this diff (the source branch's wiring lived in the dropped `service.ts` changes). So `settle()` is currently **dead code with test coverage** — safe and correct, but not yet exercised in production flow. Labeled as such; no over-claim of runtime effect.

## Security
- No funds, ASA, on-chain (`server/services/chain/` untouched), auth, secrets, or input-validation changes. Not a HARD-RULES-lane unit; self-audit is sufficient.

## What I could NOT verify
- CI on GitHub for the head commit (will confirm via `gh pr checks` after push; if unavailable, relying on local green per ship-skill fallback).
- Live runtime behavior of `settle()` — it is not yet called by any route (see Untested).
