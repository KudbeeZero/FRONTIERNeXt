-- Migration: 0013_plot_mint_retry_queue
-- Persistent retry queue for Plot NFT mints that fail AFTER the buyer's ALGO
-- payment has already been claimed (redeemed_payments) and land ownership
-- committed. Without this table a failed mint left the buyer with land, no
-- NFT, no refund, and no automated recovery (M1-5).
--
-- Status lifecycle: pending -> delivered
--                            -> refund_needed (after MAX_ATTEMPTS mint failures)
--                                -> refunded | refund_failed (manual review)

CREATE TABLE IF NOT EXISTS "plot_mint_retry_queue" (
  "id"                    text          PRIMARY KEY,
  "plot_id"               integer       NOT NULL,
  "player_id"             text          NOT NULL,
  "buyer_address"         text          NOT NULL,
  "algo_payment_tx_id"    text,
  "amount_micro_algos"    bigint,
  "status"                varchar(20)   NOT NULL DEFAULT 'pending',
  "attempts"              integer       NOT NULL DEFAULT 0,
  "last_error"            text,
  "refund_tx_id"          text,
  "created_at"            bigint        NOT NULL,
  "updated_at"            bigint        NOT NULL
);

CREATE INDEX IF NOT EXISTS "plot_mint_retry_queue_status_idx"
  ON "plot_mint_retry_queue" ("status");

CREATE UNIQUE INDEX IF NOT EXISTS "plot_mint_retry_queue_plot_id_unique"
  ON "plot_mint_retry_queue" ("plot_id");
