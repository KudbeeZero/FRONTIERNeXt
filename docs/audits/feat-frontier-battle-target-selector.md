# Audit — feat/frontier-battle-target-selector

## Verdict
PASS

## PR / branch / commit
- Branch: `feat/frontier-battle-target-selector`
- Head SHA: `HEAD` (local, not yet pushed)
- Scope: UI-only Battle Target Selector replacing manual Parcel ID entry in Commander Battlefront

## Claims vs. evidence

| Claim | Evidence | Status |
|-------|----------|--------|
| Manual Parcel ID textbox removed from Battlefront | `client/src/components/game/CommanderPanel.tsx:621` previous input/textarea block deleted; `BattleTargetSelector` inserted at same location | ✅ verified |
| 5-tab Target Selector rendered (Recommended, Nearby, Mission, Search, Globe) | `client/src/components/game/BattleTargetSelector.tsx:60-68` `<Tabs>` with 5 `<TabsTrigger>` values | ✅ verified |
| Recommended tab auto-scores targets by proximity + weakness + value | `BattleTargetSelector.tsx:130-151` scoring formula uses `distScore * 0.4 + defenseScore * 0.3 + valueScore * 0.2 + missionBoost * 0.1` | ✅ verified |
| Nearby Enemies tab sorts by distance | `BattleTargetSelector.tsx:115-124` `nearbyEnemies` sorts by `sphereDistance` ascending | ✅ verified |
| Mission Targets tab surfaces rival faction territory | `BattleTargetSelector.tsx:153-160` filters enemy parcels whose `effectiveFaction` is classified as enemy by `classifyRelationship` | ✅ verified |
| Search tab allows Plot Number / Owner / Faction search, rejects invalid IDs | `BattleTargetSelector.tsx:162-173` input with `searchQuery`, filter matches plotId/ownerId/effectiveFaction/biome; no free-form ID injection path to server | ✅ verified |
| Globe tab instructs tap-to-select and wires back to canonical `selectedParcelId` | `BattleTargetSelector.tsx:175-185` globe instruction panel + `onSelect` callback wired to `handleTargetSelect` → `onSelectTarget` in `CommanderPanel` → `setSelectedParcelId` in `GameLayout` | ✅ verified |
| selectedParcelId remains canonical target state | `GameLayout.tsx:122` original state unchanged; `onSelectTarget={setSelectedParcelId}` added at `GameLayout.tsx:1264` | ✅ verified |
| Memoization caps expensive filtering at 20 results | `BattleTargetSelector.tsx:84` `DISPLAY_LIMIT = 20`; all `.slice(0, DISPLAY_LIMIT)` present in recommended, nearby, mission, search paths | ✅ verified |
| No battle calculation or ownership logic modified | Diff shows only `BattleTargetSelector.tsx` (new), `CommanderPanel.tsx` (UI swap), `GameLayout.tsx` (prop wiring), and test files. Server routes, battle engine, storage untouched | ✅ verified |
| Launch button / win-chance / power calc unchanged | `CommanderPanel.tsx:243-246` `handleLaunchPlotAttack` signature identical; `targetForCalc` line 229 still derives from `selectedParcel` | ✅ verified |
| Source parcel picker preserved | `CommanderPanel.tsx:666-683` `sourceParcelId` scroll picker untouched | ✅ verified |

## Tests

```text
$ pnpm install --frozen-lockfile
Done in 11s using pnpm v10.33.0

$ pnpm --filter @workspace/frontier-al run check
> tsc
(no errors)

$ pnpm --filter @workspace/frontier-al run test:server
 Test Files  72 passed | 8 skipped (80)
      Tests  699 passed | 26 skipped (725)

$ pnpm --filter @workspace/frontier-al run test
 Test Files  71 passed (71)
      Tests  420 passed (420)
```

New tests added in this PR:
- `client/tests/battle-target-selector.spec.tsx` — 5 tests: render, 5 tabs, empty-state, recommended tab enemy card rendering
- `client/tests/battle-target-selector-logic.spec.ts` — 13 tests: classifyRelationship, sphereDistance, effectiveFaction, scoring weights

## Scope-creep check

Files changed:
- `client/src/components/game/BattleTargetSelector.tsx` (new)
- `client/src/components/game/CommanderPanel.tsx` (UI swap + prop)
- `client/src/components/game/GameLayout.tsx` (prop wiring)
- `client/tests/battle-target-selector.spec.tsx` (new)
- `client/tests/battle-target-selector-logic.spec.ts` (new)

No server routes, no battle engine, no schema, no migration, no chain, no wallet code touched.

## Untested assertions

| Assertion | Reason untested |
|-----------|-----------------|
| "Choose on Globe" tab closes selector and populates target automatically | This is a two-step interaction (globe click → Commander panel state update) that requires a browser/DOM harness; documented in `CLAUDE.md` headless-visual-testing recipe. The `onSelectTarget` callback is wired and test-backed at the prop boundary. |
| Tab content varies with live 21,000-parcel gameState | SSR smoke test validates structure; per-tab content validation should be covered by a Playwright/WebGL harness in follow-up. |
| Mobile touch interaction latency smooth at 21,000 parcels | No on-device benchmark; memoization + cap is the mitigation. |

## Security

- No funds/ASA/transfer code modified.
- No auth boundary changed.
- No secrets, mnemonics, or wallet keys introduced.
- Input validation: search input is client-side filtered only; no server-side path created from search strings (zero injection surface vs. the removed `<input>` which was also client-only).
- Severity: NONE.

## What I could NOT verify

- Live 3D globe tap-to-select round-trip inside the Commander panel (requires headless Chromium + WebGL harness).
- Performance under production `gameState` with 21,000 live parcels on low-end mobile hardware.
- Visual regression screenshots (PR opens without them; owner verification checklist requests them).
