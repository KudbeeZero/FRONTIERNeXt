# 2026-07-13 — Battle integrity: preserve ownership on ordinary victory + Commander lock UI

## What changed
- **Ordinary battle victory no longer transfers legal ownership.**
  - `server/storage/db.ts` `resolveBattles()`: removed `parcels.ownerId`/`ownerType` mutation, `purchasePriceAlgo` reset, `lastAscendClaimTs` update, `capturedFromFaction`/`handoverCount` reconquest tracking, and sub-parcel ownership cascade.
  - `server/storage/mem.ts` `resolveBattles()`: removed `ownerId`/`ownerType` assignment, `purchasePriceAlgo`/`lastAscendClaimTs` reset, `ownedParcels` push, `territoriesCaptured` increment, and defender `ownedParcels` filter.
  - Defense damage, resource pillage, influence reduction, attacker/defender statistics, commander `totalKills`, cascade vulnerability, events, and battle snapshots are unchanged.
- **Event copy corrected.**
  - Server event descriptions changed from `"conquered plot #..."` to `"Military victory at plot #..."`.
  - `BattleWatchModal.tsx` changed from `"has captured the territory"` to `"defeated the defenses"`.
- **Reaper active-battle cap hardened.**
  - `server/storage/db.ts` `deployAttack()`: attacker row now selected `FOR UPDATE` inside the transaction, serializing concurrent deployAttack calls for the same attacker and closing the COUNT-query race.
- **CommanderPanel battlefront UI improved.**
  - Displays `Battles Active · N/M` count.
  - Shows Commander lock countdown when `lockedUntil` is active.
  - Disables launch button when `atMaxCapacity` or `targetEngaged`.
  - Warnings explain: maximum active battles reached, target already engaged.
  - Parent `GameLayout.tsx` passes `battles` prop to all three `CommanderPanel` instances.

## Tests added
- `server/storage/battle-concurrency.spec.ts`: ownership-preservation tests (ownerId unchanged, ownerType unchanged, defense/pillage apply, activeBattleId clears, event copy truthful).
- `server/storage/battle-cap.spec.ts` (new): Reaper cap tests (1/3, 2/3, 3/3 permitted; 4th rejected; resolution releases slot; target-engaged rejected; rapid duplicate no-op); Commander lock rejection test.

## Verification
- `pnpm run check` — clean.
- `pnpm run build` — clean.
- `pnpm run test:server` — **699 passed, 26 skipped** (includes new tests).
- `pnpm run test` — **403 passed** (client suite green).
- `git diff --check` — clean.

## Files changed
- `artifacts/frontier-al/server/storage/db.ts`
- `artifacts/frontier-al/server/storage/mem.ts`
- `artifacts/frontier-al/client/src/components/game/BattleWatchModal.tsx`
- `artifacts/frontier-al/client/src/components/game/CommanderPanel.tsx`
- `artifacts/frontier-al/client/src/components/game/GameLayout.tsx`
- `artifacts/frontier-al/server/storage/battle-concurrency.spec.ts`
- `artifacts/frontier-al/server/storage/battle-cap.spec.ts` (new)
- `docs/HANDOFF.md`

## Merge and deployment
- PR #257 squash-merged into `main` as commit `6ca9f15`.
- CI green: Typecheck & server tests SUCCESS, Cloudflare Pages SUCCESS.
- Deployment verified: `/health` 200, `/readiness` 200.
- `/api/game/state` and `/api/factions` respond successfully.
- No production errors detected in public endpoints.

## Owner gameplay gate (pending owner verification)
1. Reload FRONTIER after deployment.
2. Open Commander Battlefront.
3. Confirm `BATTLES ACTIVE · N/3` appears for Reaper.
4. Confirm the launch button greys out at maximum capacity.
5. Confirm a locked Commander shows a countdown.
6. Confirm a target already engaged cannot be launched against again.
7. After a normal battle victory:
   - the original legal owner still owns the parcel;
   - sub-parcel legal ownership remains unchanged;
   - land NFT ownership remains unchanged;
   - defense/resource/influence battle effects still occur;
   - battle history says victory, not legal capture.
