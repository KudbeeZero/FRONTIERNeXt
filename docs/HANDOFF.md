# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** `fix/frontier-background-loop-cost-control` — reduce recurring Neon compute / data-transfer from production background loops.
- **Branch:** `fix/frontier-background-loop-cost-control` (open, awaiting owner)
- **PR:** #243 · **OPEN, CI GREEN, mergeStateStatus CLEAN, NOT MERGED** (owner review/merge required)
- **Status:** done in-session, awaiting owner merge.
- **Closeout facts:**
  - PR #242 (gamertag auth + recovery) **merged** (squash `fa5b125`) into `main`.
  - PR #243 (cost-control) open on `fix/frontier-background-loop-cost-control`, CI green.
  - Fly health endpoint `https://frontiernext.fly.dev/health` returns 200.
  - AI scheduler cadence: hardcoded 20s → `AI_TURN_INTERVAL_MS` default 120s (floor 30s). 4,320 → 720 runs/day (−83.3%).
  - Parcel query: `SELECT *` → 17-field projection.
  - Debuff cleanup: moved out of 5s resolver to own `DEBUFF_CLEANUP_INTERVAL_MS` default 60s (floor 10s), combined into one bounded UPDATE.
  - `gameMeta.currentTurn` kept unconditional (proven dependency); documented in `docs/memory/FRONTIER_BACKGROUND_LOOP_COST_CONTROL.md`.
- **Active lane:** PR #243 awaiting owner merge.

## NEXT
- **Next lane:** owner review/merge of PR #243, then **Fly env values**: `AI_TURN_INTERVAL_MS=120000`, `DEBUFF_CLEANUP_INTERVAL_MS=60000`, `AI_ENABLED=true`, `AI_MAX_ACTIVE_BATTLES=12`. Then production verification (Fly logs, AI battles still resolve, debuffs still clear) and original-tester gamertag retest.
- **Off-limits:** standard HARD RULES below. Do NOT touch `server/services/chain/`, transaction amounts, ASA destinations, or the parked auth cleanup branch. Do **not** start `chore/ts7-migration` until owner approves.

## Last result (for fast auditor sanity-check)
- **Shipped:** TS7 migration scan — `docs/audits/chore-ts7-migration-scan.md` only. No TS7 installed, no dependencies upgraded, no source files edited. Scan surfaced gates:
  - `minimumReleaseAge: 1440` / TypeScript not excluded (`minimumReleaseAgeExclude`) → may block fresh TS7 install.
  - TS version mismatch: root ~5.9.3 vs frontier-al 5.6.3 vs aether-journey 5.6.3.
  - `@types/node` mismatch: catalog ^25.3.3 vs frontier-al 20.19.33.
  - `esbuild` pinned 0.27.3 may need a bump decision.
  - Vite target `es2020` vs tsconfig `ES2022` mismatch noted.
  - `allowImportingTsExtensions: true` present in frontier-al / aether-journey / mockup-sandbox.
  - `api-server` `node16` trial from prior lane failed and reverted.
- **Verified (from PR #236):** CI green (Typecheck & server tests, Cloudflare Pages). Recorded local tests green: root typecheck clean · `frontier-al run check` clean · `test:server` **480 passed / 24 skipped** · `test` **355 passed**.
- **TS7 status:** TS7 stable reported as **7.0.2**; `@typescript/native-preview` still preview-only. **No TS7 installed, no TypeScript upgraded.** This lane is scan only.
- **Scope:** docs only. Zero funds/ASA/wallet/on-chain/mainnet/auth/globe/combat files touched. Protected paths untouched.
- **Self-audit:** `docs/audits/chore-ts7-migration-scan.md` — no funds/ASA/auth lanes touched, so no independent auditor required.
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
