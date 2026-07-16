# 2026-07-16 — /ship run: mission-control remoteUrl secret-leak fix

## Context
Owner ran `/ship` as a workflow test: "if things start going the wrong way or
things are confusing, just stop; if you corrected the workflow, we should be OK."
Also directed: preserve information more often so nothing is lost.

## Unit selection (workflow behaved correctly)
Read the baton. All tempting NEXT items self-blocked as expected:
- weapons loadout/firepower + `settle()` wiring → combat/persisted/owner-approval.
- faction economy / Battle Planner UI → owner approval.
- ASA reconfig → owner-only on-chain.
Picked the one safe, in-scope unit: consolidate the two duplicate ASA audit docs
(docs-only). During self-verify (keeping the diff clean) I found a **secret leak**
and stopped to flag it (per the owner's stop rule).

## The finding → pivot
`scripts/generate-mission-control-data.mjs` wrote `git config --get
remote.origin.url` verbatim into the committed, client-bundled `generated.ts`. In
CI/build the remote is `https://x-access-token:<TOKEN>@github.com/...`, so a
GitHub token was committed to `main` and prior history, and could ship in the
frontend. Owner chose: fix the leak now.

## What shipped — PR #278 `b09695d`
Branch `fix/mission-control-strip-remote-token` off clean `origin/main`.
- `generate-mission-control-data.mjs` — `sanitizeRemoteUrl()` strips scheme +
  `user[:password]@` userinfo (the token) + `.git`; keeps host/path only; handles
  scp-like SSH; null-safe. Wired at the `remoteUrl` capture site.
- `generated.ts` — regenerated: `remoteUrl` = `github.com/KudbeeZero/FRONTIERNeXt`;
  0 token matches.
- `missionControlData.test.ts` — regression test: `remoteUrl` never contains `@`,
  `x-access-token`, a `://` scheme, or `user:pass@`.

## 🔴 OWNER ACTION REQUIRED
The exposed token in git history is compromised and **must be rotated/revoked**.
Agents cannot rotate credentials. **Git history was intentionally NOT rewritten**
(destructive on shared `main`; rotation is the correct remediation).

## Workflow correction (the intended test)
First push accidentally had a `[skip ci]` progress-log commit as the branch **tip**
→ `gh pr checks` reported "no checks reported" (CI never ran). I caught this
instead of merging blind, reordered the commits so the fix (no `[skip ci]`) is the
tip, force-pushed **the feature branch only** (never main), and confirmed CI green
on `e28dc4d`. Lesson recorded in the baton: never leave a `[skip ci]` commit as a
PR branch tip.

## Information preservation (owner directive)
- `docs/SESSION_PROGRESS.md` — live rolling log, committed as work progressed.
- `docs/pending/asa-764083761-reconfiguration-DRAFT.md` — the consolidated ASA doc
  I'd written before the pivot, preserved in-repo (sandbox denied `/tmp` writes) so
  it is not lost; re-home in a later docs-only unit.

## Verification
- `pnpm --filter @workspace/frontier-al run check` → exit 0.
- server suite → 708 passed | 26 skipped.
- client suite → 10 passed (+1 security test).
- CI green on `e28dc4d`: Typecheck & server tests ✅ + Cloudflare Pages ✅.
- Squash-merged `b09695d`; main synced; token grep on main → 0.

## Off-limits (unchanged)
Standard HARD RULES. No funds/ASA/chain/auth code touched; `server/services/chain/`
untouched. One PR at a time; never commit to main directly (baton/session docs go
direct with `[skip ci]` per repo convention — but never as a PR-branch tip).
