---
name: ci-check
description: Enumerate every CI/status check for a commit, PR, or branch head with its exact individual pass/fail/pending state — use whenever a status indicator (red X, "still red", a mobile-app check mark) is ambiguous, contradicts what other tooling shows, or someone reports a check staying red after a fix. Never trust a single visual indicator; always resolve it to the underlying per-check states. Read-only — it only reports, never re-runs or merges anything.
---

# /ci-check — resolve an ambiguous status indicator to real per-check state

A red/green icon in a GitHub UI (especially the mobile app) can mean several
different things: a check still running, a check that actually failed, a
required-context mismatch from branch protection, or — as found in this repo's
2026-07-07 session — an icon that isn't a CI indicator at all (e.g. the
branch-vs-default-branch compare icon, which is always "different" for the
default branch itself). Don't guess. Enumerate.

## When to use
- Someone reports a status as "still red" / "not going green" after you
  already believe the fix shipped or CI passed.
- A visual indicator (mobile app, branch list, badge) disagrees with what
  `pull_request_read get_check_runs` or `actions_list` shows.
- Before telling a user "CI is green" — confirm it against the **exact head
  commit SHA** in question, not a cached or parent commit.

## Procedure (no `gh` CLI in this environment — GitHub MCP tools only)

1. **Pin the exact commit.** `git fetch origin <branch> && git log origin/<branch> -1 --format='%H %s'`.
   Every check below must be checked against this SHA, not "the branch" loosely.

2. **If there's an open or recently-merged PR for that commit:**
   `pull_request_read` method `get_check_runs` on that PR number. This is the
   cheapest, most complete signal — it includes third-party checks (Cloudflare
   Pages, bot reviewers) as well as GitHub Actions jobs.

3. **If there's no PR (e.g. checking `main` directly), use Actions runs:**
   `actions_list` method `list_workflow_runs` with `branch` filter.
   **Known gotcha (hit 2026-07-07):** the `branch`/`status` filters on this
   tool do not reliably shrink the response — it can return 400K+ characters
   and hit the token-output limit even filtered. When that happens, the tool
   auto-saves the full JSON to a file; read it back and filter locally instead
   of re-requesting:
   ```bash
   python3 -c "
   import json
   with open('<saved-path>') as f:
       data = json.load(f)
   runs = data.get('workflow_runs', data)
   for r in runs:
       if r.get('head_sha','').startswith('<short-sha>'):
           print(r.get('name'), r.get('status'), r.get('conclusion'))
   "
   ```

4. **Enumerate every context, not just the ones you expect.** List each
   check/workflow by name with its literal `status` and `conclusion` —
   `in_progress`/`queued` (not done yet) vs `completed`+`success` vs
   `completed`+`failure`. A check that never reports (renamed workflow job,
   branch-protection required-context typo) reads as permanently pending/red
   to GitHub even though nothing is actually running or failing — call this
   out explicitly if you see it.

5. **If every real check is green but the reported indicator still isn't:**
   say so plainly, and consider whether the indicator is a *different* kind of
   icon (PR-eligibility / branch-compare state, stale mobile-app cache,
   notification badge) rather than a CI status at all — e.g. a repo's default
   branch compared to itself has "nothing to merge," which some GitHub UIs
   render as an X distinct from any check failure. Don't invent a fix for a
   problem that isn't a CI failure.

## Output (always these sections)

```
Commit:   <SHA> "<subject>" on <branch>
Checks:   <name> — <status>/<conclusion>   (one line per check, ALL of them)
Verdict:  <all green | N failing: <names> | N still pending: <names>>
Explain:  <if the visual indicator disagrees with the checks above, say what
           it more likely represents instead of asserting a phantom CI failure>
```
