# chore/ts7-prep-scan

## Verdict
- Ready for TS7 prep PR: yes (limited, safe scope)
- Blocked: no
- Needs owner decision: no

## Current repo state
- main commit: a279a81 (docs: update handoff after z-index recovery closeout)
- PR status: no open PRs
- CI status: green on main run 29012082144
- worktree status: clean

## TypeScript release reality
- npm dist-tags:
  - latest: 7.0.2
  - next: 7.1.0-dev.20260708.3
  - beta: 6.0.0-beta
  - rc: 7.0.1-rc
- native-preview status: preview-only (7.0.0-dev.20260707.2)
- stable TS7 available: yes (7.0.2 is stable GA)
- migration recommendation: do not migrate today; this lane is TS6-safe prep only

## Workspace map
| Package | Path | TS version | check/typecheck script |
|---------|------|------------|------------------------|
| workspace (root) | . | 5.9.3 | typecheck:libs (tsc --build) |
| @workspace/frontier-al | artifacts/frontier-al | 5.6.3 | check (tsc) |
| @workspace/aether-journey | apps/aether-journey | 5.6.3 | check (tsc --noEmit) |
| @workspace/api-server | artifacts/api-server | (inherits) | typecheck (tsc -p) |
| @workspace/mockup-sandbox | artifacts/mockup-sandbox | (none) | typecheck (tsc -p) |
| @workspace/db | lib/db | (none) | (none — build only) |
| @workspace/api-client-react | lib/api-client-react | (none) | (none) |
| @workspace/api-zod | lib/api-zod | (none) | (none) |
| @workspace/scripts | scripts | (none) | typecheck (tsc -p) |

## tsconfig findings
| File | target | module | moduleResolution | baseUrl | paths | types | strict | flags |
|------|--------|--------|------------------|---------|-------|-------|--------|-------|
| tsconfig.base.json | es2022 | esnext | bundler | — | — | [] | partial | — |
| tsconfig.json | extends base | — | — | — | — | — | — | — |
| apps/aether-journey/tsconfig.json | ES2022 | ESNext | bundler | — | — | — | true | — |
| artifacts/frontier-al/tsconfig.json | ES2020 | ESNext | bundler | . | @/*, @shared/* | node, vite/client | true | **target below ES2022** |
| artifacts/api-server/tsconfig.json | (base es2022) | (base esnext) | bundler | — | — | node | — | Node server inherits bundler resolution |
| artifacts/mockup-sandbox/tsconfig.json | (base es2022) | (base esnext) | bundler | — | @/* | node, vite/client | — | — |
| lib/db/tsconfig.json | (base es2022) | (base esnext) | bundler | — | — | node | — | — |
| lib/api-client-react/tsconfig.json | (base es2022) | (base esnext) | bundler | — | — | — | — | — |
| lib/api-zod/tsconfig.json | (base es2022) | (base esnext) | bundler | — | — | — | — | — |
| scripts/tsconfig.json | (base es2022) | (base esnext) | bundler | — | — | node | — | — |

### Flags
- **moduleResolution node or node10**: none found (all use bundler)
- **baseUrl + paths**: frontier-al and mockup-sandbox have baseUrl/paths — Vite/bundler pattern, safe to leave
- **target below ES2021**: frontier-al uses ES2020 — safe to upgrade to ES2022
- **missing explicit types arrays**: none (all packages that need node/vite/client types have them)
- **ignoreDeprecations**: none present
  - **inherited config risks**: api-server inherits `moduleResolution: "bundler"` from base despite being a Node.js server — tested and reverted; switching to `node16` requires explicit file extensions on all imports, which is a source-code change outside TS6-safe scope

## Compiler API/tooling findings
- ts-morph: not found
- ts-jest: not found
- typescript-eslint: only `@typescript-eslint/no-namespace` disable comment in auth.ts (not compiler API usage)
- require('typescript') / from 'typescript': not found in source
- tsserver: not found
- custom transformer: not found
- tsc: used in scripts only (typecheck, build)
- tsgo: not found

Classification:
- likely safe: all tooling is standard tsc/vitest/vite
- may need TS6 legacy pin later: none identified
- requires investigation: none
- not applicable: no compiler-API usage found

## Protected path map
- funds/ASA/on-chain/wallet/mainnet/transfer code: `artifacts/frontier-al/server/services/chain/` (asa.ts, transferQueue.ts, mintRetryQueue.ts, refund.ts, delivery.ts, eligibility.ts, land.ts, upgrades.ts, weapon.ts, client.ts, commander.ts)
- auth: `artifacts/frontier-al/server/auth.ts` (parked branch — do not touch)
- AlgoKit/PuyaTs: not found in repo; Algorand interaction uses `algosdk` directly, separate from Microsoft TypeScript tooling
- do-not-touch notes: TS7 prep must not modify any file in `server/services/chain/` or `server/auth.ts`

## Game/globe/combat risk map
- risk files/areas:
  - `artifacts/frontier-al/client/src/lib/globe/` — globe rendering
  - `artifacts/frontier-al/client/src/lib/battle/` — battle cinematics, sequence, scars
  - `artifacts/frontier-al/client/src/pages/game.tsx` — game page
- WebGL/context-loss backlog: parked design/backlog item only — do not fix today
- broken-image backlog: parked design/backlog item only — do not fix today
- do-not-touch notes: TS7 prep must not modify any file in `client/src/lib/globe/` or `client/src/lib/battle/`

## Recommended prep changes
1. **frontier-al tsconfig.json**: change `"target": "ES2020"` → `"target": "ES2022"` (aligns with base config; safe upgrade)
 2. No other config changes recommended today:
    - moduleResolution: all packages correctly use `bundler` for Vite; api-server was tested with `node16` and reverted — requires explicit file extensions on imports, which is a source-code change outside TS6-safe scope
    - baseUrl + paths: Vite resolves these at build time; no TS7 prep change needed
    - types arrays: all present where needed
    - ignoreDeprecations: none present

## NOT verified
- Full TS7 migration compatibility not tested (out of scope for this lane)
- api-server moduleResolution correctness for TS7: tested by temporarily switching to `node16`; failed due to `module`/`moduleResolution` pairing; reverted per scope rules
- @typescript/native-preview interaction with repo not tested (separate from MS TypeScript)
