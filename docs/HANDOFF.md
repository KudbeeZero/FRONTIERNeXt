# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** `chore/recovery-z-index-hardening-review` — safe parked z-index hardening review.
- **Branch:** `chore/recovery-z-index-hardening-review` (merged + deleted)
- **PR:** #234 · **MERGED**
- **Status:** done — z-index hardening recovery lane **closed**. UI-layer only (`uiLayers.ts`, `CommTerminal.tsx`, `hud/hud.css`) + audit doc; no game/globe/combat behavior changed.
- **Active lane:** none. No open PR/lane.

## NEXT
- **Proposed branch:** `chore/ts7-prep-scan` (read-only prep — NOT the migration)
- **Scope (one line):** scan/inventory what a TS7 migration would touch and surface risks; produce a prep report only. Do **not** start the full TS7 migration.
- **Open risks:** TS7 migration itself is large/high-blast-radius — keep this lane read-only.
- **Off-limits:** standard HARD RULES below. Do NOT touch `server/services/chain/`, transaction amounts, ASA destinations, or the parked auth cleanup branch.

## Last result (for fast auditor sanity-check)
- **Shipped:** z-index hardening review — `artifacts/frontier-al/client/src/lib/uiLayers.ts`, `artifacts/frontier-al/client/src/components/game/CommTerminal.tsx`, `artifacts/frontier-al/client/src/components/game/hud/hud.css`, plus audit doc `docs/audits/chore-recovery-z-index-hardening-review.md`.
- **Verified (from PR #234):** `pnpm install` pass · `check`/`tsc` pass · `vitest` **355 passed**. CI green (Typecheck & server tests, Cloudflare Pages).
- **Scope:** UI-layer only; the stale `docs/HANDOFF.md` baton edit from the old branch was **excluded** from PR #234. Zero funds/ASA/wallet/on-chain/mainnet/auth/globe/combat files touched.
- **Self-audit:** `docs/audits/chore-recovery-z-index-hardening-review.md` — no funds/ASA/auth lanes touched, so no independent auditor required.
- **Parked:** the **auth cleanup branch** remains parked and must NOT be merged without owner approval.

## Definition of done (tightened)
A session is NOT finished until ALL hold — verify mechanically, don't assume:
1. **Local checks green:** `pnpm install --frozen-lockfile` · `frontier-al run check` · `test:server` · `test` — recorded pass counts, no red.
2. **One PR, reviewed:** exactly one PR into `main` with an `## Audit checklist`; nothing merged unreviewed. Funds/ASA/auth units require `/mainnet-gate` PASS + `algo-auditor` PASS + a `USE_INDEPENDENT_AUDITOR=1` second pass.
3. **Loop closed:** unit committed → pushed → PR'd → baton rewritten (Current -> NEXT) → merged.
4. **Local == GitHub:** `git status` clean · `git fetch && git log origin/<branch>..HEAD` empty · PR head matches what was tested.
5. **No `[skip ci]`** on the final baton-rewrite commit (so CI runs on the head).
6. **Session note** written to `artifacts/frontier-al/session-notes/YYYY-MM-DD-<topic>.md`.

## 🛑 HARD RULES / off-limits (absolute)
- No funds/ASA/transfer code toward mainnet without **`/mainnet-gate` PASS + `algo-auditor` PASS** (both required).
- **Don't merge `wip/atomic-purchase`**; nothing in `ops/kestra/` may point at mainnet.
- Don't reintroduce mock/demo data into plot/HUD surfaces (they are live, server-driven).
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- **Standing mainnet-gate item:** `VITE_DEV_MODE` + `DEV_LOGIN_ENABLED` ship `'true'` in prod `fly.toml` — deliberate for TestNet; M3-4 is the exit path.
- **Do NOT unify `mem.ts`/`db.ts`** game methods (combat/economy divergence risk).
- Pre-deploy: migrations `0000`–`0012` applied; `VITE_TEST_GLOBE` reads `false`; keep `SESSION_SECRET` stable.
- **Standing owner directive:** proceed without asking when approval is a foregone conclusion; still one-PR-at-a-time and HARD RULES remain absolute.
- One open PR at a time; never commit to `main` directly; never over-claim — say "untested" when untested.
