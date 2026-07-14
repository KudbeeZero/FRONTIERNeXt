# Session Updater — FRONTIERNeXt Memory Layer

This file defines the **session update workflow**: what to write, where to write it, and in what order, at the close of every KILO coding session.

---

## Purpose

Keep the Notion Memory Layer and GitHub `docs/memory/` in sync after every session so that:

- The next session starts with accurate context
- No work is lost between agents or between days
- The launch verdict and active blockers are always current
- Completed lanes are archived cleanly

---

## When to Run

Run this workflow **at the end of every KILO session**, whether the lane:
- Completed successfully and is merge-ready
- Was paused mid-lane
- Was blocked and requires owner action
- Produced no code changes (research / audit only)

**The session is not closed until this workflow is complete.**

---

## Step 1 — Deliver the Closeout Block to Owner

The agent writes the closeout block (defined in `KILO_RUNNER_PROMPT.md`) and hands it back in the chat.  
The owner reviews it before any Notion writes happen.

---

## Step 2 — Write to Notion: `00 — Index & Current State`

Page: **`CURRENT — FRONTIER Memory Index`**

Update these fields every session, no exceptions:

| Field | What to write |
|---|---|
| **Current commit** | Latest SHA on the active branch |
| **Latest completed PR** | PR number + title + merge date |
| **Active branch** | Branch name + what it contains |
| **Launch verdict** | One of: `NOT READY` / `STAGED RELEASE POSSIBLE` / `LAUNCH READY` + one-line reason |
| **Active blocker** | Highest-priority unresolved finding (label + one sentence) |
| **Owner action now** | Exact next step the owner must take before the next session |
| **Last updated** | Date + session identifier |

**Do not rewrite the entire page.** Update only the fields above. Preserve all other content.

---

## Step 3 — Write to Notion: `10 — Completed Lanes` (merge only)

Only write this entry if the lane reached `MERGE READY` and the PR was merged this session.

Create a new page titled: `[PR #NNN] Lane Name — YYYY-MM-DD`

Include:

```
## Summary
<One paragraph: what the lane did, why it was needed>

## PR
PR #NNN — <title>
Branch: <branch>
Merge commit: <SHA>
Date merged: <YYYY-MM-DD>

## Changed Files
<List of files>

## Tests
<Pass / fail counts, test names if notable>

## Limitations / Known Gaps
<Anything explicitly not fixed or not verified>

## Next Lane Recommended
<One sentence: what should follow this lane>
```

---

## Step 4 — Write to GitHub: `docs/memory/CURRENT_STATE.md` (optional, session-by-session)

If the session changed the launch verdict or uncovered a new critical blocker, also update `docs/memory/CURRENT_STATE.md` in the same branch commit.

This keeps GitHub and Notion aligned without requiring a separate PR.

---

## Step 5 — Confirm Sync

Before closing the session, confirm:

- [ ] Closeout block delivered to owner
- [ ] Notion `00 — Index` updated
- [ ] Notion `10 — Completed Lanes` written (if merged)
- [ ] GitHub `CURRENT_STATE.md` updated (if verdict changed)
- [ ] No uncommitted changes left on the branch
- [ ] CI status confirmed (green / red / pending)

---

## Notion Write Targets (quick reference)

| Target | When | Page name |
|---|---|---|
| `00 — Index & Current State` | Every session | `CURRENT — FRONTIER Memory Index` |
| `10 — Completed Lanes` | Merge sessions only | `[PR #NNN] Lane Name — YYYY-MM-DD` |
| `20 — Audits & Roadmaps` | Full audit sessions only | Audit report page |
| `90 — Consolidated Archive` | Never (read-only for historical context) | — |

---

## Notes for the Agent

- Do not write to `90 — Consolidated Archive`.
- Do not overwrite completed lane records — create a new page per lane.
- If Notion is unavailable, write the update block to the chat and flag it for the owner to post manually.
- If GitHub push fails, include the intended `CURRENT_STATE.md` content in the closeout block.
