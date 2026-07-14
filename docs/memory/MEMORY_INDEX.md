# FRONTIER Memory Index

> **Source of truth for current repo state.**
> Updated at the end of every KILO session via the Session Updater step in `KILO_RUNNER_PROMPT.md`.
> Also synced to Notion: `FRONTIER — Memory Layer / 00 — Index & Current State`.

---

## Current State

| Field | Value |
|---|---|
| **Current commit (main)** | `176b7b3` |
| **Latest completed PR** | #259 — Battle Planner Phase 1 |
| **Active blocker** | None confirmed — verify before starting next lane |
| **Owner action now** | Confirm this memory layer is accurate against `git log main --oneline -5`, then start next lane |
| **Launch verdict** | Land Economy Launch — in progress |
| **Last updated** | 2026-07-14 |

---

## Recent PR History

| PR | Title | Status |
|---|---|---|
| #259 | Battle Planner Phase 1 | Merged → `176b7b3` |
| #258 | Visual Battle Target Selector | Merged |
| #257 | Battle integrity corrections | Merged |
| #256 | Faction identity and globe colors | Merged |

---

## Active Lane

| Field | Value |
|---|---|
| **Branch** | `feat/memory-layer-runner-workflow` |
| **Goal** | Establish Memory Layer docs: KILO runner prompt + session updater workflow |
| **PR** | [Draft — to be created] |
| **Status** | In progress |

---

## Completed Lanes

Full closeouts live in `docs/memory/completed/`. Index:

| PR | Lane | Merged |
|---|---|---|
| #259 | Battle Planner Phase 1 | 2026-07 |
| #258 | Visual Battle Target Selector | 2026-07 |
| #257 | Battle integrity corrections | 2026-07 |
| #256 | Faction identity and globe colors | 2026-07 |

---

## System Status Snapshot

Use labels: `LIVE` · `PARTIAL` · `CONTRACT_ONLY` · `UI_ONLY` · `PLANNED` · `DEPRECATED` · `UNKNOWN`

| System | Status | Notes |
|---|---|---|
| Land purchase flow | `PARTIAL` | Verify full `UI → API → DB → Algorand → refresh` trace |
| ASA/NFT delivery | `PARTIAL` | Confirm on-chain delivery end-to-end |
| Token accumulation | `PARTIAL` | Confirm no duplicate-claim path |
| Wallet connect (Pera) | `PARTIAL` | Mobile Safari reliability unverified |
| Archetype selection | `PARTIAL` | Server-authoritative persistence unverified |
| Faction neutrality | `PARTIAL` | Confirm no hidden economic advantages |
| Terraforming | `PLANNED` | Not yet at launch |
| Battle system | `PARTIAL` | Battle Planner Phase 1 merged; advanced AI post-launch |
| DB/on-chain reconciliation | `UNKNOWN` | No reconciliation audit completed |

---

## Session Updater Protocol

At the end of **every** KILO session:

1. Update **Current commit** field above
2. Update **Latest completed PR** if a merge happened
3. Update **Active blocker** — clear if resolved
4. Update **Owner action now** — one clear next step
5. Update **Last updated** date
6. If lane is complete and merged → write closeout to `docs/memory/completed/[PR#]_[slug].md`
7. Commit with message: `chore: update memory index`
8. Sync summary to Notion: `FRONTIER — Memory Layer / 00 — Index & Current State`

> **Verify the session updater ran** by checking the last commit on the branch includes `chore: update memory index`.

---

## Notion Sync

- Drive/Notion folder: `FRONTIER — Memory Layer`
- Index page: `00 — Index & Current State / CURRENT — FRONTIER Memory Index`
- After every session, paste the **Current State** table above into that Notion page
- Completed lane closeouts → `10 — Completed Lanes`
- Full audits → `20 — Audits & Roadmaps`
- Historical context only → `90 — Consolidated Archive`

---

## Source-of-Truth Order

1. Current GitHub `main` — always wins
2. This file (`docs/memory/MEMORY_INDEX.md`)
3. `docs/HANDOFF.md`
4. Other `docs/memory/` files
5. Notion `FRONTIER — Memory Layer`
6. `90 — Consolidated Archive` — historical only

> **Never let Notion override GitHub.** GitHub is ground truth. Notion is the human-readable mirror.
