# GrowPod Empire — Kestra Expansion Plan

> **Directive:** AUTO-001 · **Status:** `PLANNED` · **Scope:** architecture only.
> Companion to [`AUTOMATION_FACTORY_ARCHITECTURE.md`](./AUTOMATION_FACTORY_ARCHITECTURE.md).
>
> This is a **proposal** for how the single, flat `frontier.ops` Kestra setup
> grows into a multi-namespace factory **without breaking what runs today**.
> Nothing here is implemented by AUTO-001 — no directories, namespaces, or flows
> are created or moved in this unit. Each step below is a **future, separately
> audited unit.**

## 1. Current state (do not disturb)

`ops/kestra/` is flat. Four flows, one namespace, **testnet only**:

```
ops/kestra/
├── README.md
├── severity-router.yml     namespace: frontier.ops   (shared dispatcher subflow)
├── uptime.yml              namespace: frontier.ops   (every 1 min)
├── deep-health.yml         namespace: frontier.ops   (every 5 min)
└── veritas-grind.yml       namespace: frontier.ops   (every 30 min)
```

The three monitoring flows each call the dispatcher as a subflow with the
namespace **hardcoded**:

```yaml
type: io.kestra.plugin.core.flow.Subflow
flowId: severity-router
namespace: frontier.ops
```

> ⚠️ **This is the load-bearing fact for migration:** if `severity-router` ever
> moves namespaces, **every caller's `namespace:` line must change in lockstep**,
> or the subflow reference breaks. Verified in `uptime.yml`, `deep-health.yml`,
> and `veritas-grind.yml`.

## 2. Target tree (proposal)

```
ops/kestra/
├── frontier.ops/      ← EXISTING division flows, moved verbatim (no behavior change)
│   ├── uptime.yml
│   ├── deep-health.yml
│   └── veritas-grind.yml
├── common.ops/        ← shared subflows reused across factories/divisions
│   └── severity-router.yml
├── executive.ops/     ← F1 Executive Coordination
├── research.ops/      ← F2 Research
├── engineering.ops/   ← F3 Engineering
├── qa.ops/            ← F4 QA & Audit (new audit/regression flows)
├── analytics.ops/     ← F6 Analytics
└── nightshift.ops/    ← F7 Night Shift
```

Notes:

- **`frontier.ops` is a *division* namespace** (it owns FRONTIER-AL's monitoring,
  secrets, and target URL). Function factories get **function** namespaces
  (`research.ops`, `engineering.ops`, …) so they can serve any division.
- **F5 Operations** today *is* `frontier.ops` (division-scoped monitoring). A
  cross-division `operations.ops` is only introduced if/when a second division
  exists.
- The brief's `executive.ops … nightshift.ops` tree is honored; `common.ops` is
  added for the shared dispatcher so it isn't trapped inside a division.

## 3. Namespace & convention proposal

| Namespace | Kind | Owns |
|---|---|---|
| `frontier.ops` | division | FRONTIER-AL monitoring + division secrets/vars |
| `common.ops` | shared | dispatchers/subflows reused everywhere (`severity-router`) |
| `executive.ops` | function (F1) | session/PR/registry/handoff flows |
| `research.ops` | function (F2) | research scans + digests |
| `engineering.ops` | function (F3) | build/check/pr-draft/deploy-prep |
| `qa.ops` | function (F4) | audit/regression/coverage/release-verify |
| `analytics.ops` | function (F6) | metrics/economy-sim/dashboards |
| `nightshift.ops` | function (F7) | overnight queue/batch/retry/morning-summary |

**Secrets & variables:** keep division secrets (admin key, testnet mnemonic,
target URL) under the **division** namespace (`frontier.ops`). Keep shared
notification secrets (`DISCORD_WEBHOOK_SEV*`) wherever the dispatcher lives
(`common.ops`) so every caller inherits one alerting path. Function namespaces
hold only their own config (e.g. research API keys in `research.ops`).

## 4. Migration without breakage (phased)

The risk is the hardcoded subflow `namespace:` references (§1). Sequence so the
running first-responder system never goes dark:

1. **Phase 0 — AUTO-001 (this unit):** docs only. **No files moved.** Establish
   the target tree + conventions on paper.
2. **Phase 1 — `chore/kestra-namespace-prep`:** introduce the nested directories
   and **copy** (do not delete) `severity-router.yml` into `common.ops/` with
   `namespace: common.ops`. Leave the original `frontier.ops` copy in place and
   active. No caller changes yet → zero downtime.
3. **Phase 2 — `chore/kestra-repoint-dispatcher`:** update the three monitoring
   flows' subflow blocks to `namespace: common.ops`, re-import, verify alerts
   fire end-to-end on a SEV3 test, **then** retire the old `frontier.ops`
   `severity-router`. One reviewed unit; reversible.
4. **Phase 3+ — per-factory build-out:** each new factory namespace
   (`research.ops`, `engineering.ops`, …) ships as its **own** unit/PR, with its
   own flows, secrets, tests, and audit. Order suggested in §6.

**Re-import order (Kestra UI):** always import the shared dispatcher
(`common.ops/severity-router`) **before** any flow that calls it, exactly as the
current README requires `severity-router.yml` first.

**Reversibility:** because Phase 1 *copies* rather than moves, any phase can be
rolled back by re-importing the previous YAML; the repo YAMLs remain the source
of truth.

## 5. Recommended stack (from the brief)

| Layer | Choice |
|---|---|
| Orchestrator | Kestra (self-hosted) |
| Containers | Docker + Docker Compose |
| Frontend | Cloudflare Pages |
| API + Workers + Kestra | Hetzner VPS |
| Early-stage deploys | Railway |
| Storage | PostgreSQL |
| Notifications | Discord webhooks (live), Telegram bots, email |

These are **deployment targets for the factory infra**, not for the game's funds
path. The testnet-only rule for monitoring flows is unaffected by where Kestra
itself runs.

## 6. Phased roadmap (each = one audited unit)

| Phase | Unit (proposed branch) | Delivers |
|---|---|---|
| 0 | `claude/kestra-automation-factory-06fr1h` (**this PR**) | the 4 architecture docs (AUTO-001) |
| 1 | `chore/kestra-namespace-prep` | nested dirs + `common.ops` dispatcher copy (no caller change) |
| 2 | `chore/kestra-repoint-dispatcher` | repoint callers to `common.ops`, retire old copy |
| 3 | `feat/qa-ops-audit-flow` | `qa.ops` audit/regression flows (build on existing veritas) |
| 4 | `feat/nightshift-ops-queue` | `nightshift.ops` overnight queue + morning summary |
| 5 | `feat/research-ops-scan` | `research.ops` daily/weekly research digests |
| 6 | `feat/analytics-ops-economy` | `analytics.ops` economy sim + dashboards |
| 7 | `feat/engineering-ops-checks` | `engineering.ops` build/check/pr-draft |
| 8 | `feat/executive-ops-orchestration` | `executive.ops` session/PR/registry flows |

Ordering rationale: stabilize the shared dispatcher first (Phases 1–2), then add
the factory that already has live foundations (QA, on top of veritas), then the
factory that delivers the most leverage while the CEO sleeps (Night Shift), then
the rest.

## 7. Guardrails restated

- **Testnet only** for any flow that hits a live target. **Nothing in
  `ops/kestra/` may point at mainnet** — preserved through every phase.
- **Production deploy / mainnet** never happen from a Kestra flow autonomously —
  CEO approval, and for funds/ASA/transfer the `/mainnet-gate` + `algo-auditor`
  double-gate.
- **One open PR at a time** — phases ship one unit per chat, audited on the way
  in.

## 8. See also

- [`AUTOMATION_FACTORY_ARCHITECTURE.md`](./AUTOMATION_FACTORY_ARCHITECTURE.md) ·
  [`AGENT_CHAIN_OF_AUTHORITY.md`](./AGENT_CHAIN_OF_AUTHORITY.md) ·
  [`FACTORY_REGISTRY.md`](./FACTORY_REGISTRY.md)
- [`../ops/kestra/README.md`](../ops/kestra/README.md) — current flows + setup.
