-- Migration: 0015_action_nonce_fingerprint
-- Additive: enables same-key / different-payload conflict detection for the
-- plot-attack idempotency guard (Phase 4A). The guard already keys on
-- `${action}:${playerId}:${nonce}` (target folded into the key for build/
-- upgrade). For attacks we key ONLY on (player, attack, nonce) and store a
-- canonical payload fingerprint so a replay with DIFFERENT parameters can be
-- rejected with 409 instead of silently replaying the original battle.
--
-- STRICTLY ADDITIVE: new nullable column, no row rewrite, no destructive
-- change, no blockchain data touched.
--
-- Apply manually (do NOT use db:push):
--   psql "$DATABASE_URL" -f migrations/0015_action_nonce_fingerprint.sql
--
-- Rollback:
--   ALTER TABLE "action_nonces" DROP COLUMN IF EXISTS "payload_fingerprint";

ALTER TABLE "action_nonces"
  ADD COLUMN IF NOT EXISTS "payload_fingerprint" text;
