# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `claude/algorand-plugin-install-ksnm6e`
- **PR:** [#17](https://github.com/KudbeeZero/FRONTIERNeXt/pull/17) (Kestra
  first-responder foundation: veritas JSON severity + ops/kestra/ flows)
- **Audit status:** `AWAITING_AUDIT`
- Note: previous baton said #15 was AWAITING_AUDIT, but #15 is already merged
  (`81c4f26` on `main`) — the owner merged it directly. Treat its audit as
  waived-by-owner; the review report it shipped is still worth reading.

## What this chat did (for the auditor)
Owner asked for automated testing/monitoring/incident-response ("Kestra" — he
runs a self-hosted instance; alerts → Discord; backend → Replit; chaos →
staging only, later). Planned in plan mode (approved), shipped the foundation:
- **Veritas is now orchestrator-friendly:** `severityOf()` (DRIFT→SEV1,
  FAIL→SEV2, else OK) + `VERITAS_JSON=1` pure-JSON stdout / text-report stderr.
  3 new unit tests.
- **`ops/kestra/`:** severity-router (tiered Discord dispatch), uptime (1-min
  /health, 2→SEV2 / 5→SEV1 consecutive-failure streaks), deep-health (5-min
  /api/admin/status thresholds), veritas-grind (30-min robot player), README
  (setup/secrets/severity model/roadmap).
- **Verified:** server 197/197, client 31/31, build green, JSON mode exercised
  end-to-end (exit 1 + `"severity":"SEV2"` against dead backend). **tsc still
  red: 255 pre-existing client errors, count identical to `main`.** Kestra
  YAMLs are parse-validated only — not yet imported into the live Kestra VM.

## NEXT chat
- **Proposed branch:** `fix/client-typecheck-ci` (unchanged top priority — CI's
  typecheck step is red on `main`, which breaks this protocol's audit gate).
- **Scope (one line):** make `pnpm --filter @workspace/frontier-al run check`
  green (255 errors; `@types/react` 18 vs 19 workspace split).
- **Queue after that (one unit each):**
  1. `fix/endpoint-gating` — gate `/api/orbital/trigger` + `/api/orbital/resolve/:id`
     (admin key), session-bind `/api/nft/retry-commander/:commanderId`, and the
     one-line `frontier:`→`ascend:` fix at `client/src/hooks/useGameState.ts:166`.
  2. `feat/veritas-land-flow` — robot land purchase (testnet payment txn →
     `POST /api/actions/purchase` → assert ownership + replay guard).
  3. `feat/veritas-commander-flow` — commander mint (payment + ASCEND clawback).
  4. `feat/kestra-remediation` — Replit restart on SEV2/SEV1 router branches.
  5. `feat/kestra-auto-triage` — SEV1 → GitHub issue → Claude Code Action fix PR.
  6. `feat/chaos-drills` — staging-only fault injection to fire-drill the pipeline.
- **Owner setup (not code):** import `ops/kestra/*.yml` into the Kestra VM
  (router first), create the 3 Discord webhooks + responder role, set Kestra
  secrets per `ops/kestra/README.md`. First import may need small task-syntax
  fixes in the Kestra UI — sync any back to the repo.
- **Open risks:**
  - ⚠️ CI red on `main` (typecheck) — pre-existing; vitest suites + build are
    the interim audit bar.
  - ⚠️ Before any deploy: apply `migrations/0005_redeemed_payments.sql` — the
    replay guard fails closed; without the table every paid purchase 503s.
  - ⚠️ Ungated `/api/orbital/*` endpoints are a live attack surface.
  - ⚠️ Port closed PR #10's algod-first finality check + `closeRemainderTo`/
    `rekeyTo` rider rejection into `verifyAlgoPayment`.
  - ⚠️ Mint-on-prepare DoS (no rate limit on `/api/actions/*`) still open.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may ever point at mainnet; no funds/ASA/transfer code to mainnet without
  `mainnet-gate`; no funds-moving phase ships without an `algo-auditor` pass.
