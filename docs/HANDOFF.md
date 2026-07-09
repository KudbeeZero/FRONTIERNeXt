# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** `chore/handoff-end-to-end` — collapse the inter-chat relay into one `/ship` orchestrator.
- **Branch:** `chore/handoff-end-to-end`
- **PR:** #<PR> · **MERGED**
- **Status:** done — baton split, `/ship` added, `handoff-audit`/`closeout`/`end-session` refactored into the relay; game/chain code untouched.

## NEXT
- **Proposed branch:** `feat/weapon-damage-settlement` (M2-1)
- **Scope (one line):** W1 — weapon fire computes damage (`server/weapons/engagementStore.ts`) but never settles it onto plot state; add the tick that sets `"impacted"` and applies damage. Read the engagement store + plot mutation paths before scoping.
- **Open risks:** none identified yet (needs read-through of engagement store + plot state mutation paths).
- **Off-limits:** standard HARD RULES below. Do NOT touch `server/services/chain/`, transaction amounts, or ASA destinations.

## Last result (for fast auditor sanity-check)
- **Shipped:** `/ship` skill (single end-to-end orchestrator); concise split baton (`HANDOFF.md` ≤80 lines + `HANDOFF_LOG.md` full history); `handoff-audit`/`closeout`/`end-session` refactored into the relay; `SESSION_PROTOCOL.md`, root `CLAUDE.md`, `docs/audits/README.md` updated to match.
- **Verified:** `check` clean · `test:server` <N>/<N> · `test` <N>/<N> (pre-existing counts; none deleted or skipped).
- **Scope:** touches ONLY `docs/**`, `.claude/skills/**`, `CLAUDE.md`, `artifacts/frontier-al/session-notes/**`. Zero `.ts/.tsx`/game/chain files changed.
- **Self-audit:** `docs/audits/chore-handoff-end-to-end.md` — no funds/ASA/auth lanes touched, so no independent auditor required (`USE_INDEPENDENT_AUDITOR` not needed).

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
