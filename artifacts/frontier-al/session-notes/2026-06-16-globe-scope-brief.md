# 2026-06-16 — Globe Scope Brief

## What shipped
- New doc `artifacts/frontier-al/docs/globe/SCOPE_BRIEF.md` — a documentation-only
  scope brief for the globe (the baton's "NEXT chat" unit). No code changed.
- Captures: current capability inventory (per-component table), server→globe data
  flow (1.5s WS flush + out-of-band `weapon_engagement`), the as-is interaction model
  (coverage-sphere + O(n) nearest-neighbor snap — **not** a per-tile raycaster), the
  Fibonacci parity invariant, perf cost drivers at 21k tiles, a **pluggable globe
  interface spec** (`worldToScreen`/`surfaceHit`) for the future combat package, and an
  audit-checkable exit definition for the next unit.

## Key finding (reconciled honestly in §4.1)
- The HARD RULE "positions computed, never stored" and the code initially looked to
  conflict. Reality: the **server seeds + persists** positions once (`seeder.ts:191` →
  `parcels` table → `rowToParcel`), while the **client regenerates** them at runtime
  (`GlobeParcels.tsx:59`). Both true — which is exactly *why* client≡server Fibonacci
  parity is load-bearing: client plot index N must map to server parcel N or every tile
  renders wrong and picking selects the wrong parcel. There is **no parity test today**
  — flagged as the top item for the next unit.

## Multi-agent execution (this chat)
- Squad within one unit: A1 safety/constraints reviewer (PASS), A2 frontend globe
  characterizer, A3 backend data characterizer, A4 finalizer (assembled + verified).
  Coordinator ran gates and closed out.

## Verification (all green)
- `pnpm run typecheck` (root) — green
- `pnpm --filter @workspace/frontier-al run check` (tsc) — green
- `pnpm --filter @workspace/frontier-al run test:server` — **244/244 pass**
- Diff is doc-only (brief + this note + baton); no `client/`/`server/`/`shared/` code touched.

## Next unit (one PR, additive)
- Recommended: `perf/globe-pick-index` — replace the O(n) `nearestPlot` scan with a
  spatial index behind the same signature; land `globeProjection.ts` (the §6 seam) as
  its first real caller; add the client≡server Fibonacci parity test.
- Alternative: `feat/globe-mission-layer` (additive overlay; nullable schema).

## Off-limits (unchanged)
- No edits to battle engine / AI / globe render core / DB transactions off-hand.
- No funds/ASA/mainnet without `/mainnet-gate` PASS + `algo-auditor`; don't merge
  `wip/atomic-purchase`; no mock/demo data in plot/HUD surfaces.
