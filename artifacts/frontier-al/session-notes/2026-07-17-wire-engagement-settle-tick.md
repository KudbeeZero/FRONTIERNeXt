# 2026-07-17 — Wire EngagementStore.settleExpired() into live tick (M2-1)

## Context
Memory-layer review of the previous agent's work identified the explicit next
unit from the baton: wire `EngagementStore.settle()` (added in PR #277) into
the weapons fire/impact flow so it is no longer dead code.

## What changed
- `server/weapons/engagementStore.ts` — added `settleExpired(now?)`:
  iterates all `in_flight` engagements past their `impactTs`, settles each
  (marks `impacted`, returns `{ engagement, damage }`), and returns the array.
  Intercepted and already-impacted engagements are left untouched.
- `server/routes.ts` — added a 5-second background tick next to the existing
  `prune()` interval. The tick calls `engagementStore.settleExpired()` and
  broadcasts a `weapon_impact` event for each settled engagement, then calls
  `markDirty()` if any impacts occurred.
- `server/weapons/engagementStore.spec.ts` — added 3 unit tests:
  - `settleExpired()` settles all due in-flight engagements and leaves others alone
  - `settleExpired()` ignores intercepted and already-impacted engagements
  - `settleExpired()` returns an empty array when nothing is due

## Verification
- `pnpm run check` → **exit 0**
- `pnpm run test:server` → **711 passed** | 26 skipped (main was 708; +3 new)
- `pnpm run build` → **green**
- No migrations, no funds/ASA/chain/mainnet, no battle-resolver changes.

## Gaps found during review
- Git remote URL in this session's clone still contains an embedded
  `x-access-token` (the `generated.ts` output was sanitized in PR #278, but
  the local git remote itself was not). Owner must rotate that token in GitHub;
  git history was intentionally not rewritten.

## Next unit
M2-2 (`feat/combat-convergence`): settled damage feeds plot state; badges/stats
credit on impact only. Depends on M2-1 landing first.
