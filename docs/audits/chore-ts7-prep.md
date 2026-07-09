# chore/ts7-prep

## Verdict
- pass

## CI status
- PR #235 branch: chore/ts7-prep
- Checks at review time: Typecheck & server tests SUCCESS, Cloudflare Pages pass
- Head commit: 3ee8707
- All GitHub Actions checks green on PR head

## Kilo efficiency notes added
- `docs/audits/kilo-efficiency-notes.md` created

## Same-lane TS config review
- Scanned all `tsconfig*.json` files across the workspace
- Frontier-al already upgraded to ES2022 (done in this PR)
- No targets below ES2021 remain
- No `ignoreDeprecations` present
- All missing types already present where needed
- api-server `moduleResolution: "bundler"` tested and reverted:
  - Temporarily switched to `node16` to verify TS7-prep alignment
  - Failed typecheck due to `module` / `moduleResolution` pairing requiring explicit file extensions
  - Reverted because change would force source-code import-extension edits (out of same-lane scope)

## Claims vs evidence
- claim: repo remains on existing TypeScript
  evidence: no package.json TypeScript version changed; root still at ~5.9.3, frontier-al and aether-journey still at 5.6.3
- claim: no TS7 installed
  evidence: `npm view` confirmed TS7 7.0.2 is available on npm but was not installed; workspace dependencies unchanged
- claim: config cleanup only
  evidence: only `artifacts/frontier-al/tsconfig.json` was modified (target ES2020 → ES2022); no source code touched
- claim: protected paths untouched
  evidence: no files in `artifacts/frontier-al/server/services/chain/` or `artifacts/frontier-al/server/auth.ts` were modified
- claim: game/globe/combat behavior untouched
  evidence: no files in `artifacts/frontier-al/client/src/lib/globe/` or `artifacts/frontier-al/client/src/lib/battle/` were modified

## Files changed
| File | Change | Reason |
|------|--------|--------|
| `artifacts/frontier-al/tsconfig.json` | target: ES2020 → ES2022 | Align with tsconfig.base.json baseline; safe upgrade |
| `docs/audits/chore-ts7-prep-scan.md` | added | Read-only scan audit |
| `docs/audits/chore-ts7-prep.md` | updated | This prep audit + efficiency notes + api-server moduleResolution test record |
| `docs/audits/kilo-efficiency-notes.md` | added | Kilo run learnings |

## Tests
- `pnpm run typecheck` — clean (root + api-server + scripts)
- `pnpm --filter @workspace/frontier-al run check` — clean
- `pnpm --filter @workspace/frontier-al run test:server` — 480 passed, 24 skipped
- `pnpm --filter @workspace/frontier-al run test` — 355 passed

## Scope-creep check
- No auth cleanup: confirmed (auth branch untouched)
- No WebGL/context-loss backlog work: confirmed (parked)
- No broken-image backlog work: confirmed (parked)
- No funds/on-chain edits: confirmed (server/services/chain untouched)
- No lockfile changes: confirmed
- No package version changes: confirmed

## NOT verified
- Full TS7 migration compatibility not tested (out of scope)
- api-server `moduleResolution: "bundler"` vs Node.js correctness not changed (would require source-code import-extension edits)
- `@typescript/native-preview` interaction not tested (separate from Microsoft TypeScript)

## Next lane
- merge this prep PR, then later TS7 migration scan only
