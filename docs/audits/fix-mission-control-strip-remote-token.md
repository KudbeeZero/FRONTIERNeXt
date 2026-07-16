# Audit — fix/mission-control-strip-remote-token

## Verdict
**PASS** (code fix) — with a **mandatory owner follow-up: rotate/revoke the exposed token.** The code change stops future leaks and scrubs the committed value, but the token already exists in git history and must be revoked out-of-band. History was NOT rewritten (deliberate — see below).

## PR / branch / commit
- **Branch:** `fix/mission-control-strip-remote-token` (off clean `origin/main` `5b00be6`).
- **Type:** security fix (secret leak) + regression test.

## The finding
`scripts/generate-mission-control-data.mjs` ran `git config --get remote.origin.url` and wrote the raw result into `client/src/components/mission-control/generated.ts` — a **committed, client-bundle-imported** file. In CI/build the remote is authenticated:
`https://x-access-token:<TOKEN>@github.com/KudbeeZero/FRONTIERNeXt.git`.
So a GitHub access token was committed to version control on `origin/main` and could ship in the frontend bundle. Severity: **HIGH** (credential exposure).

## Claims vs. evidence
- ✅ **Generator now strips credentials before writing `remoteUrl`.**
  `generate-mission-control-data.mjs` — new `sanitizeRemoteUrl()` strips scheme, any `user[:password]@` userinfo (where the token lives), and `.git`; keeps host/path only; handles scp-like SSH form; collapses anything still containing `@` to `"redacted"`; null-safe. Wired at the `remoteUrl` capture site.
- ✅ **Committed value scrubbed.**
  `generated.ts` diff: `remoteUrl` goes from the full `x-access-token:…@github.com/…` string to `github.com/KudbeeZero/FRONTIERNeXt`. `grep` for `x-access-token`/`%3D%3D`/`@github` in `generated.ts` → **0 matches**.
- ✅ **Sanitizer verified against real forms** (inline check):
  - `https://x-access-token:kgh2.SECRET…@github.com/o/r.git` → `github.com/o/r`
  - `https://user:pass@github.com/o/r.git` → `github.com/o/r`
  - `git@github.com:o/r.git` → `github.com/o/r`
  - `https://github.com/o/r(.git)` → `github.com/o/r`; `""`/`null` → `null`
- ✅ **Regression test added.**
  `missionControlData.test.ts` — new test asserts `remoteUrl` contains no `@`, no `x-access-token`, no `://` scheme, no `user:pass@` form. Client suite 10/10 (was 9).

## Tests
Run from repo root / `artifacts/frontier-al`:
- `pnpm --filter @workspace/frontier-al run check` → **exit 0** (precheck generator regenerated the sanitized value, then tsc clean).
- client suite → **10 passed** (+1 security test).
- server suite → **708 passed** | 26 skipped.
- Post-`check` re-verify: `generated.ts` `remoteUrl` = `github.com/KudbeeZero/FRONTIERNeXt`, 0 token matches.

## Scope creep
None. Files changed: `scripts/generate-mission-control-data.mjs`, `client/src/components/mission-control/generated.ts` (regenerated), `client/src/components/mission-control/missionControlData.test.ts`. (The `docs/pending/` draft + `docs/SESSION_PROGRESS.md` are separate info-preservation commits, `[skip ci]`, not part of the fix diff.)

## Security
- **Fixed (HIGH):** token no longer written to `generated.ts`; regression-tested.
- **OPEN — owner action required:** the exposed token in prior commits of `generated.ts` (on `origin/main`) is compromised and **must be rotated/revoked**. Agents cannot rotate credentials. **Git history was NOT rewritten** — rewriting shared `main` history is destructive and out of scope for an autonomous /ship unit; rotation is the correct remediation.

## What I could NOT verify
- Whether the token is still valid / already rotated (owner/GitHub side).
- CI on GitHub for the head commit (will confirm via `gh pr checks` after push; local green as fallback per ship skill).
