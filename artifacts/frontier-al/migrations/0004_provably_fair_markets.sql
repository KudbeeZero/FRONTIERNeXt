-- Migration: 0004_provably_fair_markets
-- Provably-fair prediction markets: outcomes are DERIVED from deterministic public
-- facts, never chosen by an admin. Adds the immutable resolution source declared at
-- creation plus the verifiable proof recorded at resolution.
--   resolution_source     — immutable {type,...} declared at creation (the "judge")
--   resolution_cutoff_ts  — staking lock (closes before the resolving fact is knowable)
--   resolved_inputs       — exact public facts read by the automated resolver
--   resolution_hash       — sha256(source+inputs+outcome); anyone can recompute it
-- All columns are nullable so pre-existing markets remain valid.

ALTER TABLE "prediction_markets"
  ADD COLUMN IF NOT EXISTS "resolution_source"    jsonb,
  ADD COLUMN IF NOT EXISTS "resolution_cutoff_ts" bigint,
  ADD COLUMN IF NOT EXISTS "resolved_inputs"      jsonb,
  ADD COLUMN IF NOT EXISTS "resolution_hash"      varchar(64);
