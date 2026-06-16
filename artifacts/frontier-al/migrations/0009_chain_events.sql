-- 0009_chain_events.sql
-- Durable audit trail for the on-chain purchase lifecycle + admin dashboard.
--
-- ADDITIVE ONLY. Two new tables, no changes to existing schema:
--
--   chain_events     — append-only log; one row per purchase-lifecycle transition
--                      (submitting → confirmed → inventory_syncing → complete,
--                      or failed/timeout/duplicate_detected). Powers the admin
--                      "recent events" feed and the chain-health cards.
--   purchase_intents — one row per purchase attempt, carrying its CURRENT state.
--                      Powers the purchase-funnel + transaction-status charts.
--
-- Both are written fire-and-forget from the existing purchase handler
-- (server/routes.ts POST /api/actions/purchase) via recordPurchaseTransition()
-- — pure instrumentation, never gates the purchase. Until applied, the recorder
-- no-ops (db-guarded), so deploying the build before this migration is safe.
--
-- STAGED MIGRATION — NOT executed at server boot.
--   psql "$DATABASE_URL" -f migrations/0009_chain_events.sql
-- or: pnpm run db:push   (drizzle-kit push from server/db-schema.ts)

CREATE TABLE "chain_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event" varchar(40) NOT NULL,
	"status" varchar(24) NOT NULL,
	"tx_id" text,
	"player_id" varchar(36),
	"item_type" varchar(20),
	"item_id" text,
	"network" varchar(12),
	"amount" bigint,
	"metadata_json" text,
	"created_at" bigint NOT NULL
);
CREATE INDEX "chain_events_created_idx" ON "chain_events" ("created_at");
CREATE INDEX "chain_events_status_idx" ON "chain_events" ("status");

CREATE TABLE "purchase_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"ref_id" text,
	"tx_id" text,
	"state" varchar(24) NOT NULL,
	"amount" bigint,
	"last_error" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
CREATE INDEX "purchase_intents_state_idx" ON "purchase_intents" ("state");
CREATE INDEX "purchase_intents_created_idx" ON "purchase_intents" ("created_at");
