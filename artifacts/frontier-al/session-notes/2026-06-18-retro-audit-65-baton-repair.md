# 2026-06-18 — Retro-audit merged PR #65 + repair the stale baton

## Unit
Doc/audit-only. The baton (`docs/HANDOFF.md`) still described **#65** as the single
**open** PR `AWAITING_AUDIT` ("Do NOT auto-merge — owner merges"), but #65 was **already
merged** into `main` (`d6f6653`, CI `ci.yml` run **#198 = success**) — it landed before
its start-of-chat `/handoff-audit` ran. This chat reconstructed the independent
diff-vs-claims review #65 skipped, and rewrote the baton to match reality. No product /
gameplay / economy / DB / token / chain / code behavior changed.

Owner rule locked this session: **one active PR at a time** — no stacked/parallel/chained
PRs without explicit owner approval; the owner merges; discovered units get **queued**, not
opened.

## What shipped (docs only, 3 files)
- **`docs/audits/claude-status-immediate-issues-8ltv13.md`** (new) — retro-audit of #65,
  verdict **PASS** (retro/non-blocking — already merged). Claims-vs-diff table, the test
  numbers reproduced, and the meta-finding (#65 merged pre-audit, same pattern as #52/#61).
- **`docs/HANDOFF.md`** — baton repaired: dropped the stale "open PR #65 / AWAITING_AUDIT /
  do-not-auto-merge" block; recorded **#65 MERGED `d6f6653` → retro-audited PASS** and demoted
  it into the merge history; set state to **queue clear, no open PR, main green at `d6f6653`**;
  added the locked **one-active-PR-at-a-time** owner rule; refreshed the stale "Repo state"
  (HEAD `ca240d9`→`d6f6653`, 252→279 server / 55→69 client) and the "NEXT/Queued" globe entries
  (pick-index DONE; only the §6 `globeProjection.ts` seam remains); closed the #64 loot-box risk.
- **`artifacts/frontier-al/session-notes/2026-06-18-retro-audit-65-baton-repair.md`** (this file).

## Audit result (see the audit doc for evidence)
**#65 = PASS (retro).** Re-verified on `main`:
- `check` (tsc) ✓
- client `test` **69 pass / 12 files**
- `test:server` **279 pass / 7 skipped** (unchanged → confirms no server code path altered)
- the 2 new globe specs **12 pass / 2 files** targeted

Scope confirmed **client-only/additive** (4×`client/**` + session note + baton; no
server/storage/economy/token/battle/dashboard/loot-box/schema/deps). Equivalence is
test-backed by an **independent** inlined brute-force oracle; parity test imports **both**
client `globeUtils` and server `sphereUtils`. Not browser-verified; the session-note's "two
independent review agents" claim has no in-repo artifact (narrative, non-blocking).

## Verification of THIS unit
Doc-only — no code touched, so no behavior to test. `git status` clean after commit; the
PR head carries a real CI run (no `[skip ci]` on the baton commit).

## Next (do NOT start until this audit PR is reviewed)
Queue is clean. Owner picks exactly one next unit — candidates: the deferred
`globeProjection.ts` §6 seam (with the combat package), or the #52 dashboard follow-ups.
