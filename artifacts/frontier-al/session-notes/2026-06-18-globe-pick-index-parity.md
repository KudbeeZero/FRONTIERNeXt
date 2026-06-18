# 2026-06-18 — Globe pick-index + client≡server Fibonacci parity

## Unit
Implement `perf/globe-pick-index-parity` (SCOPE_BRIEF §7 Option A, owner-approved next
unit after #64 merged): replace the O(n) globe-selection scan with a deterministic spatial
pick-index, and add the missing client≡server Fibonacci parity test. One unit, one fresh
branch off `main` (which now contains the merged #64).

## What shipped (4 files, all under `client/`)
- **`client/src/lib/globe/pickIndex.ts`** (new) — `buildPickIndex(positions, cellSize?)`:
  uniform 3D voxel-hash grid + expanding Chebyshev-ring nearest search with a provable
  early-stop bound (`stop after ring r when sqrt(bestD2) < r*cellSize`). Returns the
  **byte-identical** index the old brute-force scan did, including its lowest-index
  tie-break. Pure (no THREE/DOM), node-testable. Min-cell-size clamp guards the packed
  cell key from overflow under a pathological `cellSize`.
- **`client/src/components/game/globe/GlobeParcels.tsx`** — `nearestPlot` now delegates to
  a `useMemo`'d `buildPickIndex(plotPositions3D)` behind the **same signature**. The 21k
  distance² compares per pointer event are gone. (Also: stale comment fixed.)
- **`client/tests/globe-fibonacci-parity.spec.ts`** (new) — the load-bearing §4.1 guard
  (previously absent): client `globeUtils.generateFibonacciSphere` ≡ server
  `sphereUtils.generateFibonacciSphere` on `(count, plotId, lat, lng)` for 50/1000/21000,
  plus shared-constant + polar-band checks.
- **`client/tests/globe-pickindex.spec.ts`** (new) — equivalence vs brute force over 400
  on-/off-radius/out-of-bounds random queries × {200, 21000}; exact index→plot mapping
  (off-by-one guard); determinism; pole/dateline edges; exact-tie tie-break; degenerate
  (empty/single) inputs.

## Selection behavior
**Unchanged.** `nearestPlot` returns the same index for the same input — proven against the
exact previous brute-force loop in `globe-pickindex.spec.ts`. Render output identical.

## Design decisions
- **No shared/canonical generator.** Unifying the two Fibonacci generators would require
  editing `server/storage/*` import sites — off-limits SQL/storage code. The brief (§4.1)
  and the task both sanction "separate impls + strict parity test"; that's what shipped.
- **`globeProjection.ts` (§6 seam) deferred.** The documented `worldToScreen`/`surfaceHit`
  interface is screen/camera-based; `GlobeParcels` consumes R3F's already-unprojected
  `e.point`, so wiring a screen-based seam now means re-implementing picking (redesign,
  out of scope) or shipping dead code. Defer to the combat package that will consume it.

## Verification
- `check` (tsc) ✓
- client `test` **69 passed** (12 files; was 57 — +12 new globe assertions)
- `test:server` **279 passed | 7 skipped** (unchanged — no server code touched)
- `build` ✓

## Review
Two independent review agents (correctness + integration/scope): algorithm confirmed
equivalent to brute force (independent 150k-query fuzz incl. ties/out-of-bounds), no unused
symbols, hook deps preserve identity, no HARD-RULE/scope breach. Their findings (cell-key
overflow foot-gun; untested off-radius + tie-break paths) were addressed (min-cell clamp +
strengthened tests).

## Open risks / notes
- Pick-index correctness is **test-backed in CI** (client step). Not browser-verified —
  a manual globe click-test is a good owner check (selection should feel identical, snappier
  on pointer-move).
- Far out-of-bounds queries scan more rings (still correct); irrelevant in production
  (clicks are on-surface).
- `globeProjection.ts` seam still owed to a future unit (combat package).
