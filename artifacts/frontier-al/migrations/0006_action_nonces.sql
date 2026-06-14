-- 0006_action_nonces.sql
-- Idempotency / double-submit protection for mutating game actions.
--
-- A client supplies an opaque idempotency nonce per action. The key
-- `${action}:${playerId}:${nonce}` is claimed exactly once: the PRIMARY KEY is
-- the atomic guard — the first INSERT ... ON CONFLICT DO NOTHING wins; every
-- subsequent attempt with the same key inserts zero rows and the action is
-- rejected with 409 (already_processed). Scoped by playerId so one player can
-- never block or replay another player's action.
--
-- STAGED MIGRATION — NOT executed at server boot.
-- Runbook: apply before deploying any build that enforces the action
-- idempotency guard (currently /api/actions/claim-frontier).
--   psql "$DATABASE_URL" -f migrations/0006_action_nonces.sql
-- or: pnpm run db:push   (drizzle-kit push from server/db-schema.ts)

CREATE TABLE "action_nonces" (
	"key" text PRIMARY KEY NOT NULL,
	"player_id" varchar(36) NOT NULL,
	"action" varchar(40) NOT NULL,
	"created_at" bigint NOT NULL
);
