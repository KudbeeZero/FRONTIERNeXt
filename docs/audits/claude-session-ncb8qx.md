# Audit — PR #193 (`claude/session-ncb8qx`) — retroactive

**Verdict: PASS** (already merged by owner; this audit ran after the fact — see
"Why retroactive" below).

**Scope reviewed:** PR #193 — two units on one branch:
(1) battle-cinematic playtest verification (`3fdd146`, docs-only) and
(2) the `VITE_DEV_AUTOLOGIN` production wallet-hijack fix (`a5aec90`).
Merged to `main` as `c0850c0` at 2026-07-06 11:26 UTC.

## Why retroactive

The producing session died immediately after pushing the merge (merge 11:26:12,
CI kicked off 11:26:19, then nothing) — it never ran `/closeout`, so the baton
(`docs/HANDOFF.md`) was left stale ("main green at `7391a40`, nothing open")
with no mention of #193. This audit was performed by the next session
(2026-07-06, branch `claude/session-failure-review-rwsbol`) as part of
repairing that handoff.

## Evidence — diff vs. claims

Every claim in the PR body checked against the actual diff and live state:

- **CI:** green on head `a5aec90` (PR run, created 11:24:03Z, success) AND on
  merge commit `c0850c0` on `main` (push run 11:26:19Z, success). Not stale,
  not `[skip ci]`.
- **Deploy:** "Deploy to Fly" workflow succeeded on `c0850c0` — the fly.toml
  build-arg change is **live**, not waiting on a manual redeploy as the PR body
  cautiously assumed.
- **Tests re-run locally by the auditor at `c0850c0`:** `tsc` clean · server
  **439 passed / 14 skipped** · client **230 passed** — exactly matches the
  PR's claimed numbers.
- **Fix mechanics verified by reading the code:**
  - `fly.toml` no longer sets `VITE_DEV_AUTOLOGIN` → `DEV_AUTOLOGIN` is `false`
    in the prod bundle → `shouldDevAutoLogin()` (landing.tsx effect) can never
    fire. Root cause removed.
  - `WalletContext.disconnect()` now calls `endDevSession()` via the new pure
    guard `shouldEndDevSessionOnDisconnect()` (WalletContext.tsx:471) — the
    "Disconnect is a no-op" trap is closed.
  - Defense in depth already existed: a real wallet becoming active also purges
    any lingering dev session (WalletContext.tsx:311, pre-existing).
- **Scope:** 7 files, 371+/8−, all inside the claimed surface (fly.toml,
  WalletContext, one new test, docs, two session notes). No mainnet/funds code,
  no mock data, no combat/canvas changes. HARD RULES respected.

## Findings (none blocking)

1. **[test-thin]** The new test pins only the pure guard
   (`devMode && devActive`) — not that `disconnect()` actually calls
   `endDevSession()`. Consistent with the repo's no-jsdom constraint, but the
   wiring itself is unverified by tests; the owner's live smoke test is the
   real check.
2. **[protocol-nick]** The PR was merged ~2.5 minutes after the head push —
   the head CI run had started but likely not finished at merge time. It did
   finish green, so no harm done, but "merge on green" means *completed*
   green, not "running and looking good."
3. **[standing risk, deliberate]** `VITE_DEV_MODE='true'` +
   `DEV_LOGIN_ENABLED='true'` still ship in production fly.toml — the manual
   "⚙ Dev / Test Mode" button still lets any visitor enter as the shared test
   player. Documented as intentional for the TestNet playtest phase; **must be
   removed before mainnet** (mainnet-gate item).

## Owner follow-ups (carried into the baton)

- Live smoke test on frontierprotocol.app post-deploy: (1) landing no longer
  auto-enters the game, (2) real wallet stays connected in `/game`,
  (3) Disconnect reaches the connect-gate, (4) a land purchase succeeds.
