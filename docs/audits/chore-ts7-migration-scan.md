# TS7 Migration Scan — Blast Radius & Risk Map

**Date:** 2026-07-09  
**Scope:** Read-only inventory of a hypothetical TypeScript 7 migration.  
**Status:** Scan complete. No source changes, no dependency upgrades, no TS7 installed.

---

## 1. Baseline Timing

| Check | Status | Notes |
|---|---|---|
| `pnpm --filter @workspace/frontier-al run check` | **Untested** | `node_modules` absent in this ephemeral container; `tsc` not found. |
| `pnpm --filter @workspace/frontier-al run test:server` | **Untested** | Same — dependencies not installed. |
| `pnpm --filter @workspace/frontier-al run test` | **Untested** | Same — dependencies not installed. |
| `pnpm run typecheck` (root) | **Untested** | Same — dependencies not installed. |

**Previous-lane recorded baseline (from PR #235 / HANDOFF.md):**
- Root typecheck: clean
- `frontier-al run check`: clean
- `test:server`: **480 passed / 24 skipped**
- `test`: **355 passed**

> **Action required:** Baseline timings must be re-captured in an environment with `node_modules` present before any migration branch is cut.

---

## 2. Current TypeScript & Tooling Versions

| Package | Current TS | TS7 Target | Notes |
|---|---|---|---|
| Root (`package.json`) | `~5.9.3` | `^7.0.2` (or `~7.0.2`) | Hoisted workspace version. |
| `@workspace/frontier-al` | `5.6.3` | upgrade to match root | Explicit devDependency; may conflict with hoisting. |
| `@workspace/aether-journey` | `5.6.3` | upgrade to match root | Explicit devDependency. |
| `@workspace/scripts` | none | inherit root | Uses `catalog:` for `tsx`; no local TS pin. |
| `@workspace/api-server` | none | inherit root | No local TS pin. |
| `@workspace/mockup-sandbox` | none | inherit root | No local TS pin. |
| `@workspace/lib/*` | none | inherit root | No local TS pin. |

**Other tooling that interacts with TS compilation:**
- `vite`: `^7.3.1` (frontier-al), `^7.3.3` (aether-journey) — **Vite 7 is required for TS7 support.**
- `vitest`: `^4.1.0` — **Vitest 4 is required for TS7 support.**
- `tsx`: `^4.21.0` — TS7-compatible.
- `esbuild`: pinned to `0.27.3` via `pnpm-workspace.yaml` overrides (frontier-al requests `^0.25.0`). Older esbuild may need a bump to parse TS7 output cleanly.
- `@types/node`: catalog `^25.3.3`, but frontier-al explicitly pins `20.19.33`. **Mismatch risk.**

**`minimumReleaseAge` gate:**
- `pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` (1 day).
- `typescript` is **NOT** in `minimumReleaseAgeExclude`.
- **Implication:** TS7 `7.0.2` cannot be installed until it is ≥1 day old **unless** the owner approves adding `typescript` to `minimumReleaseAgeExclude` (or waits). This is a go/no-go gate.

---

## 3. tsconfig Inventory

### Root / Workspace
- **`tsconfig.json`** — Project references only (`lib/db`, `lib/api-client-react`, `lib/api-zod`). Extends `tsconfig.base.json`.
- **`tsconfig.base.json`** — Shared base:
  - `target: es2022`
  - `module: esnext`
  - `moduleResolution: bundler`
  - `lib: ["es2022"]`
  - `strictNullChecks: true`, `strictBindCallApply: true`, `strictPropertyInitialization: true`
  - `useUnknownInCatchVariables: true`
  - `skipLibCheck: true`
  - `types: []`
  - `customConditions: ["workspace"]`
  - **No** `importHelpers`, `downlevelIteration`, `experimentalDecorators`, `ignoreDeprecations`.

### `@workspace/frontier-al`
- **`tsconfig.json`**:
  - `include: ["client/src/**/*", "shared/**/*", "server/**/*"]`
  - `exclude: ["node_modules", "build", "dist", "**/*.test.ts"]`
  - `incremental: true`, `tsBuildInfoFile: "./node_modules/typescript/tsbuildinfo"`
  - `noEmit: true`
  - `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`
  - `strict: true`
  - `lib: ["esnext", "dom", "dom.iterable"]`
  - `jsx: preserve`
  - `esModuleInterop: true`
  - `skipLibCheck: true`
  - `allowImportingTsExtensions: true`
  - `baseUrl: "."`, `types: ["node", "vite/client"]`
  - `paths: { "@/*": ["./client/src/*"], "@shared/*": ["./shared/*"] }`

### `@workspace/aether-journey`
- **`tsconfig.json`**:
  - `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`
  - `useDefineForClassFields: true`
  - `lib: ["ES2022", "DOM", "DOM.Iterable"]`
  - `jsx: react-jsx`
  - `strict: true`
  - `allowImportingTsExtensions: true`
  - `isolatedModules: true`, `noEmit: true`

### `@workspace/api-server`
- **`tsconfig.json`** — Extends `../../tsconfig.base.json`.
  - `outDir: dist`, `rootDir: src`, `types: ["node"]`
  - References: `../../lib/db`, `../../lib/api-zod`

### `@workspace/scripts`
- **`tsconfig.json`** — Extends `../tsconfig.base.json`.
  - `outDir: dist`, `rootDir: src`, `types: ["node"]`

### `@workspace/lib/*`
- **`lib/db/tsconfig.json`** — Extends `../../tsconfig.base.json`. `composite: true`, `emitDeclarationOnly: true`.
- **`lib/api-zod/tsconfig.json`** — Same pattern.
- **`lib/api-client-react/tsconfig.json`** — Same pattern; `lib: ["dom", "es2022"]`.

### `@workspace/mockup-sandbox`
- **`tsconfig.json`** — Extends `../../tsconfig.base.json`.
  - `noEmit: true`, `jsx: preserve`, `esModuleInterop: true`
  - `allowImportingTsExtensions: true`
  - `types: ["node", "vite/client"]`
  - `paths: { "@/*": ["./src/*"] }`

---

## 4. Risk Map

### 4.1 Protected Paths (Do Not Edit Without Owner Approval)

| Path / Surface | Risk Tier | Rationale |
|---|---|---|
| `server/services/chain/` | **Critical** | On-chain ASA mint, transfer, Algorand network interaction. |
| `server/auth.ts` | **Critical** | Wallet-signature auth, session tokens. |
| `server/security.ts` | **Critical** | Centralized security guards. |
| `server/rateLimitStore.ts` | **High** | Rate limiting. |
| `server/idempotencyGuard.ts` | **High** | Replay protection. |
| `server/routeOwnership.ts` | **High** | Route authorization. |
| `server/stateScope.ts` | **High** | State scoping. |
| `client/src/components/game/globe/**` | **Critical** | Live 3D globe, server-driven plots. |
| `server/engine/battle/**` | **Critical** | Deterministic battle math, replay, tuning. |
| `server/engine/**` (economy/markets/AI) | **High** | Game behavior; must preserve determinism. |
| `server/services/priceOracle.ts` | **High** | Economy / price feeds. |
| Any `*.db.spec.ts` or DB storage files | **High** | DB schema / liquidity paths. |
| `docs/HANDOFF.md` | **Medium** | Baton file; changes require protocol update. |

### 4.2 Sensitive Code Surface Scan

**Compiler API usage:**
- **None found.** No `ts.createProgram`, `createSourceFile`, `createCompilerHost`, custom transformers, or `ts-node` loaders in source.

**Custom TS loaders / jiti:**
- **None found.** `jiti` is listed in `frontier-al/devDependencies` but not used in source scan results.
- `tsx` is used for running TS directly (`dev`, `sim`, `veritas`, `smoke:testnet`). TS7-compatible.

**Vite / Vitest interactions:**
- `vite.config.ts` uses `target: "es2020"` for build, while tsconfig targets `ES2022`. This mismatch already exists and is not introduced by TS7, but TS7 may tighten parsing or emit assumptions.
- `vitest.server.config.ts` uses Vite’s resolve aliases and node environment. Should be compatible with TS7 via Vite 7 / Vitest 4.

**`api-server` `node16` finding (previous lane):**
- **Reverted.** Current `api-server/tsconfig.json` does **not** contain `moduleResolution: node16`. It extends `tsconfig.base.json` (`moduleResolution: bundler`) and only adds `types: ["node"]`.

### 4.3 Blast Radius Summary

| Surface | TS7 Risk | Why |
|---|---|---|
| Hoisted TypeScript | **Medium** | Root pins `~5.9.3`; sub-packages pin `5.6.3`. Hoisting behavior under pnpm with mixed ranges needs verification. |
| `moduleResolution: bundler` | **Low–Medium** | Stable across TS versions, but TS7 may introduce new defaults or deprecations. |
| `allowImportingTsExtensions: true` | **Low** | TS7 may change `.ts`/`.tsx` extension semantics in ESM. |
| `skipLibCheck: true` | **Low** | Masks lib definition drift; TS7 may update `lib.d.ts` shapes. |
| `@types/node` mismatch | **Medium** | Catalog pins `^25.3.3`; frontier-al uses `20.19.33`. TS7 + Node 25 types may surface new errors. |
| `esbuild` 0.27.3 | **Medium** | Older esbuild may not parse TS7 syntax or may emit incorrect transforms. |
| Vite build target `es2020` vs TS target `ES2022` | **Low** | Existing mismatch; TS7 does not change Vite’s build target, but type checking vs emitting could diverge. |
| `tslib` absence | **Low** | No `importHelpers` in use, so TS7 runtime helpers are self-contained. |
| `minimumReleaseAge` 1-day gate | **Blocker** | Fresh TS7 releases cannot be installed without owner approval / exclusion. |

---

## 5. Likely Migration Steps (Read-Only Plan)

1. **Unblock `minimumReleaseAge`** — Owner must either:
   - Add `typescript` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`, **or**
   - Wait until TS7 stable is ≥1 day old.
2. **Bump workspace TypeScript** — Update root `package.json` from `~5.9.3` to `~7.0.2` (or `^7.0.2`).
3. **Align sub-package pins** — Update `@workspace/frontier-al` and `@workspace/aether-journey` `devDependencies.typescript` from `5.6.3` to match root (or remove explicit pin to rely on hoisting).
4. **Verify toolchain matrix** — Confirm Vite 7.x, Vitest 4.x, tsx 4.x, esbuild ≥0.27.3 are compatible. Bump esbuild if needed.
5. **Run full typecheck + test matrix** in order:
   - `pnpm install --frozen-lockfile` (or update lockfile if versions change).
   - `pnpm run typecheck`
   - `pnpm --filter @workspace/frontier-al run check`
   - `pnpm --filter @workspace/frontier-al run test:server`
   - `pnpm --filter @workspace/frontier-al run test`
   - `pnpm --filter @workspace/aether-journey run check` / `test` (if present).
6. **Fix compilation errors** — Address any new TS7 strictness, deprecated APIs, or lib changes. **Do not touch protected paths.**
7. **Audit diff** — Ensure zero modifications to protected paths, funds/ASA/wallet/chain/auth/globe/battle files.
8. **Update docs** — `docs/HANDOFF.md` baton, session notes, audit report.

---

## 6. Packages That May Need TS7 First

| Package | Reason |
|---|---|
| Root workspace | Hoisted TS is resolved from here. Must bump first. |
| `@workspace/frontier-al` | Largest blast radius; explicit TS pin. |
| `@workspace/aether-journey` | Explicit TS pin; Vite 7 + React 19 already present. |
| `@workspace/api-server` | Inherits root; no local pin, but must verify `tsc --build` references. |
| `@workspace/scripts` | Inherits root; `tsx` runner must support TS7 output. |

**Order recommendation:** Root → frontier-al → aether-journey → libs → api-server → scripts.

---

## 7. Recommended Migration Branch Name

**Actual migration branch:** `chore/ts7-migration`  
**This scan branch:** `chore/ts7-migration-scan`

---

## 8. Go / No-Go Criteria

### GO
- `pnpm install` succeeds with TS7 (after `minimumReleaseAge` gate is cleared).
- `pnpm run typecheck` passes.
- `frontier-al run check` passes.
- `frontier-al run test:server` passes (480+ passed, 0 new failures).
- `frontier-al run test` passes (355+ passed, 0 new failures).
- CI is green on the head commit.
- Diff contains **zero** changes to protected paths listed in §4.1.
- No source files modified outside `package.json`, `pnpm-lock.yaml`, and `tsconfig*.json` (unless explicitly approved by owner).
- `minimumReleaseAge` exemption is approved by owner **or** TS7 is ≥1 day old.

### NO-GO (abort / park)
- Any protected-path file is touched.
- Any test fails due to TS7 changes in game/globe/battle/chain/auth behavior.
- `minimumReleaseAge` blocks install and owner does not approve exemption.
- Vite 7 / Vitest 4 / esbuild incompatibility is discovered that cannot be resolved with safe version bumps.
- `@types/node` mismatch (catalog `^25.3.3` vs frontier-al `20.19.33`) causes widespread breakage that requires touching non-TS config.
- Rollback plan cannot be executed cleanly (e.g., lockfile corruption).

---

## 9. Expected Tests / Checks for Migration PR

| Command | Purpose |
|---|---|
| `pnpm install --frozen-lockfile` | Verify lockfile integrity after TS bump. |
| `pnpm run typecheck` | Root project-reference build. |
| `pnpm --filter @workspace/frontier-al run check` | Frontier-al typecheck. |
| `pnpm --filter @workspace/frontier-al run test:server` | Server unit tests + coverage gate. |
| `pnpm --filter @workspace/frontier-al run test` | Client unit tests. |
| `pnpm --filter @workspace/aether-journey run check` | Aether journey typecheck. |
| `pnpm --filter @workspace/api-server run typecheck` | API server typecheck. |
| `pnpm --filter @workspace/scripts run typecheck` | Scripts typecheck. |
| `pnpm run build` | Full build smoke test. |
| CI (GitHub Actions) | Green on head commit — required for merge. |

---

## 10. Rollback Plan

1. **Dependency-only revert:** If the migration PR contains only `package.json` + `pnpm-lock.yaml` + `tsconfig*.json` changes, rollback is a single revert commit (or reset to the pre-migration commit).
2. **TS version restore:** Re-pin root `typescript` to `~5.9.3` and sub-packages to `5.6.3` (or remove sub-package pins). Run `pnpm install` to regenerate lockfile.
3. **tsconfig restore:** Revert any `tsconfig*.json` changes (e.g., `ignoreDeprecations`, `target` tweaks). The previous lane left tsconfigs in a known-good state (frontier-al target `ES2022`).
4. **Toolchain restore:** If Vite/Vitest/esbuild were bumped, revert those pins too.
5. **Verification:** Run the same baseline test matrix to confirm green.
6. **Data / on-chain state:** **Unaffected.** TS migration does not touch runtime behavior, DB, or on-chain assets. No funds, ASA, wallet, or mainnet config changes are in scope.

---

## 11. Open Questions for Owner

1. **`minimumReleaseAge` exemption:** Approve adding `typescript` to `minimumReleaseAgeExclude`, or confirm TS7 `7.0.2` is ≥1 day old.
2. **`@types/node` alignment:** Approve bumping frontier-al from `20.19.33` to catalog `^25.3.3`, or keep the pin and accept the maintenance burden.
3. **esbuild bump:** Approve bumping esbuild from `0.27.3` if TS7 requires it.
4. **Scope boundary:** Confirm the migration PR must remain dependency + config only (no source behavior changes).

---

## 12. Phase Confirmation

| Phase | Result |
|---|---|
| **Phase 1 — Clean base** | Branch is `session/agent_4f50bba3-d9a2-4a3d-94f8-6fa45371a5b8` (not `main`); working tree clean; no open PRs; latest `main` CI success. |
| **Phase 2 — Baseline timing** | **Blocked:** `node_modules` missing; `tsc` not found. Previous-lane timings recorded above. |
| **Phase 3 — TS/tooling inventory** | Complete. 10 tsconfig files inventoried. |
| **Phase 4 — Risk map** | Complete. No custom compiler APIs, loaders, or ts-node usage found. |
| **Phase 5 — Scan doc** | This document. |
| **Phase 6 — Commit** | Pending owner action on `minimumReleaseAge` if an actual install is desired later. |
