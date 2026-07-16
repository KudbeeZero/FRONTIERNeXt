# Session progress — 2026-07-16 (live, committed as we go)

> Rolling log so state is not lost if the container dies. Newest first.
> Owner directive this session: preserve information often; update the memory
> layer after work even if nothing merges; record branches created + status.

## Active /ship run — token-leak fix (SHIPPED ✅)
- **MERGED:** PR #278 `b09695d`. `sanitizeRemoteUrl()` + regression test; token
  scrubbed from `generated.ts` on main (0 matches). CI green on `e28dc4d`.
- **Workflow correction:** first push had a `[skip ci]` commit as branch tip → no
  CI; reordered so fix is the tip, force-pushed feature branch only, confirmed green.
- **🔴 OWNER MUST ROTATE the exposed GitHub token** (history not rewritten).
- Session note: `artifacts/frontier-al/session-notes/2026-07-16-mission-control-remoteurl-secret-fix.md`.

## Active /ship run — token-leak fix (details)
- **Branch:** `fix/mission-control-strip-remote-token` (off clean origin/main `5b00be6`).
- **Why (finding):** the mission-control generator runs `git config --get
  remote.origin.url` and writes it into the committed `generated.ts`, which the
  client bundle imports. In CI/build the remote is authenticated
  (`https://x-access-token:<TOKEN>@github.com/...`), so a **GitHub access token is
  committed to version control on origin/main right now** and can ship in the
  frontend.
- **Owner call:** pivot this /ship unit to fix the leak now (chosen).
- **Plan:**
  1. `sanitizeRemoteUrl()` in generator strips scheme + userinfo(token) + `.git`,
     keeps host/path only. (DONE)
  2. Scrub the committed token value out of `generated.ts`. (pending)
  3. Regression test: `remoteUrl` never contains `@` / `x-access-token` / token. (pending)
  4. Gate: check/server/client. (pending)
  5. Audit report + PR + green + squash-merge + sync. (pending)
- **OWNER ACTION (cannot be done by agent):** the exposed token must be
  **rotated/revoked** — code sanitization stops future leaks but the already-
  committed token in git history is still compromised. History rewrite NOT done.

## Deferred / preserved (not lost)
- **Consolidated ASA 764083761 reconfig doc** — written this session, preserved at
  `docs/pending/asa-764083761-reconfiguration-DRAFT.md`. Re-home into
  `artifacts/frontier-al/docs/audit/` in a later docs-only /ship unit.

## Shipped earlier this session
- **PR #277 `0e16e56`** — weapons `EngagementStore.settle()` (C-1) salvaged from
  stranded `session/agent_169829a4` + mission-control generator NaN→null CI fix.
  Gate green; CI green on `3b5a4a2`. Deliberately excluded loadout data-model +
  firepower balance changes (owner decision, see HANDOFF NEXT).

## Stranded branches still un-shipped (triage inventory)
- `session/agent_169829a4` — risky remainder (loadout+firepower); safe slice shipped.
- `session/agent_d60fbfc0` + `session/agent_bb0af933` — dup ASA audit docs (consolidated draft now in docs/pending).
- `session/agent_091033b4` — stale audit doc for merged #274; safe to delete.
