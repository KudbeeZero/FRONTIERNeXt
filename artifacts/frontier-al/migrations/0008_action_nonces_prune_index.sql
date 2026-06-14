-- 0008_action_nonces_prune_index.sql
-- ID-004: TTL prune for action_nonces. The two-phase guard (0007) now also stores
-- response_json on every completed action, so the table grows with traffic and must
-- be reaped. The server prunes periodically with `DELETE FROM action_nonces WHERE
-- created_at < <cutoff>` (created_at reaps both completed rows AND crash-orphaned
-- in-flight rows). This index makes that range delete cheap.
--
-- STAGED MIGRATION — NOT executed at server boot.
-- Runbook: apply before/with deploying the prune build (after 0006/0007).
--   psql "$DATABASE_URL" -f migrations/0008_action_nonces_prune_index.sql
-- or: pnpm run db:push   (drizzle-kit push from server/db-schema.ts)
--
-- Idempotent: safe to run more than once.

CREATE INDEX IF NOT EXISTS "action_nonces_created_idx" ON "action_nonces" ("created_at");
