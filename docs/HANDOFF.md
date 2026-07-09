# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** `chore/ts7-prep` — TS7 prep only, **not** the TS7 migration.
- **Branch:** `chore/ts7-prep` (merged + deleted)
- **PR:** #235 · **MERGED**
- **Status:** done — TS7 **prep** lane **closed**. Prep change: `artifacts/frontier-al/tsconfig.json` target `ES2020` → `ES2022`. Plus docs: `docs/audits/chore-ts7-prep-scan.md`, `docs/audits/chore-ts7-prep.md`, `docs/audits/kilo-efficiency-notes.md`. No game/globe/combat behavior changed.
- **Active lane:** none. No open PR/lane.

## NEXT
- **Proposed branch:** `chore/ts7-migration-scan` (read-only dedicated scan — NOT the migration)
- **Scope (one line):** a dedicated TS7 migration scan that inventories exactly what a TS7 migration would touch and surfaces protected-path risk; produce a scan report only. Do **not** start the full TS7 migration.
- **Open risks:** TS7 migration itself is large/high-blast-radius — keep this lane read-only until the scan confirms no protected-path risk.
- **Off-limits:** standard HARD RULES below. Do NOT touch `server/services/chain/`, transaction amounts, ASA destinations, or the parked auth cleanup branch.

## Last result (for fast auditor sanity-check)
- **Shipped:** TS7 prep — `artifacts/frontier-al/tsconfig.json` (target `ES2020` → `ES2022`, single line), plus three audit/efficiency docs.
- **Verified (from PR #235):** CI green (Typecheck & server tests, Cloudflare Pages). Recorded local tests green: root typecheck clean · `frontier-al run check` clean · `test:server` **480 passed / 24 skipped** · `test` **355 passed**.
- **Config test that was reverted:** `api-server` `moduleResolution: node16` was trialed and reverted because the `module`/`moduleResolution` pairing would force source import-extension churn. No source import-extension edits landed.
- **TS7 status:** TS7 stable reported as **7.0.2**; `@typescript/native-preview` still preview-only. **No TS7 installed, no TypeScript upgraded.** This lane is prep only.
- **Scope:** config + docs only. Zero funds/ASA/wallet/on-chain/mainnet/auth/globe/combat files touched. Protected paths untouched.
- **Self-audit:** `docs/audits/chore-ts7-prep.md` — no funds/ASA/auth lanes touched, so no independent auditor required.
- **Parked:** the **auth cleanup branch** remains parked and must NOT be merged without owner approval.

## Kilo Efficiency Profile (post-closeout)
- prior observed prompt context use: ~16%; current target: ~40%. Use the extra context for **more verification**, not wider scope.
- best terminal commands: `git status --short` · `gh pr checks <n>` · `gh pr diff <n> --name-only` · `gh run list --limit 5`.
- strongest future prompt pattern: main task → one same-lane adjacent fix → efficiency notes → terminal verification → **Asked / Done / Needs you**.
- workflow notes: session folder may be the repo root (normal); `rg` may be missing → use `grep`/`find`; `pnpm install --frozen-lockfile` is allowed when `node_modules` is missing (locks existing deps only, NOT a TS7 install); temp paths may be blocked → workspace edit + revert-on-fail is acceptable for config experiments; terminal verifies PR files/checks as source of truth; use a same-lane adjacent fix only if proven.

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
