# Kestra ops automation — the first-responder system

Workflow definitions for the self-hosted [Kestra](https://kestra.io) instance
that watches the FRONTIER-AL **testnet** deployment. These YAMLs are the source
of truth — edit them here, then re-import (Kestra UI → Flows → Import, or paste
into the editor). Namespace: `frontier.ops`.

> ⚠️ **Never point any of these flows at mainnet.** `targetUrl` must be the
> testnet deployment, and `VERITAS_TEST_MNEMONIC` must be a throwaway testnet
> wallet. This mirrors the app HARD RULES (`artifacts/frontier-al/CLAUDE.md`).

## The severity model (first-responder tiers)

| Tier | Meaning | Examples | Response today | Response (later units) |
|------|---------|----------|----------------|------------------------|
| **SEV3** | Degraded, players unaffected | slow algod/DB latency; recovery notes | quiet post to `#ops-sev3` digest | — |
| **SEV2** | Player-impacting breakage | veritas flow FAIL; `/health` down 2 min; DB or chain unreachable | `#first-responders` + role ping | auto-restart via Replit API |
| **SEV1** | Money-path danger or sustained outage | any veritas **DRIFT** (DB ≠ chain); `/health` down ≥5 min; harness blind | `#ops-sev1` + `@here` | restart + GitHub issue → Claude Code auto-triage |

All dispatching goes through one subflow (`severity-router.yml`), so future
remediation/triage steps are added in exactly one place.

## The flows

| Flow | Schedule | What it does |
|------|----------|--------------|
| `severity-router.yml` | subflow (no trigger) | Routes `{severity, title, detail}` to the right Discord webhook |
| `uptime.yml` | every 1 min | `GET /health`; escalates on **consecutive** failures (2→SEV2, 5→SEV1) via a KV streak counter; posts a recovery note when a streak ends |
| `deep-health.yml` | every 5 min | `GET /api/admin/status` (admin key): chain connected? DB connected? latency thresholds → SEV2/SEV3 |
| `veritas-grind.yml` | every 30 min | Clones the repo, runs the Veritas robot player (`VERITAS_JSON=1 pnpm run veritas`) against the live backend, routes the JSON `severity` |

## Setup

1. **Discord**: create three webhooks (Server Settings → Integrations →
   Webhooks) for your digest / first-responders / emergency channels, and a
   `@first-responders` role. Copy the role id into
   `severity-router.yml` → `variables.firstResponderRoleId`.
2. **Kestra secrets** (Namespace `frontier.ops` → Secrets, or `SECRET_*` env
   vars on the Kestra server):
   - `DISCORD_WEBHOOK_SEV3`, `DISCORD_WEBHOOK_SEV2`, `DISCORD_WEBHOOK_SEV1`
   - `FRONTIER_ADMIN_KEY` — the backend's `ADMIN_KEY`
   - `GITHUB_TOKEN` — fine-grained PAT with read access to this repo (it's private)
   - `VERITAS_TEST_MNEMONIC` — 25-word **testnet** wallet seed
   - `VERITAS_FUNDER_MNEMONIC` — optional testnet funder for auto top-up
3. **Variables**: in each flow, set `targetUrl` to the Replit deployment URL;
   set `ascendAsaId` in `veritas-grind.yml` once the testnet ASA id is known.
4. **Import** the four YAMLs (import `severity-router.yml` first — the others
   call it as a subflow).
5. **Reachability check**: from the Kestra VM, `curl https://<target>/health`
   must return 200. The veritas task needs Docker available to Kestra
   (standard in the docker-compose install) and outbound HTTPS to GitHub,
   npm, and algonode.

Veritas's own `VERITAS_DISCORD_WEBHOOK` is intentionally **not** set in
`veritas-grind.yml` — the router owns alerting; setting both double-posts.

## Severity sources

- **Veritas** maps its own results in code
  (`artifacts/frontier-al/server/veritas/reporter.ts` → `severityOf`):
  any `DRIFT` → SEV1, any `FAIL` → SEV2, else OK. JSON shape on stdout:
  `{ severity, startedAt, ms, totals, flows[] }` (text report goes to stderr).
- **Health flows** assign severity in the YAML conditions (thresholds are flow
  variables you can tune in the UI without touching the repo).

## Roadmap (queued as separate units in docs/HANDOFF.md)

1. `feat/veritas-land-flow` — implement the land-purchase robot flow (real
   testnet payment → `POST /api/actions/purchase` → assert ownership + replay guard).
2. `feat/veritas-commander-flow` — commander mint flow (payment + ASCEND clawback).
3. `feat/kestra-remediation` — Replit restart/redeploy task on the SEV2/SEV1
   branches of `severity-router.yml`.
4. `feat/kestra-auto-triage` — SEV1 → GitHub issue containing the veritas JSON →
   Claude Code GitHub Action proposes a fix PR.
5. `feat/chaos-drills` — fault-injection flow against a **separate staging
   instance** (never the live game), to fire-drill this whole pipeline.
