-- 0005_redeemed_payments.sql
-- Replay protection for ALGO payment transactions.
--
-- A payment txid may be redeemed for exactly one purchase (plot purchase or
-- commander mint). The PRIMARY KEY on tx_id is the atomic guard: the first
-- INSERT ... ON CONFLICT DO NOTHING wins; every subsequent attempt with the
-- same txid inserts zero rows and the purchase is rejected with 409.
--
-- STAGED MIGRATION — authored by the night shift, NOT executed.
-- Morning runbook: apply before deploying any build containing the
-- payment-replay guard (server boot does not create tables).
--   psql "$DATABASE_URL" -f migrations/0005_redeemed_payments.sql
-- or: pnpm run db:push   (drizzle-kit push from server/db-schema.ts)

CREATE TABLE "redeemed_payments" (
	"tx_id" text PRIMARY KEY NOT NULL,
	"purpose" varchar(20) NOT NULL,
	"ref_id" text,
	"player_id" varchar(36),
	"redeemed_at" bigint NOT NULL
);
