-- Migration: 0014_db_indexes_purchase_funnel
-- DB indexes for purchase funnel queries and rate-limited write surfaces (M1-6).
--
-- Addresses real query performance gaps:
-- - players.address: getOrCreatePlayerByAddress uses WHERE lower(address) = ?
--   with no index (full table scan on every wallet connect).
-- - players.is_ai: heavy filter in AI engine + human player lists.
-- - players.player_faction_id: filtered in faction paths.
-- - trade_orders: zero secondary indexes despite filtering by status/offerer/created_at.
--
-- Also adds pagination safety to queryPurchaseIntents (was unbounded SELECT *).
-- Staged migration — apply manually: psql "$DATABASE_URL" -f migrations/0014_db_indexes_purchase_funnel.sql

-- players: functional index for case-insensitive wallet address lookup
CREATE INDEX IF NOT EXISTS "idx_players_lower_address"
  ON "players" (lower("address"));

-- players: boolean filter for AI vs human player lists
CREATE INDEX IF NOT EXISTS "idx_players_is_ai"
  ON "players" ("is_ai");

-- players: faction membership queries
CREATE INDEX IF NOT EXISTS "idx_players_player_faction_id"
  ON "players" ("player_faction_id");

-- trade_orders: status filter (open/filled/cancelled)
CREATE INDEX IF NOT EXISTS "idx_trade_orders_status"
  ON "trade_orders" ("status");

-- trade_orders: offerer lookup (my trades)
CREATE INDEX IF NOT EXISTS "idx_trade_orders_offerer_id"
  ON "trade_orders" ("offerer_id");

-- trade_orders: chronological ordering
CREATE INDEX IF NOT EXISTS "idx_trade_orders_created_at"
  ON "trade_orders" ("created_at");
