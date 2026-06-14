-- 0007_action_nonce_response.sql
-- Two-phase idempotency: persist the original success response so a duplicate of
-- the same nonce REPLAYS it (200) instead of erroring (409).
--
-- The first request claims the key (response_json NULL → in-flight), runs the
-- mutation, then writes its success body into response_json. A later duplicate of
-- the same nonce returns that stored body verbatim (200). A duplicate seen while
-- the first is still in-flight (response_json NULL) is rejected with 409 and may
-- retry. A failed first attempt deletes its row so a genuine retry can proceed.
--
-- STAGED MIGRATION — NOT executed at server boot.
-- Runbook: apply before deploying the stable-idempotency build (after 0006).
--   psql "$DATABASE_URL" -f migrations/0007_action_nonce_response.sql
-- or: pnpm run db:push   (drizzle-kit push from server/db-schema.ts)
--
-- Existing rows keep response_json = NULL (treated as in-flight); no backfill is
-- needed — they are old, completed actions whose nonces will not be re-submitted.

ALTER TABLE "action_nonces" ADD COLUMN "response_json" text;
ALTER TABLE "action_nonces" ADD COLUMN "completed_at" bigint;
