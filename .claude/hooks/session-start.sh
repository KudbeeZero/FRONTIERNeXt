#!/bin/bash
# Claude Code on the web — SessionStart hook
#
# Fresh remote containers reclone the repo with NO installed dependencies, so
# `pnpm run check` / `test:server` / `build` fail with TS2688 ("Cannot find type
# definition file for 'node' / 'vite/client'") until deps are hydrated. This hook
# installs the pnpm workspace once at session start so tooling works immediately.
#
# Synchronous (no async JSON emitted): the session waits ~10s for install to
# finish, which guarantees deps exist before the agent runs any command. Switch
# to async mode if faster startup is preferred (see docs/DEV_ENVIRONMENT.md).
set -euo pipefail

# Only run in Claude Code on the web. Local/Replit dev manages its own deps and
# should not pay this cost on every session.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Use the pnpm already on PATH (the standard image ships 10.33.0, matching CI).
# Only fall back to corepack if pnpm is somehow absent — corepack would otherwise
# pull a newer pnpm than CI uses, introducing avoidable version drift.
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable pnpm 2>/dev/null || true
  # Fail loudly here rather than letting `pnpm install` below die with an opaque
  # "pnpm: command not found". `|| true` above neutralizes `set -e`, so check
  # explicitly that corepack actually produced a usable pnpm.
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "[session-start] ERROR: pnpm is not on PATH and corepack could not provide it." >&2
    exit 1
  fi
fi

# Root install hydrates every workspace package (artifacts/*, lib/*, scripts).
# --frozen-lockfile matches CI (.github/workflows/ci.yml) and scripts/post-merge.sh
# for reproducible installs; --prefer-offline reuses the pnpm store cache across
# sessions. Idempotent. Respects the minimumReleaseAge supply-chain guard.
#
# NOTE: this intentionally does NOT set DATABASE_URL / SESSION_SECRET / the
# ALGORAND_* secrets. The lint/test/build paths (`check`, `test:server`, `build`)
# are pure logic/type/bundling and need no DB or chain config; only `pnpm dev`
# and `db:push` do, and those are run deliberately, not at session start. Keeping
# secrets out of the hook avoids baking placeholder credentials into the env.
echo "[session-start] installing pnpm workspace dependencies…"
# Bounded retry so a transient network/registry hiccup doesn't kill session start.
for attempt in 1 2 3; do
  if pnpm install --frozen-lockfile --prefer-offline; then
    echo "[session-start] dependencies ready."
    exit 0
  fi
  echo "[session-start] install attempt ${attempt} failed; retrying…" >&2
  sleep $((attempt * 2))
done

echo "[session-start] ERROR: pnpm install failed after 3 attempts." >&2
exit 1
