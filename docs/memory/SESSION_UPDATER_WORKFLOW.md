# Session Updater Workflow — FRONTIERNeXt Memory Layer

> **Purpose:** Keep the memory layer current between KILO sessions, across GitHub and Notion, without requiring manual updates after every commit.

---

## Memory Layer Structure

The canonical memory layer lives in two places that must stay in sync:

| Layer | Location | Purpose |
|---|---|---|
| **GitHub** | `docs/memory/` | Source of truth — version-controlled, commit-linked |
| **Notion** | Drive folder: `FRONTIER — Memory Layer` | Human-readable index, audit trail, owner actions |

### Drive Folder Layout

```
FRONTIER — Memory Layer/
├── 00 — Index & Current State/
│   └── CURRENT — FRONTIER Memory Index     ← updated after every session
├── 10 — Completed Lanes/
│   └── [PR number] — [lane name]           ← written at merge
├── 20 — Audits & Roadmaps/
│   └── [active audit or roadmap docs]
└── 90 — Consolidated Archive/
    └── [historical context only — do not load by default]
```

---

## Trigger Conditions

The session updater runs after any of the following events:

| Event | Action |
|---|---|
| KILO session ends (any state) | Write SESSION UPDATE block; update `00 — Index` |
| Lane marked MERGE READY | Write closeout to `10 — Completed Lanes` |
| PR merged to main | Confirm closeout record exists; update Index with new commit |
| Post-deploy confirmation | Update Index launch verdict and active blocker |

---

## What Gets Written — `00 — Index & Current State`

After every session, the following fields are updated in `CURRENT — FRONTIER Memory Index`:

```
Current commit:         [short SHA + message]
Current branch:         [branch name]
Latest completed PR:    [PR number + title]
Launch verdict:         [BLOCKED / STAGED / READY / LIVE]
Active blocker:         [one sentence, or NONE]
Owner action now:       [one sentence — most urgent next step]
Last updated:           [YYYY-MM-DD]
Session summary:        [one sentence — what was worked on]
```

> **Rule:** Never describe planned, catalog-only, contract-only, UI-only, or partial work as live. The launch verdict must reflect verified repo state.

---

## What Gets Written — `10 — Completed Lanes`

At merge, create a new document in `10 — Completed Lanes` using the KILO closeout block:

```
Filename:  [PR number] — [lane-slug]

Contents:
  - Full CLOSEOUT block from KILO (ASKED / DONE / NEEDS YOU)
  - Branch, base, commits, changed files
  - Test results, typecheck, CI status
  - PR URL
  - Merge verdict
  - Date merged
```

---

## GitHub ↔ Notion Sync Rules

| Item | GitHub (`docs/memory/`) | Notion (`FRONTIER — Memory Layer`) |
|---|---|---|
| Current commit | Source of truth | Mirror from GitHub |
| Active blocker | Source of truth | Mirror from GitHub |
| Owner action | Source of truth | Mirror from GitHub |
| Launch verdict | Source of truth | Mirror from GitHub |
| Completed lane closeout | Source of truth | Mirror from GitHub |
| Audit / roadmap docs | Notion is primary | GitHub holds summary only |
| Historical archive | GitHub holds full history | `90 — Consolidated Archive` |

**Never let Notion override current GitHub repo evidence.** If a discrepancy exists, GitHub `main` wins.

---

## Double-Run Behavior

The session updater may run twice in a single session — once mid-session and once at closeout. Both runs are expected and both should be green. This is by design:

- **First run:** captures in-progress state (active blocker, owner action, CI status)
- **Second run:** captures final closeout state (merge verdict, completed lane record)

If both runs are green, no action is required.

---

## Memory Rules (enforced)

- `00 — Index` is updated after **every** session, not just merges.
- `90 — Consolidated Archive` is read-only by default — do not load or append unless historical context is specifically needed.
- Do not describe partial or planned work as live in any memory document.
- Completed lane records in `10 — Completed Lanes` are immutable once written — do not edit post-merge.
- The memory layer is an audit trail, not a wishlist. Every entry must be traceable to a commit, PR, or verified deployment.
