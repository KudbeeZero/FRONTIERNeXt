# 2026-06-18 — Loot Box Open Flow + Mining Award

**Branch:** `claude/game-feature-scan-bnk4ie` → PR into `main`
**Unit:** Finish the Phase-2 loot box / rare-mineral economy (open flow + one award trigger).

## What shipped (test-backed)

The schema, DB table, weighted drop tables, trigger config, and inventory display
already existed but were **inert** — nothing awarded a box, opened one, or showed an
Open button. This unit makes it real end-to-end:

- **Pure roll module** `server/engine/lootbox/open.ts` — `resolveLootBoxOpen(tier, seed)`
  (deterministic weighted pick; total weight derived, not hardcoded) and
  `rollLootBoxAward(trigger, seed)`. Reuses the battle engine's `mulberry32` / `hashSeed`.
  Seeding: open = `hashSeed(lootBoxId, playerId)` (stable per box → idempotent replay
  reproduces the reward); mine award = `hashSeed(playerId, parcelId, now, "lootbox")`.
- **Storage** (`interface.ts` + `db.ts` + `mem.ts`): `awardLootBox` (enforces
  `LOOT_BOX_INVENTORY_CAP` on unopened) and `openLootBox` (double-open safe via a
  conditional `UPDATE ... WHERE opened_at IS NULL` rowCount check; credits the vault
  with `LEAST(..., RARE_MINERAL_VAULT_CAP)`; player-scoped lookup = ownership at the
  data layer). Fixed the **hydration bug**: `game-rules.ts` hard-coded `lootBoxes: []`,
  so the client never saw boxes — now hydrated in `getPlayer` /
  `getOrCreatePlayerByAddress` via `rowToLootBox`.
- **Mining award trigger** wired in `mineResources()` (both backends): 3% → common,
  in-tx via a shared `_awardLootBoxTx` helper (db) to avoid a nested transaction.
- **Route** `POST /api/actions/open-loot-box` — mirrors the `/api/actions/upgrade`
  idempotent-mutation template; path matches `MUTATION_PATH_RE` so the global ownership
  middleware verifies `playerId`. Idempotency keyed on `lootBoxId` (replay-safe). Maps
  `not_found`→404, `already_opened`→409.
- **Migration** `migrations/0010_loot_box_inventory.sql` — additive, `IF NOT EXISTS`.
  Backfills the `loot_box_inventory` table + 4 `*_vault` columns that lived in
  `db-schema.ts` but had **no numbered migration** (migrations had stopped at 0009).
- **Client**: `useOpenLootBox()` hook + InventoryPanel per-box **Open** button (disabled
  while opening); reward revealed via toast (`+N <Mineral>`). Wired through `GameLayout`.

## Verification (all green)
- `check` (tsc) ✓ · root `typecheck` ✓
- `test:server` → **279 pass** (+13: 7 `engine/lootbox/open.spec.ts`, 6
  `storage/lootbox.storage.spec.ts`)
- `test` (client) → **57 pass** (added `useOpenLootBox` to the two GameLayout SSR mocks)
- `build` ✓

## Honest flags / scope
- **Only the `mine_action` trigger is wired.** `battle_victory` (25%) and
  `orbital_impact` (50%) triggers are **deferred** — they touch the gated combat/orbital
  paths and should be a separate audited unit. Their config (`LOOT_BOX_TRIGGERS` /
  `LOOT_BOX_DROP_CHANCE`) already exists; only the call sites are absent.
- `getSlimGameState` / `getGameState` intentionally do **not** hydrate loot boxes (perf;
  `stateScope.ts:46` already redacts unopened boxes for non-owners). Boxes hydrate only
  on the owner-scoped `getPlayer`.
- Reward reveal is a toast (idiomatic, matches mine/build UX), not an animated card.
- No funds/ASA/chain/combat/canvas code touched. No new env vars. Migration is staged
  (not run at boot) — apply `0010` before relying on the DB-backed path in prod.
- Baton was stale (referenced main @ `ca240d9` / #52-#53); actual base is `main` @
  `9e53108` (#59). Branched off the correct latest `main`.
