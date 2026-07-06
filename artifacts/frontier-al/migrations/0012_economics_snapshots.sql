-- 0012_economics_snapshots.sql
-- Unit D3 (docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md): hourly samples of
-- the /api/economics computation, so the tokenomics page can chart a real
-- supply-flow history. No economics history existed anywhere before this —
-- /api/economics was snapshot-only and burns are cumulative per-player floats.
--
-- ADDITIVE ONLY. One new table, no economic behavior depends on it.
--   - the sampler (server/services/economicsSnapshotSampler.ts) is fire-and-
--     forget on the existing server tick, wrapped in try/catch — a missing
--     table or a failed sample can never affect gameplay or the live
--     /api/economics endpoint (which is untouched by this migration),
--   - GET /api/economics/history returns an empty list until rows accrue —
--     the chart states its real "data since" date rather than fabricating a
--     past for the period before this migration was applied,
--   - MemStorage needs no DDL.
-- Idempotent (IF NOT EXISTS) so it is safe to re-run and won't fight db:push.
--
-- STAGED MIGRATION — NOT executed at server boot.
--   psql "$DATABASE_URL" -f migrations/0012_economics_snapshots.sql
-- or: pnpm run db:push   (drizzle-kit push from server/db-schema.ts)

CREATE TABLE IF NOT EXISTS "economics_snapshots" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"captured_at" bigint NOT NULL,
	"total_supply" real NOT NULL,
	"in_game_circulating" real NOT NULL,
	"total_burned" real NOT NULL,
	"treasury" real NOT NULL,
	"protocol_treasury_total" real NOT NULL
);

CREATE INDEX IF NOT EXISTS "economics_snapshots_captured_idx" ON "economics_snapshots" ("captured_at");
