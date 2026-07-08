# 2026-07-08 — Economics panel formatter bug + investigation of known issues

## Session focus
Ran `/handoff-audit` on PR #226 (PASS, docs-only baton refresh, merged).
Then investigated 4 known issues from the baton backlog, fixed the highest-impact one.

## Investigation findings

### 🔴 #1 Economics panel — display bugs confirmed (FIXED this session)
- `fmt()` lacked a billions tier → Treasury (999.95M) and Total Supply (1B) both displayed "1000.0M"
- Hardcoded "0.5–1.5 ASCEND/hr" didn't match actual 50/day (testing) or 1/day (production) rates
- `protocolTreasury*` fields computed server-side but never displayed in any client surface
- **Fix**: Added billions tier + 2-decimal precision at millions scale; replaced hardcoded rate text with dynamic `data.emissionRatePerDay`

### 🟡 #2 WebGL context loss (G2) — confirmed zero handling
- 0 `webglcontextlost`/`webglcontextrestored`/`visibilitychange`/`pageshow`/`pagehide` listeners
- 27 `useFrame` hooks + 7 DOM rAF loops with no recovery
- Globe will freeze/go black after mobile tab backgrounds — owner should smoke-test
- Needs: context loss handler hook + visibility change listener + R3F invalidate
- Not fixed this session — design call needed on recovery UX

### 🟡 #3 CommTerminal z-40 + hud-drawer z-49 — below bottomNav z-50
- CommTerminal.tsx:122 `z-40` at `fixed bottom-20` = obscured by mobile bottom nav
- hud.css `.hud-drawer` at z-49 = behind bottomNav z-50
- ZClass registry only covers 4 of 10 layers; 12+ game components use hardcoded z-values
- Flagged for next session's z-index hardening pass

### 🟡 #4 Broken image paths — confirmed 404s
- `client/public/images/weapons/` — 8 PNGs don't exist, referenced by weapon NFT metadata route
- `client/public/faction/images/` — 4 SVGs don't exist, referenced by faction metadata route (on-chain permanent path)
- Faction emblem PNGs exist in `attached_assets/` but as Vite-bundled imports, not static files
- Needs art assets — blocked on owner providing icons

## Changes this session

### `fix/economics-formatter-accuracy`
- **New file**: `client/src/lib/fmtSupply.ts` — shared number formatter with billions tier
- **EconomicsPanel.tsx**: Replaced local `fmt()` → `import { fmtSupply as fmt }`; emission text now reads `data.emissionRatePerDay + " ASCEND/day"` dynamically
- **landing-economics.tsx**: Same formatter consolidation
- **New test**: `client/tests/fmtSupply.spec.ts` — 11 tests covering null/NaN, billions, millions (2-decimal precision regression), thousands, small values
- Verified green: `check` clean, `test:server` 458/24 skipped, `test` 351/351 (+11 new), `build` clean

## Honest gaps
- `landing.tsx` has its own `fmtSupply()` (already has billions tier, different style) — NOT consolidated this session; left alone to avoid landing page regressions
- `protocolTreasury*` still not displayed in any surface — design call needed on where/how
- No headless visual verification of the formatter change (numbers are too large for pie chart difference to be visually obvious)
