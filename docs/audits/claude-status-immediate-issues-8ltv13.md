# Retro-audit — PR #65 (Globe pick-index + client≡server Fibonacci parity)

- **Auditor chat / branch:** `claude/status-immediate-issues-8ltv13`
- **Date:** 2026-06-18
- **Subject PR:** **#65** — `perf/globe-pick-index-parity`
- **Merge:** `d6f6653` (clean 2-parent merge of `fe1c3ab` + feature commit `3727b68`)
- **CI on the merge head:** run **#198 = success** (`ci.yml`, branch `main`)
- **Verdict:** **PASS** *(retro / non-blocking — #65 was already merged into `main` before this audit ran)*

## Why this is a retro-audit

The baton (`docs/HANDOFF.md`) described #65 as the single **open** PR in
`AWAITING_AUDIT` with "Do NOT auto-merge — owner merges." In fact #65 had **already
been merged** into `main` (`d6f6653`). It therefore landed **before** the start-of-chat
`/handoff-audit` ran — the same "merged by owner before audit" pattern the baton
already records for #52 and #61. This audit reconstructs the independent diff-vs-claims
review that the merge skipped, and the baton is repaired in the same unit.

This is **doc/audit-only.** No code was changed.

## Scope of the change (verified against the merged diff)

Single commit `3727b68`, **6 files, +453 / −34**:

| File | Kind | Note |
|---|---|---|
| `artifacts/frontier-al/client/src/lib/globe/pickIndex.ts` | new (136) | `buildPickIndex` — 3D voxel-hash grid + expanding Chebyshev-ring nearest search |
| `artifacts/frontier-al/client/src/components/game/globe/GlobeParcels.tsx` | mod (±21) | `nearestPlot` delegates to a `useMemo`'d index; O(n) per-event scan removed |
| `artifacts/frontier-al/client/tests/globe-pickindex.spec.ts` | new (143) | equivalence vs inlined brute-force oracle + edges/tie-break/degenerate |
| `artifacts/frontier-al/client/tests/globe-fibonacci-parity.spec.ts` | new (66) | client `globeUtils` ≡ server `sphereUtils` on `(count, plotId, lat, lng)` |
| `artifacts/frontier-al/session-notes/2026-06-18-globe-pick-index-parity.md` | new (60) | session note |
| `docs/HANDOFF.md` | mod (±61) | baton rewrite (now stale → repaired by this unit) |

Production code touched is **client-only**: `pickIndex.ts` (new) + `GlobeParcels.tsx`.
**No** server / storage / economy / token / battle / dashboard / loot-box / schema /
dependency / lockfile changes. Confirmed by enumerating the changed-file list.

## Claims checked against evidence

| Baton/PR claim | Evidence | Status |
|---|---|---|
| Scope client-only / additive; no server/storage/economy/token/battle/dashboard/loot-box/schema/deps | changed-file list = 4×`client/**` + 1 session-note + `docs/HANDOFF.md` | **VERIFIED** |
| `nearestPlot` keeps the same signature, delegates to a memoized index | `GlobeParcels.tsx` patch: `const pickIndex = useMemo(() => buildPickIndex(plotPositions3D), …)`; `nearestPlot = useCallback((px,py,pz) => pickIndex.nearest(px,py,pz), [pickIndex])` | **VERIFIED** |
| Parity test compares **both** generators | `globe-fibonacci-parity.spec.ts` imports `clientGen` (`../src/lib/globe/globeUtils`) **and** `serverGen` (`../../server/sphereUtils`); asserts `c.plotId===s.plotId`, `c.lat===s.lat`, `c.lng===s.lng` for counts 50/1000/21000 | **VERIFIED** |
| Pick-index returns the same index as the old brute scan (incl. lowest-index tie-break) | `globe-pickindex.spec.ts` defines its **own inlined `bruteNearest`** oracle (independent of the implementation) and asserts equality over 400 random queries × {200, 21000}, exact tie-break, index→plot mapping, pole/dateline edges, degenerate inputs — **all green** | **VERIFIED (test-backed)** |
| `check` ✓ · client `test` 69 · `test:server` 279/7-skip · `build` ✓ | reproduced this audit: `check` ✓; client `test` **69 pass / 12 files**; `test:server` **279 pass / 7 skipped**; the 2 new specs **12 pass / 2 files** targeted | **VERIFIED** (build not re-run — covered by CI #198) |
| "Two independent review agents" reviewed the algorithm (session note) | no artifact in-repo; not reproducible | **NOT VERIFIED** (claimed-only; non-blocking) |
| "byte-identical" / browser feel | algorithm equivalence is test-backed; "byte-identical" is the author's wording and visual/browser behavior is **not** browser-verified | **PARTIAL** — equivalence proven by test; visual unverified |

## Tests/checks run in this audit

```
pnpm --filter @workspace/frontier-al run check       → tsc clean
pnpm --filter @workspace/frontier-al run test        → 69 passed (12 files)
pnpm --filter @workspace/frontier-al run test:server → 279 passed | 7 skipped (36 files)
npx vitest run client/tests/globe-pickindex.spec.ts \
               client/tests/globe-fibonacci-parity.spec.ts → 12 passed (2 files)
```

`test:server` count is **unchanged** from pre-#65 (279/7-skip), corroborating that no
server code path was altered.

## Findings

1. **Process (meta):** #65 was merged before audit. Not a code defect; main's CI head
   (#198) is green and the change is independently re-verified here. Recorded so the
   pattern is visible. Going forward the owner has locked **one active PR at a time**.
2. **Non-blocking:** the "two independent review agents" claim in the session note has
   no in-repo artifact — treat as unverifiable narrative, not evidence.
3. **Non-blocking (carried):** pick-index correctness is test-backed in CI but **not**
   browser-verified — a manual globe click-test remains a good owner sanity check.
4. **No HARD-RULE breach:** no funds/ASA/chain/canvas-render-behavior change; selection
   resolves to the same plot (proven against brute force). Globe is client-side, so the
   `coverage:server` game-math gate is unaffected.

## Conclusion

**PASS (retro).** The merged #65 matches its stated scope and claims; the equivalence
and parity guarantees are backed by tests that pass independently of the implementation.
Main is green at `d6f6653`. No follow-up code fix is required. The only action owed —
repairing the stale baton — is performed in this same unit.
