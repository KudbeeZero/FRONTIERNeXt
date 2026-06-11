#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (remote environments).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install all workspace dependencies (idempotent; pnpm reuses its store cache).
pnpm install

# Build shared lib type declarations so cross-package typechecks and tests work.
pnpm run typecheck:libs
