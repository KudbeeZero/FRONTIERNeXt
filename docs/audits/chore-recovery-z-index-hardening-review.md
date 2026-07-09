# Audit: chore/recovery-z-index-hardening-review

**Date:** 2026-07-09
**Source branch:** `origin/fix/z-index-hardening`
**Target:** `main` (64c22a8, PR #233)
**Recovery lane:** smallest safe PR

## Verdict

APPROVE for owner review (no merge without owner approval). The change is
pure CSS/z-index layering hardening on the client UI. No protected paths, no
behavioral change to game/globe/combat, no funds/ASA/on-chain/wallet/mainnet
code touched.

## Files included

- `artifacts/frontier-al/client/src/lib/uiLayers.ts` — added z-index utility
  classes (`globe`, `parcels`, `hud`, `panels`, `sidebar`, `toast`).
- `artifacts/frontier-al/client/src/components/game/CommTerminal.tsx` —
  switched hardcoded `z-40` to `ZClass.toast` (z-[60]).
- `artifacts/frontier-al/client/src/components/game/hud/hud.css` — bumped
  `.hud-drawer-track` / `.hud-drawer` from `z-index: 49` to `55`.

## Files excluded

- `docs/HANDOFF.md` — stale baton edit from the parked branch. Excluded on
  purpose (recovery lane must not carry stale baton state into `main`).

## Why HANDOFF.md was excluded

The parked branch's HANDOFF.md edit reflects a stale relay state that does not
match current `main`. Carrying it would clobber the authoritative baton. It is
out of scope for a source-only hardening recovery.

## Protected path check

None of the changed files are in protected paths:
- Not in `server/security.ts`, `server/auth.ts`, `server/rateLimitStore.ts`,
  `server/idempotencyGuard.ts`, `server/routeOwnership.ts`, `server/stateScope.ts`.
- Not in `server/services/chain/**` (Algorand / funds / ASA / wallet / on-chain).
- No auth, economy, transfer, purchase, claim, or mainnet code modified.

## Game/globe/combat impact

None. Changes are client-only visual layering (z-index). No globe, combat,
canvas, or game-logic behavior altered. `VITE_TEST_GLOBE` untouched.

## Funds/ASA/on-chain impact

None. No chain, wallet, ASA, or transfer code touched.

## Tests run

Not run in this free-agent pass. Install (`pnpm install --frozen-lockfile`) was
not executed; typecheck/test would require dependency install in this ephemeral
container. See "NOT verified".

## NOT verified

- `pnpm install --frozen-lockfile` not run (free-agent limit / container constraints).
- `pnpm --filter @workspace/frontier-al run check` not run.
- `pnpm --filter @workspace/frontier-al run test` not run.
- CI status on the resulting PR not yet confirmed.
- The parked `origin/session/agent_88081...` (auth/econ config cleanup) branch
  was NOT touched and remains parked.

## Owner action

Review the PR. Confirm only the 3 UI source files landed and HANDOFF.md did not.
If CI is green and acceptable, merge. Do NOT start TS7 from this lane.
