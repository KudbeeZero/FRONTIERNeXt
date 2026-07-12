-- Migration: 0016_battles_battle_snapshot
-- Additive: persists the immutable BattleSnapshot built at plot-attack
-- launch (Phase B). The snapshot is a JSONB document containing the
-- server-authoritative CombatProfile + launch metadata that can be used
-- to reconstruct the exact legacy EngineBattleInput for replay. The
-- current live resolver continues to read the durable legacy battle
-- fields (attackerPower, defenderPower, etc.); the snapshot is for
-- evidence, replay, and future snapshot-backed resolution.
--
-- STRICTLY ADDITIVE: new nullable column, no row rewrite, no destructive
-- change, no blockchain data touched.
--
-- Apply manually (do NOT use db:push):
--   psql "$DATABASE_URL" -f migrations/0016_battles_battle_snapshot.sql
--
-- Rollback:
--   ALTER TABLE "battles" DROP COLUMN IF EXISTS "battle_snapshot";
--
-- Phase B behavior:
--   - Pre-Phase-B battles: battle_snapshot = NULL; legacy resolution
--     continues unchanged; replay utilities report "snapshot unavailable".
--   - Post-Phase-B human + AI plot attacks: battle_snapshot is a
--     JSONB document containing the content-addressed BattleSnapshot.

ALTER TABLE "battles"
  ADD COLUMN IF NOT EXISTS "battle_snapshot" jsonb;
