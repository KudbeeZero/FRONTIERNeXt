-- 0011_battle_replays.sql
-- Phase 2: durable battle replay log (Postgres) so the cinematic replays survive
-- past the Redis 24h TTL.
--
-- ADDITIVE ONLY. One new table. Written fire-and-forget at battle resolution
-- (server/storage/db.ts resolveBattles → persistBattleReplay) ALONGSIDE the
-- existing Redis save, on a SEPARATE connection (never inside the resolution
-- transaction), and read as a FALLBACK by GET /api/battle/replay/:battleId when
-- Redis misses or has expired.
--
-- Safe to deploy the build before applying:
--   - the writer is fire-and-forget (.catch) on a non-transaction connection, so
--     a missing table can never abort battle resolution,
--   - the read fallback returns null (→ the existing 404) until the table exists,
--   - MemStorage keeps replays in memory and needs no DDL.
-- Idempotent (IF NOT EXISTS) so it is safe to re-run and won't fight db:push.
--
-- STAGED MIGRATION — NOT executed at server boot.
--   psql "$DATABASE_URL" -f migrations/0011_battle_replays.sql
-- or: pnpm run db:push   (drizzle-kit push from server/db-schema.ts)

CREATE TABLE IF NOT EXISTS "battle_replays" (
	"battle_id" varchar(36) PRIMARY KEY NOT NULL,
	"attacker_name" text NOT NULL,
	"defender_name" text NOT NULL,
	"attacker_power" real NOT NULL,
	"defender_power" real NOT NULL,
	"rand_factor" real NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"plot_id" integer NOT NULL,
	"biome" varchar(20) NOT NULL,
	"pillaged_iron" integer NOT NULL,
	"pillaged_fuel" integer NOT NULL,
	"pillaged_crystal" integer NOT NULL,
	"resolved_at" bigint NOT NULL,
	"log" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "battle_replays_resolved_idx" ON "battle_replays" ("resolved_at");
