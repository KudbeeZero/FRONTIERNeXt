# Session Updater — FRONTIERNeXt Memory Layer

After every KILO implementation session, the agent outputs a **Session Update Block**.
This block syncs GitHub state → Notion Memory Layer → next session bootstrap.

---

## When to Run

- End of every KILO session, whether or not the lane is complete
- Immediately after a PR is merged
- After any production deployment
- After any schema migration or Algorand transaction affecting live data

---

## Session Update Block (KILO outputs this)

```
## SESSION UPDATE — [DATE YYYY-MM-DD]

### Current Commit
[full SHA] on branch [branch] (base: main)

### Lane
[Lane title]

### Status
[ ] In Progress
[ ] Merged
[ ] Blocked
[ ] Abandoned

### PR
[PR URL or "none"]

### What Changed
[Bullet list of changed files and what each does]

### Active Blocker
[Description, or "none"]

### Owner Action Now
[Exactly what the owner needs to do next, or "none"]

### Launch Verdict
[ ] LAUNCH READY
[ ] PARTIAL
[ ] BLOCKED — [reason]

### Memory Writes Required
[ ] Update Notion 00 — Index & Current State
[ ] Write closeout to 10 — Completed Lanes (if merged)
[ ] Update 20 — Audits & Roadmaps (if audit changed)
[ ] No memory write needed
```

---

## Notion Memory Layer Targets

### 00 — Index & Current State
`FRONTIER — Memory Layer / 00 — Index & Current State / CURRENT — FRONTIER Memory Index`

Update these fields after every session:

| Field | Value |
|---|---|
| Current commit | [SHA] |
| Current branch | [branch] |
| Latest merged PR | [PR # and title] |
| Active lane | [lane title or "none"] |
| Active blocker | [description or "none"] |
| Launch verdict | LAUNCH READY / PARTIAL / BLOCKED |
| Owner action | [next step or "none"] |
| Last updated | [YYYY-MM-DD HH:MM CDT] |

### 10 — Completed Lanes
`FRONTIER — Memory Layer / 10 — Completed Lanes / [LANE_TITLE — YYYY-MM-DD]`

Write one page per completed (merged) lane with the full Closeout block from `KILO_RUNNER_PROMPT.md`.

### 20 — Audits & Roadmaps
Update only if the lane changes an active audit finding or roadmap item.

---

## Workflow Sequence

```
[KILO session ends]
        │
        ▼
[KILO outputs Session Update Block]
        │
        ▼
[Owner reviews block]
        │
        ├─── Lane merged? ──YES──► Write closeout to 10 — Completed Lanes
        │                          Update 00 — Index
        │
        └─── Lane in progress? ──► Update 00 — Index only
                                   Paste block as next session bootstrap context
```

---

## Sync Rules

- **GitHub is source of truth.** Notion reflects GitHub — never the reverse.
- **Never describe planned, catalog-only, or UI-only work as live.**
- **Never overwrite a completed lane record** — append a new entry if a lane is reopened.
- **90 — Consolidated Archive** is read-only historical context. Do not append to it by default.
- The session updater runs in every session, including sessions where nothing was merged.

---

## Verification

After each Notion memory write, confirm:
- [ ] `00 — Index` current commit matches `git rev-parse HEAD` on the active branch
- [ ] Launch verdict matches the most recent audit in `20 — Audits & Roadmaps`
- [ ] Active blocker field is either a specific issue or "none" — never vague
- [ ] Owner action is a single, concrete next step
