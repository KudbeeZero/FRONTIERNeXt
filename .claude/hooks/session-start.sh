#!/usr/bin/env bash
#
# SessionStart hook — print the Session Relay baton at the start of every session
# and nudge an audit if a PR is AWAITING_AUDIT.
# Part of the Session Relay Protocol (docs/SESSION_PROTOCOL.md).
#
set -euo pipefail

# Resolve the repo root: prefer Claude's project dir, fall back to git, then cwd.
ROOT="${CLAUDE_PROJECT_DIR:-}"
if [ -z "${ROOT}" ]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [ -z "${ROOT}" ]; then
  ROOT="$(pwd)"
fi

BATON="${ROOT}/docs/HANDOFF.md"

# Graceful fallback: no baton yet → say so and exit cleanly (never block startup).
if [ ! -f "${BATON}" ]; then
  echo "ℹ️  Session Relay: no baton found (docs/HANDOFF.md). Run /closeout at the"
  echo "    end of this chat to create one. See docs/SESSION_PROTOCOL.md."
  exit 0
fi

echo "── Session Relay baton (docs/HANDOFF.md) ──────────────────────────────"
cat "${BATON}"
echo "───────────────────────────────────────────────────────────────────────"

# Nudge an audit if a PR is awaiting one. Use 'if grep -q' so a NO-match does not
# trip 'set -e' and abort the hook mid-run.
if grep -q "AWAITING_AUDIT" "${BATON}" 2>/dev/null; then
  echo "⚠️  A PR is AWAITING_AUDIT — run /handoff-audit to review and gate it"
  echo "    before starting new work (Session Relay Protocol: nothing lands unreviewed)."
fi

# Always succeed — a SessionStart hook must never block the session.
exit 0
