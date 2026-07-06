# Battle / Commander / Menu Architecture Refactor Plan

> Owner ask (2026-07-06, via `/goal`): make sure battles are working, refactor the whole
> battle/commander architecture and the menu system, keep the NFTs. This doc is the scoping
> pass — a fresh, read-only audit of the actual code — before any implementation unit starts.
> Follows the repo's Session Relay Protocol: this plan is its own reviewed unit; every phase
> below is a separate branch/PR, audited on green before the next starts.

## 0. What NOT to touch, and why

Two things in this space are already good and heavily used — refactoring them "because the
architecture is being redone" would be pure risk with no payoff:

- **`server/engine/battle/resolve.ts`** (the pure combat-math core) — 93% line coverage, the
  CI coverage gate's actual target, deterministic and seed-tested (`random.ts`, `resolve.spec.ts`,
  `replayLog.spec.ts`). This is a clean, small, well-factored module already. Leave the math alone.
- **NFT minting/ownership** (`server/services/chain/commander.ts`, `weapon.ts`, `db-schema.ts`'s
  `commanderNfts` / `commanderMintIdempotency` tables) — explicit owner instruction: "keep the
  NFT." No changes to mint/transfer/custody flows in this effort. HARD RULE also applies: no
  funds/ASA/transfer code moves without a `/mainnet-gate` PASS + `algo-auditor` pass, and this is
  TestNet-only right now regardless.

Everything below is UI/architecture restructuring and test-coverage broadening — not new game
rules, not new combat math, not new chain logic.

## 1. Current state (recon, 2026-07-06)

### Server battle engine (`server/engine/battle/`, ~1600 lines incl. specs)
Already well-factored: `types.ts`, `tuning.ts` (balance constants), `random.ts` (seeded RNG),
`resolve.ts` (the resolver), `replayLog.ts`, `verify.ts` (proof/audit hash), `sim.ts` (balance
simulation harness). `server/engine/ai/reconquest.ts` handles AI faction attacks. Battle/commander
routes live in `server/routes.ts` (attack, switch-commander, special-attack, sub-parcel attack,
replay, proof, battle history/stats, commander leaderboard, weapons catalog/build/upgrade/mint).

### Client battle/commander UI — the sprawl
No single "battle" module — battle-related rendering is spread across a dozen+ components with
overlapping responsibility:
- `CommanderPanel.tsx` (852 lines) — still a large orchestrator over its own `commander/*`
  subcomponents (from the 2026-07-05 refactor).
- `WarRoomPanel.tsx` (448), `BattleWatchModal.tsx` (500), `BattlesPanel.tsx` (263),
  `BattleSequenceTimeline.tsx` (145), `CommanderCombatRecord.tsx` (58),
  `TopCommandersLeaderboard.tsx` (57) — six more top-level components, each independently built,
  with duplicated data-fetching and layout patterns.
- Globe cinematic layer: `globe/GlobeBattleSequence.tsx` (253), `globe/BattleCalloutHUD.tsx` (113),
  `globe/LiveWeaponLayer.tsx` (62), `globe/BattleSoundLayer.tsx` (56) — four more files rendering
  different facets of "a battle is happening right now."

None of this is broken. It's just organically grown — nine-plus files for one concept ("watch a
battle") with no shared module boundary.

### The menu system — the real architectural smell
`GameLayout.tsx` (1441 lines) runs **three parallel rendering paths for the same set of panels**
(War Room, Armory, University, Commander, Rankings/Leaderboard, Trade, Factions, Markets):

1. **Mobile fullscreen**: `activeTab: "map"|"inventory"|"battles"|"armory"|"leaderboard"|
   "commander"|"economics"|"intel"|"trade"|"factions"|"markets"` state, rendered as a
   `showFullscreenPanel` overlay with one `{activeTab === "x" && <Panel .../>}` block per tab.
2. **Desktop right rail**: `desktopRightTab: "warroom"|"armory"|"rankings"|"trade"|"factions"|
   "markets"|"commander"|"university"` state, rendered as a ternary chain
   (`desktopRightTab === "x" ? <Panel .../> : ...`) in a fixed side panel — note `"rankings"`
   isn't even an explicit branch, it's the ternary's final `else`, so a new tab id added later
   would silently render the leaderboard instead of failing loudly.
3. **Dashboard-canvas widgets** (flag-gated by `isDashboardEnabled()`, off by default): a
   `widgets: { warroom: {...}, rankings: {...}, armory: {...}, ... }` object passed to
   `DashboardCanvas`, with the **same panels instantiated a third time** with near-identical
   props (same component, same handlers, different `className`).

Concretely: `WarRoomPanel`, `CommanderPanel`, `ArmoryPanel`, `TradeStationPanel`, `FactionPanel`,
`PredictionMarketsPanel`, `LeaderboardPanel`, and `UniversityPanel` are each hand-instantiated
2–3 times in this one file, with the same props copy-pasted per call site. A change to any
panel's props (e.g. adding a new handler) means finding and updating up to three call sites by
hand — that's the real cost of "the menu system," not just the tab-key mismatch.

**Refactor target:** one panel registry — `{ id, label, icon, render: (ctx) => ReactNode }[]` —
built once from shared context (`player`, `gameState`, the handler bundle), consumed identically
by mobile fullscreen, desktop rail, and the dashboard-canvas widget map. One source of truth for
"what panels exist and what they render," three thin adapters for "how they're laid out."

### Test coverage for "make sure battles are working"
CI's coverage gate (`docs/COVERAGE_GATE.md`) only gates `resolve.ts` + a few `shared/` math
modules at 80% lines / 70% branches (currently 93%/91%/78%). `replayLog.ts`, `verify.ts`,
`sim.ts`, `tuning.ts`, and `server/engine/ai/reconquest.ts` all have `*.spec.ts` files today but
aren't in the gate's `include` list — so a regression there wouldn't fail CI even though tests
exist. There's no integration-level test proving the full path (attack action → `resolveBattle`
→ battle record written → replay readable → NFT/commander state updated) end to end.

## 2. Phased plan

### Phase A — Unify the menu/navigation system (Task #2)
**Goal:** One panel registry (id, label, icon, render-fn) as the single source of truth for
"what panels exist and what they render," consumed identically by all three current rendering
paths (mobile fullscreen, desktop rail, dashboard-canvas widgets) instead of each hand-rolling
its own copy of every panel's props. One canonical tab-id enum instead of two/three overlapping
vocabularies (`"battles"` vs `"warroom"`, `"leaderboard"` vs `"rankings"`).
**Files:** `GameLayout.tsx` (1441 lines — the bulk of the change), `BottomNav.tsx` (`NavTab`
type), the dashboard widget wiring (`dashboard/DashboardCanvas.tsx`, `dashboard/defaults.ts`).
**Approach:** extract a `usePanelRegistry()`-style hook or plain array built from the existing
`player`/`gameState`/handler bundle already in scope in `GameLayout`, keyed by one canonical tab
id. Each of the three rendering contexts becomes a thin loop/lookup over that registry instead
of a hand-written block per panel. Migrate one rendering path at a time (e.g. dashboard widgets
first — it's flag-gated and off by default, so it's the lowest-risk place to prove the registry
shape works — then desktop rail, then mobile fullscreen last since it's the default/live path
every player hits).
**Done when:** tsc clean, existing client tests green, a smoke render test proves all three
paths render the same panel set from the one registry, zero change to what any panel *renders*
or what props it receives — only how it's wired up.
**Risk:** low-medium. Client-only, no server/chain/combat-math changes. The risk is purely
regression in "which tab am I on" or a dropped prop during the registry extraction — mitigated
by migrating the flag-gated (off-by-default) dashboard path first, and by keeping panel
components themselves untouched.

**Progress (2026-07-06):** step 1 shipped — the dashboard-canvas widget map now derives from a
`dashboardPanelRegistry` array instead of a hand-rolled object literal (merged in
`feat/battle-menu-architecture-refactor`). **Migrating the desktop rail is NOT a drop-in reuse
of that same registry** — a closer read of the rail's ternary chain found real per-context
differences the dashboard-widget registry doesn't capture:
- Sizing: dashboard widgets use `h-full` (their `DashboardCanvas` frame gives an explicit height);
  the rail is a `flex flex-col` container and needs `flex-1` on the same panels, not `h-full`.
- Wrapping: `ArmoryPanel` and `UniversityPanel` get external wrapper `<div className="...">`s in
  the rail (`<div className="flex-1 overflow-y-auto"><ArmoryPanel .../></div>`) but a bare
  `className` prop (or no wrapper) in the dashboard-widget version.
- The rail's ternary chain also has the `"rankings"` fallthrough bug noted above (no explicit
  branch — it's the final `else`), which the dashboard registry doesn't reproduce since it uses
  an explicit `rankings` key.

Reusing the dashboard registry's `content: ReactNode` as-is for the rail would silently break
desktop layout (wrong sizing class, missing wrapper divs) on the path every desktop player hits
by default — unlike the flag-gated dashboard canvas. The registry needs to change from a static
`content: ReactNode` to a `render: (ctx) => ReactNode` factory so each consumer (dashboard, rail,
eventually mobile) supplies its own sizing/wrapper, before the rail migration is safe to attempt.
**This is its own follow-up unit**, not a continuation of the same commit — it touches the
default-visible desktop path and deserves its own focused review rather than being rushed
alongside the low-risk dashboard step.

**Two more prerequisites found (2026-07-06), both blocking a safe rail/mobile migration:**

1. **Mobile and desktop aren't just different vocabularies for the same tab set — they expose
   different features.** `BottomNav.tsx`'s `NavTab` includes `"economics"` and `"intel"`, which
   the desktop rail's `desktopRightTab` has no equivalent for at all; the rail has
   `"university"`, which mobile's tab list never surfaces. And mobile's `activeTab === "map"`
   means "show the globe fullscreen, no panel" — desktop has no equivalent concept; the rail is
   *always* visible regardless of `desktopRightTab`. A flat single-variable merge would either
   silently drop the mobile-only or desktop-only tabs, or make the rail disappear whenever the
   shared value happened to be `"map"`. This is a real product question (should mobile gain
   University access? should desktop gain Economics/Intel?), not a pure refactor — the safe
   technical move is one canonical `PanelId` enum + one `activeTab` state, with each platform's
   chrome (BottomNav vs. rail) choosing its own subset of buttons to render and the rail
   deriving its shown panel as `isRailPanel(activeTab) ? activeTab : lastRailTab` rather than
   assuming every value is valid everywhere.
2. **`GameLayout.tsx` has zero interactive test coverage for tab-switching.** The two existing
   spec files (`gamelayout-entry.spec.tsx`, `gamelayout-connected-shell.spec.tsx`) both use
   `react-dom/server`'s `renderToStaticMarkup` — a single static SSR render with no event
   listeners, deliberately chosen to avoid a jsdom/WebGL-heavy harness. That harness *cannot*
   simulate a click and assert on the resulting re-render, so there is currently no regression
   safety net for "clicking a nav tab shows the right panel" at all, on either platform. Before
   touching the live tab-switching logic, this needs either a jsdom + testing-library harness
   investment (bigger than a drive-by addition — the component has heavy mocked dependencies
   already, per the existing specs' docstrings) or an equivalent lower-tech characterization
   test. Attempting the rail/mobile unification without this would mean shipping a change to
   every player's primary navigation with no automated way to catch a regression.

Given both of these, the rail/mobile migration is scoped as a **dedicated future unit** that
starts with (a) an owner decision on cross-platform tab parity and (b) a test-harness
investment — not a continuation of this PR's lower-risk steps.

**Update (2026-07-06, same day): shipped.** Resolved (a) with a safe, additive default —
union, not intersection: the desktop rail gained `"economics"`/`"intel"` tabs it never had,
mobile gained the `"university"`/Academy tab it never had, nothing removed from either
platform. Resolved (b) partially: `GameLayout.tsx` still has no *interactive* click-simulation
tests (that gap is real and stands), but the actual risk in this migration was the "map has no
rail equivalent" derivation — pulled that into a small pure module,
`client/src/lib/panelNav.ts` (`isRailTab`/`resolveRailTab`), unit-tested directly with plain
vitest (5 tests, no jsdom needed since it's pure logic, not a DOM interaction). `activeTab` is
now the single state; `desktopRightTab` is a derived value, not a second `useState`. Also found
and fixed a live redundancy this enabled: `handleRequestAttack` was manually setting both
`desktopRightTab` unconditionally and `activeTab` behind an `isMobile` check — now one line,
`setActiveTab("commander")`. tsc / all 226 client tests (221 + 5 new) / production build all
green. The existing SSR shell tests (`gamelayout-connected-shell.spec.tsx`, `hud-shell.spec.tsx`)
still pass, confirming the component mounts without a runtime error post-refactor — real but
partial assurance; they don't simulate a click, so "does clicking a tab show the right panel"
is still not directly asserted by an automated test. That gap is honestly still open.

### Phase B — Consolidate the battle-watching UI (Task #3) — INVESTIGATED, NOT NEEDED

**Verdict (2026-07-06): the "11-file sprawl" premise from the original recon doesn't hold up
under a real read. Closing this phase without forcing a refactor.**

The original recon (an Explore subagent's fast pass) characterized `BattleWatchModal`,
`BattleSequenceTimeline`, the four globe battle layers, `BattlesPanel`, `CommanderCombatRecord`,
and `TopCommandersLeaderboard` as "organically grown... no single module boundary." A closer
read of each file found the opposite — this is already a properly composed, appropriately
separated architecture, not duplicated sprawl:

- `BattleWatchModal.tsx` already imports and composes `BattleSequenceTimeline` as its child —
  a real parent/child relationship, not two independent copies of the same thing.
- The four globe layers (`GlobeBattleSequence`, `BattleCalloutHUD`, `LiveWeaponLayer`,
  `BattleSoundLayer`) are composed together by `PlanetGlobe.tsx` as deliberately separate
  concern-based modules (visual sequence, HUD callout, weapon projectiles, audio) — exactly how
  a layered 3D scene should be structured, not ad hoc duplication. They're synchronized through
  a small, well-documented pub/sub, `client/src/lib/battle/cinematicBus.ts`, whose own header
  comment explains it exists specifically **to avoid duplicating the sequence-assembly logic**
  between the globe layer and the HUD layer — i.e. the anti-duplication mechanism this phase
  was proposing to build already exists and is already doing its job.
- `CommanderCombatRecord.tsx` and `TopCommandersLeaderboard.tsx` are two small, genuinely
  different views (per-player combat record vs. a global top-10 board) that already share their
  formatting logic through a tested pure helper, `formatCommanderRecord()` in
  `client/src/lib/battle/combatRecordFormat.ts` — again, the duplication risk was already
  extracted before this unit ever started looking.
- `BattlesPanel.tsx` is a self-contained battle-history list with its own clearly-scoped
  `BattleCard`/`EventItem` subcomponents — not overlapping with the modal/globe rendering path.

**Nothing was refactored here.** Forcing a consolidation onto code that's already well-factored
would be manufacturing risk on HARD-RULE-gated cinematic/canvas code for no real benefit —
exactly the "don't add abstractions beyond what the task requires" trap. The honest finding is
that this phase, as originally scoped from a fast recon pass, was based on an inaccurate premise;
the real architectural problem in this codebase was `GameLayout.tsx`'s nav/panel duplication
(Phases A, done), not this.

### Phase C — Broaden battle-engine test coverage (Task #4)
**Goal:** the concrete "make sure battles are working" deliverable. Add `replayLog.ts`,
`verify.ts`, `tuning.ts`, and `server/engine/ai/reconquest.ts` to the coverage gate's `include`
list (they already have spec files — this is turning on enforcement, not writing tests from
scratch), plus one new integration-style test that drives the full attack → resolve → record →
replay path against the real route handlers (in-process, no live network).
**Files:** `vitest.config` coverage include list (wherever `docs/COVERAGE_GATE.md` says it lives),
new `server/engine/battle/integration.spec.ts` or similar.
**Done when:** `coverage:server` still passes at the (now broader) gate, new integration test
fails-before/passes-after is demonstrated against a seeded regression (per repo convention: no
fix without a test).
**Risk:** low — additive only, no production code path changes required unless the broadened
gate surfaces an existing gap, in which case that gap gets its own follow-up unit rather than
being silently patched inside this one.

## 3. Explicit non-goals

- No changes to NFT mint/transfer/custody code (owner: "keep the NFT").
- No changes to combat math, balance constants, or RNG (`resolve.ts`, `tuning.ts`, `random.ts`
  stay as-is — Phase C only broadens what's *tested*, doesn't touch the logic).
- No mainnet-adjacent changes of any kind.
- Not attempting all three phases in one PR — one unit per chat/branch per the working
  agreement; each phase above is its own audited PR.
