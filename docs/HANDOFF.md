# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `session-relay-protocol`
- **PR:** [#8](https://github.com/KudbeeZero/FRONTIERNeXt/pull/8)
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
- **Proposed branch:** `feat/delivery-worker` (continue the phased delivery worker)
- **Scope (one line):** finish the "worker backbone + instant-when-it-can" plot
  delivery — buy-path enrolls `paid` rows, then the FUNDS-gated `DELIVERED`
  (admin→buyer transfer) + `STAMPED` phases behind an `algo-auditor` gate, plus a
  status UI and migrating the stuck custody plots into the pipeline.
  (See memory [[frontier-delivery-worker-design]].)
- **Done since the protocol shipped** (all on `wip/atomic-purchase`, pushed):
  - `f6af3c8` — Lute gesture-safe signing + wired plot CLAIM delivery
    (**verified live**: purchase prompt opens; plot 3042 delivered). This closes
    the old `fix/wallet-sign-auth` item — the sign step works now.
  - `8bfa563` — phased delivery-worker **foundation**: `plot_purchases` phase
    columns + the on-chain-verifying worker (safe core `PAID → OPTED_IN`, no funds).
- **Open risks (read these):**
  - ⚠️ `wip/atomic-purchase` is the unreviewed WIP snapshot (Steps 1-4 + held
    admin/globe/foundation + the two commits above). NOT for merge — awaits the
    planned 3-branch reorg. The wallet-sign + worker-foundation commits are
    cleanly cherry-pickable.
  - ⚠️ **Audit findings** (see [[frontier-step4-audit-findings]]): the false-402 +
    recovery-window HIGHs are addressed BY the worker design (on-chain reconcile) —
    verify when the funds phases land. The **mint-on-prepare DoS** (no rate limit
    on `/api/actions/*`) is still open.
  - ⚠️ PRs **#7** (test-globe) and **#6** (a SessionStart hook superseded by this
    protocol — recommend closing #6) still open.
- **Off-limits:** do not merge `wip/atomic-purchase`; no funds/ASA/transfer code
  to mainnet without `mainnet-gate`; no funds-moving phase (DELIVERED/STAMP)
  ships without an `algo-auditor` pass first.
