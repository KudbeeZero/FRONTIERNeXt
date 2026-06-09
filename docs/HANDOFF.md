# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `session-relay-protocol`
- **PR:** #<PENDING — set by /closeout once the PR is opened>
- **Audit status:** `AWAITING_AUDIT`

## What this chat did (for the auditor)
Bootstrapped the Session Relay Protocol. Added (all new, repo root):
- `docs/SESSION_PROTOCOL.md`, `docs/HANDOFF.md` (this baton), `docs/audits/README.md`
- `.claude/skills/handoff-audit/SKILL.md`, `.claude/skills/closeout/SKILL.md`
- `.claude/hooks/session-start.sh`, `.claude/settings.json`
- root `CLAUDE.md` (chat-loop standing instructions; defers to
  `artifacts/frontier-al/CLAUDE.md` for app rules)

`.github/workflows/ci.yml` already existed and already satisfies the CI
requirement (typecheck + full vitest suite on push + PR) — **preserved intact,
not modified.** No application code changed. Docs/skills/hooks only.

## NEXT chat
- **Proposed branch:** `fix/wallet-sign-auth`
- **Scope (one line):** fix the wallet sign step so `/api/auth/verify` is reached
  (nonce succeeds 3× but verify is never called — the sign never returns a
  usable signature), which currently blocks ALL gameplay (purchase + mining).
- **Open risks (read these):**
  - ⚠️ **~22 uncommitted changes** (atomic-purchase Steps 1-4 + held admin/globe/
    foundation work) live ONLY in the dev container's working tree. They are
    preserved on safety branch **`wip/atomic-purchase`** (pushed, NOT merged, NOT
    in any PR). They are *not* reviewed and must NOT be merged as-is — they await
    the planned 3-branch reorg.
  - ⚠️ **3 confirmed HIGH findings** in the Step-4 atomic-purchase code (still
    unfixed): false "funds not taken" 402 on slow confirmation; recovery bounded
    by the ~50-min validity window (needs on-chain reconcile = the `/recover`
    step); mint-on-prepare DoS (no rate limit on `/api/actions/*`).
  - ⚠️ Two other PRs are open: **#7** (test-globe) and **#6** (a SessionStart
    hook now superseded by this protocol — recommend closing #6).
- **Off-limits:** do not merge `wip/atomic-purchase`; do not land the atomic
  purchase to mainnet without the `mainnet-gate` review; do not touch funds/ASA
  config without an `algo-auditor` pass first.
