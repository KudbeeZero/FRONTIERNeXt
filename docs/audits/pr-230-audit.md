# Audit — PR #230 `fix(chain): pin ASCEND ASA via ASCEND_ASA_ID env var + startup assert`

**Head SHA:** `ff6befa5b5a0c4eeac05eb21d1ba24d526fc6332` · base `main` · branch `fix/pin-ascend-asa`
**Milestone:** M1-4 (Phase 25 queue)
**Audited by:** independent subagent, 2026-07-08

## Claim-by-claim verification

| # | Claim | Evidence | Verdict |
|---|-------|----------|---------|
| 1 | `getPinnedAscendAsaId()` added in `services/chain/asa.ts` | `asa.ts:30-46` — reads `process.env.ASCEND_ASA_ID`, `Number()` parse, `!Number.isInteger \|\| <=0` throws, returns null when unset | ✅ |
| 2 | `getOrCreateAscendAsa()` checks env (step 2) before on-chain lookup (step 3) | `asa.ts:145-151` pin block inserted *before* `lookupAsaByCreator` at `:157`; comments renumbered 2→3→4 | ✅ |
| 3 | `assertChainConfig()` validates `ASCEND_ASA_ID`, fails fast on invalid | `client.ts:146-156`; called unguarded at `server/index.ts:212` (no try/catch) → throw propagates = real boot crash | ✅ |
| 4 | `ENV_VARS.md` + `DEPLOYMENT_ENV_CHECKLIST.md` updated | `ENV_VARS.md:+13`; checklist adds `ASCEND_ASA_ID [REQ][SEC]` row | ✅ |
| 5 | 13 new regression tests in `asa.spec.ts` | new file, 103 lines; 7 assert-config + 6 helper = 13 | ✅ |
| 6 | "All 471 server tests pass (up from 458)" | Independently reproduced: **471 passed \| 24 skipped** | ✅ |
| 7 | `pnpm run check` clean | ran `tsc` → **exit 0** | ✅ |
| 8 | `build` clean | not re-run (time budget) | ⚠️ unverified, low risk |
| 9 | No mainnet constants hardcoded, no out-of-scope chain behavior | Only `755818217` (TestNet) appears, in docs only; no mainnet strings/IDs in code | ✅ |

## Test run (independently reproduced)
- `vitest run asa.spec.ts`: 13 passed
- `pnpm --filter @workspace/frontier-al run test:server`: 57 files passed / 7 skipped, 471 tests passed / 24 skipped, 9.12s
- `pnpm --filter @workspace/frontier-al run check` (tsc): exit 0

## Scope
6 changed files: the 5 claimed + `docs/HANDOFF.md` (baton update, expected by protocol). No scope creep. Diff +159/−6.

## Security findings
- Fail-fast confirmed: invalid `ASCEND_ASA_ID` throws in `assertChainConfig()`, called unguarded at boot — no silent fallback.
- No NaN slip-through (`Number.isInteger(NaN) === false`); zero/negative/float rejected; empty string treated as unset (intentional).
- No mainnet ASA ID or mainnet network string hardcoded anywhere in the diff.
- Minor accepted-risk note: `Number()` parsing is lenient (`"1e3"`, hex, whitespace would parse to a valid positive int). Not a vulnerability — still resolves to a valid positive integer, no injection surface — but a stricter `/^\d+$/` regex would be tighter. Not a blocker.
- Test-naming nit: `"rejects empty string"` actually asserts `not.toThrow` (empty = unset by design). Behavior correct; name is misleading. Not a blocker.

## Could not verify
- Live server boot with `ASCEND_ASA_ID` set / actual on-chain pin behavior — PR's own "Honest gaps" section discloses this; not live-tested.
- `pnpm run build` not independently re-run this session (typecheck was clean; low risk).
- Pre-PR baseline (458) not re-run on `main` directly; arithmetic (471 − 13 = 458) is consistent with the claim.

## Verdict: PASS

Every load-bearing claim is backed by file:line evidence and independently reproduced. Fail-fast startup behavior is real (unguarded throw at `server/index.ts:212`). Scope confined to the claimed unit + baton. No hardcoded mainnet constants. This is a funds-lane change and — per its own disclosure — still requires `/security-pass` + TestNet click-test + owner approval before any mainnet consideration; that gate is unaffected by this merge.
