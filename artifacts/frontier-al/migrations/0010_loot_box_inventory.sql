-- 0010_loot_box_inventory.sql
-- Phase 2: loot box inventory + rare-mineral vault columns.
--
-- ADDITIVE ONLY. Backfills the table + columns that already exist in
-- server/db-schema.ts (lootBoxInventory + players.*_vault) but were never given
-- a numbered migration (migrations stopped at 0009).
--
--   loot_box_inventory  — one row per loot box awarded to a player; opened_at is
--                         NULL while sealed, set when opened. Powers the award
--                         (mine_action trigger) + open flow.
--   players.*_vault     — the four rare-mineral vault totals credited on open.
--
-- Safe to deploy the build before applying:
--   - MemStorage (dev/tests) keeps boxes in memory and needs no DDL,
--   - DbStorage reads/writes only after initialize().
-- Idempotent (IF NOT EXISTS) so it is safe to re-run and won't fight db:push.
--
-- STAGED MIGRATION — NOT executed at server boot.
--   psql "$DATABASE_URL" -f migrations/0010_loot_box_inventory.sql
-- or: pnpm run db:push   (drizzle-kit push from server/db-schema.ts)

CREATE TABLE IF NOT EXISTS "loot_box_inventory" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"tier" varchar(10) NOT NULL,
	"awarded_at" bigint NOT NULL,
	"opened_at" bigint
);

CREATE INDEX IF NOT EXISTS "loot_box_player_idx" ON "loot_box_inventory" ("player_id");
CREATE INDEX IF NOT EXISTS "loot_box_unopened_idx" ON "loot_box_inventory" ("player_id","opened_at");

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "xenorite_vault" integer DEFAULT 0 NOT NULL;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "void_shard_vault" integer DEFAULT 0 NOT NULL;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "plasma_core_vault" integer DEFAULT 0 NOT NULL;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "dark_matter_vault" integer DEFAULT 0 NOT NULL;
