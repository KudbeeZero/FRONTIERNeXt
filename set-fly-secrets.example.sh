#!/usr/bin/env bash
#
# set-fly-secrets.example.sh — template for setting the FRONTIER backend's
# Fly.io secrets. This committed file contains NO real values.
#
# HOW TO USE (run where you have flyctl authenticated — the same shell you ran
# `flyctl deploy` from):
#
#   cp set-fly-secrets.example.sh set-fly-secrets.sh   # the copy is gitignored
#   # edit set-fly-secrets.sh and fill in the three REPLACE_* values, then:
#   bash set-fly-secrets.sh
#
# Fly stores these encrypted and injects them as env vars at runtime — they must
# never live in git or in the Docker image. SESSION_SECRET and ADMIN_KEY are
# generated fresh below so you don't have to.
#
set -euo pipefail

APP="frontiernext"

# ─── Fill these three in (your private values) ─────────────────────────────────
DATABASE_URL="REPLACE_WITH_YOUR_NEON_POSTGRES_URL"            # postgres://…?sslmode=require
ALGORAND_ADMIN_MNEMONIC="REPLACE_WITH_YOUR_25_WORD_MNEMONIC"  # controls the treasury — keep private
ALGORAND_ADMIN_ADDRESS="REPLACE_WITH_YOUR_ADMIN_ADDRESS"      # must match the mnemonic

# ─── Known values for this deployment (leave as-is) ────────────────────────────
PUBLIC_BASE_URL="https://api.frontierprotocol.app"
CLIENT_ORIGIN="https://frontierprotocol.app"

# ─── Auto-generated strong random secrets ──────────────────────────────────────
SESSION_SECRET="$(openssl rand -hex 32)"
ADMIN_KEY="$(openssl rand -hex 32)"

# ─── Safety: refuse to run with placeholders still in place ────────────────────
if [[ "$DATABASE_URL" == REPLACE_* || "$ALGORAND_ADMIN_MNEMONIC" == REPLACE_* || "$ALGORAND_ADMIN_ADDRESS" == REPLACE_* ]]; then
  echo "ERROR: fill in the three REPLACE_* values first (edit set-fly-secrets.sh)." >&2
  exit 1
fi

fly secrets set -a "$APP" \
  DATABASE_URL="$DATABASE_URL" \
  SESSION_SECRET="$SESSION_SECRET" \
  PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \
  ALGORAND_ADMIN_MNEMONIC="$ALGORAND_ADMIN_MNEMONIC" \
  ALGORAND_ADMIN_ADDRESS="$ALGORAND_ADMIN_ADDRESS" \
  ADMIN_KEY="$ADMIN_KEY" \
  CLIENT_ORIGIN="$CLIENT_ORIGIN"

echo "✓ Secrets set on '$APP'. Next: fly deploy -a $APP"
