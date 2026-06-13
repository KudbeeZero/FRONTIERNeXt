---
name: pr-gate
description: Read-only pre-merge gate for a pull request. Run before merging (or before opening a second PR) to decide mechanically whether a PR is safe to land RIGHT NOW. Checks the current branch, all open PRs (refuses to proceed if a duplicate/second PR is open — one open PR at a time), CI status, merge conflicts vs base, unresolved review comments, the changed-file list, and whether the PR's claimed test evidence is actually backed (green CI on the head commit, not a stale or [skip ci] run). REFUSES the merge if any gate is red, unknown, or untested — "unknown" is treated as a blocker, never a pass. Prints four sections: Summary, Evidence, Blockers, Next. It does NOT merge, push, or edit anything — it only reports go/no-go. For the deep, diff-vs-claims independent review use /handoff-audit; pr-gate is the fast mechanical pre-flight.
---

# /pr-gate — mechanical pre-merge gate (read-only)

A fast, objective go/no-go on a PR. It answers one question: **is this PR safe to
merge right now?** It never merges or edits — it gathers signals and prints a
verdict. For the deep diff-vs-claims review, that's [`/handoff-audit`](../handoff-audit/SKILL.md);
`pr-gate` is the lightweight pre-flight you can run any time.

## When to use
- Immediately before merging a PR.
- Before opening a new PR, to confirm no other PR is already open (the
  **one-open-PR-at-a-time** invariant).
- Any time you want an objective "where does this PR stand" snapshot.

## The gates (all must be GREEN; UNKNOWN counts as a blocker)

Use the GitHub MCP tools (no `gh` CLI in this environment) + local git.

1. **Branch** — what branch are we on / is the PR's head? (`git branch --show-current`).
   The PR head must be the branch you think it is.
2. **Open PRs / duplicates** — list open PRs (`list_pull_requests state=open`). If
   more than one is open, or another PR already covers this branch/scope, **STOP**:
   refuse a duplicate. One open PR at a time.
3. **CI** — the head commit's checks must all be **success** (`pull_request_read
   get_check_runs`). Queued/in_progress/missing = UNKNOWN = blocker. A missing
   check usually means the head used `[skip ci]` — flag it.
4. **Merge conflicts** — the PR must be mergeable against its base
   (`pull_request_read get` → `mergeable_state`; `git merge-base` / a dry
   `git merge --no-commit --no-ff` against fetched base if unsure). Conflicts =
   blocker.
5. **Review comments** — no unresolved/blocking review threads
   (`pull_request_read get_review_comments` / `get_reviews`). Unresolved
   change-requests = blocker.
6. **Changed files** — list them (`pull_request_read get_files`). Flag anything
   outside the PR's stated scope, and flag any secret-bearing file
   (`.env`, keys, mnemonics).
7. **Claimed test evidence** — the PR body's test claims must match reality:
   green CI on the **head** commit (not a parent), and for "fixes" a test should
   back the fix. A claim of "works"/"validated" with no test = **untested** =
   blocker for merge.

## Decision rule
- **GO** only if every gate is GREEN.
- **NO-GO** if any gate is red, unknown, untested, or a duplicate/second PR exists.
  Do not merge on UNKNOWN — resolve it to GREEN or RED first.

## Output (always these four sections)

```
Summary: <one line — GO or NO-GO and why>
Evidence: <branch, PR#, head SHA, CI per check, mergeable_state, #open PRs,
          changed-file count, review state — the raw signals you read>
Blockers: <each red/unknown/untested gate, or "none">
Next:    <the single next action — merge, resolve X, close the duplicate, re-run CI>
```

## Invariants
- Read-only: never merges, pushes, comments, or edits.
- One open PR at a time — a duplicate is an automatic NO-GO.
- UNKNOWN is never a pass. Never report GO on an unverified gate.
