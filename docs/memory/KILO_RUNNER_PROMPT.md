# KILO Runner Prompt — FRONTIERNeXt

> Copy-paste this block at the start of every KILO / Claude Code / Codex session.
> Fill in the bracketed lane-specific fields before sending.

---

## Repo

- **Repo:** `KudbeeZero/FRONTIERNeXt`
- **App path:** `artifacts/frontier-al/`
- **Branch:** `feat/[lane-name]`
- **Base:** `main`

---

## Memory Layer — Read First

Before any implementation, read in order:

1. `00 — Index & Current State/CURRENT — FRONTIER Memory Index`
2. Relevant `docs/memory/` files for this lane
3. `docs/HANDOFF.md`
4. Active reports in `20 — Audits & Roadmaps` if applicable

Do **not** load `90 — Consolidated Archive` unless historical context is missing and critical.

---

## Source-of-Truth Order

1. Current GitHub `main`, PRs, commits, branches, migrations, tests, CI
2. `docs/HANDOFF.md`
3. Relevant `docs/memory/` files
4. Drive: `00 — Index`, active `20 — Audits & Roadmaps`, completed `10 — Completed Lanes`
5. `90 — Consolidated Archive` — historical context only

Never let Drive memory override current repo evidence.

---

## Scope

[Lane-specific scope here — be specific about files, functions, routes, tables]

## Non-Goals

[Lane-specific non-goals — list everything explicitly out of scope]

## Tests

[Lane-specific test targets — unit, integration, or e2e as applicable]

---

## Development Rules

- Inspect before editing. Preserve valid existing work.
- One active lane and one PR at a time.
- Avoid broad rewrites and dependency upgrades.
- Separate unrelated bugs into separate PRs.
- Run focused tests during development; full verification at closeout.
- Do not begin the next lane before this lane is reviewed or merged.

## Restricted Systems (Do Not Touch)

- Secrets, private keys, wallet mnemonics, environment variables
- Treasury / admin addresses
- ASA IDs
- Production data
- Prices or token accounting values

---

## Session Updater — Run at Closeout

At the end of this session:

1. Write the session update block below to `00 — Index & Current State/CURRENT — FRONTIER Memory Index`
2. If this lane is merged: write a closeout record to `10 — Completed Lanes/[PR#]-[lane-name]-closeout.md`
3. Output the full block in your final response for owner review

```
ASKED
[What was requested in this session]

DONE
[What was completed — file paths, commits, changed functions]

NEEDS YOU
[What requires owner action before the next step]

---
Branch:
Base: main
Commits:
Changed files:
Uncommitted changes:
Tests: [passed N / failed N / total N]
Typecheck/build: [pass / fail]
CI: [green / red / pending]
Limitations:
Restricted systems: secrets, wallet config, treasury, ASA IDs, production data
PR URL:
Merge verdict: [MERGE READY / NEEDS CHANGES / BLOCKED]
```

---

## Default Priorities (Reference)

1. Ownership and funds safety
2. Wallet / auth correctness
3. Duplicate transaction prevention
4. Plot / sub-plot purchase integrity
5. ASA / NFT delivery and reconciliation
6. Token accounting and duplicate-claim prevention
7. Database / on-chain consistency
8. Refresh / logout / reconnect persistence
9. Mobile Safari and Pera reliability
10. Upgrade and archetype correctness
11. Terraforming
12. Misleading UI / docs
13. Visual polish
