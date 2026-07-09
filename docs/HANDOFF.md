# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** `chore/ts7-migration-scan` — TS7 migration blast-radius scan only, **not** the TS7 migration.
- **Branch:** `chore/ts7-migration-scan` (merged + deleted)
- **PR:** #236 · **MERGED**
- **Status:** done — TS7 migration **scan** lane **closed**. Scan change: `docs/audits/chore-ts7-migration-scan.md` only. No TS7 installed, no dependencies upgraded, no source files edited.
- **Closeout facts:**
  - PR #236 merged.
  - TS7 migration scan complete.
  - Root TS `~5.9.3`; frontier-al / aether-journey `5.6.3`.
  - Baseline timing unavailable in scan container because `node_modules` absent.
  - Protected paths remain untouched.
  - Auth cleanup branch remains parked.
  - Migration blocked until owner clears: minimumReleaseAge / TypeScript release-age decision; Node types alignment decision; esbuild bump decision.
  - Next lane: `chore/ts7-migration` only after owner gate approval.
- **Active lane:** none. No open PR/lane.

## NEXT
- **Next lane:** **NOT** the full TS7 migration unless owner approves the gates surfaced in the scan.
- **Owner decisions needed before migration starts:**
  1. **TypeScript release age:** wait for TS7 package age ≥1440 min or add a TypeScript release-age exception in `minimumReleaseAgeExclude`.
  2. **Node types alignment:** align `@types/node` across packages or leave each package on its own Node-version-appropriate `@types/node`.
  3. **esbuild bump:** decide whether `esbuild` bump is allowed given current pin.
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
