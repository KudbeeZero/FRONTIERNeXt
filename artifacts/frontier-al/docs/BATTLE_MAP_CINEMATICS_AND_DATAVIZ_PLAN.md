# Battle-Map Cinematics + Economics Dataviz — Draft Plan

> **Status: DRAFT — approved scope pending owner review. No code in this PR.**
> Owner /goal (2026-07-06): three new battle-engine features that help *visually on
> the actual map and cinematically*, plus a dataviz pass — the tokenomics page needs
> updating, and the landing/economics pages should get "really cool unique graphs."
> Researched by two independent agents (battle/cinematic architecture · economic
> surfaces + data inventory); synthesized here. Each unit below is one-chat-sized
> with Goal / Data / Files / Done-when / Risk / Verify, per the playbook template.

## How the pieces fit

The three battle features form a narrative arc **on the globe itself** — the map
tells the war story before, during, and after every battle:

| Phase | Feature | What the player sees |
|---|---|---|
| Before (10-min pending window) | **B1 War Council Muster** | attacker's plot visibly builds toward launch |
| During (10-beat cinematic) | **B2 Shield Wall** | defender raises a shield dome that shatters or holds |
| After (hours) | **B3 Battle Scars** | the map remembers — scorch rings and shield glints mark the front lines |

All three are **new, independent globe layers** driven by real server data that
already reaches the client. None edits `GlobeBattleSequence.tsx`,
`battle-sequence.ts`, or combat math — they subscribe to the existing
`cinematicBus` / props the sibling layers already receive. That keeps each unit
inside the HARD RULE ("don't change globe/combat/canvas behavior outside a scoped,
audited unit") as a scoped, additive, individually-auditable change.

**Shared conventions every battle unit MUST follow** (established by the existing
layers):
- Gate on `shouldPlayBattleCinematics(prefs.battleCinematics, prefersReducedMotion)`.
- Pure, unit-tested logic module in `client/src/lib/battle/` + a thin R3F renderer
  in `client/src/components/game/globe/` (the pattern of
  `incomingTelegraph.ts` / `GlobeIncomingTelegraph.tsx`).
- Faction colors via `client/src/lib/battle/factionColor.ts`; clock via
  `serverNow()`.
- No mock data — every visual traces to a battle row, WS broadcast, or API record.
- Headless visual verification per `docs/HEADLESS_VISUAL_TESTING.md`.

---

## Part 1 — Three battle-engine map/cinematic features

### Unit B1 — "War Council Muster" (attacker-side pending-battle build-up) · size S/M · risk LOW

**Goal:** During a battle's 10-minute pending window the *defender* gets a
converging warning reticle (`GlobeIncomingTelegraph`), but the *attacker's* launch
plot shows nothing. Add the other half of the story: a pulsing staging glow and
rising particle column on the **source plot**, intensity scaled by real
`troopsCommitted`, plus a faint charging arc segment that creeps toward the target
as `resolveTs` approaches. A globe covered in brewing wars becomes readable at a
glance.

**Data (all already on the client, zero server change):** `Battle` rows carry
`sourceParcelId`, `troopsCommitted`, `resourcesBurned`, `commanderId`, `startTs`,
`resolveTs` (`shared/schema.ts:328-348`); `battles` + `parcels` props are already
passed to the sibling layers in `PlanetGlobe.tsx`.

**Files:**
- NEW `client/src/lib/battle/musterState.ts` — pure: (battle, now) → {glowIntensity,
  columnHeight, arcCreepProgress}; spec mirrors `incomingTelegraph.spec`.
- NEW `client/src/components/game/globe/GlobeMusterLayer.tsx` — thin renderer.
- `PlanetGlobe.tsx` — one mount line.

**Done when:** unit tests pin the muster math (ramp-in, troop scaling, creep
timing, expiry at resolveTs); headless screenshot shows the muster visual on the
source plot during a real pending attack (started via `/api/actions/attack`);
tsc + suites green.

**Risk:** LOW — additive layer, touches no existing cinematic file.

### Unit B2 — "Shield Wall" (brace-beat fortification dome) · size S · risk LOW

**Goal:** During the cinematic's `brace` beat, raise a translucent hexagonal
shield dome over the defender's plot — size/brightness driven by the beat's real
intensity (which already encodes defender power and turret/shield-gen/fortress
levels). At `impact`: the dome **cracks and shatters** if the attacker wins, or
**flares solid** on DEFENSE HELD. Pure visual payoff for fortifications the game
already simulates (GAME_MANUAL §14; replay log fortification lines).

**Data (zero server change):** subscribe to `cinematicBus.onCinematic` →
`seq.beats` brace intensity, `seq.target`, `seq.captured`, `playbackAt()` channels
(`client/src/lib/globe/battleSequencePlayback.ts`); fortification context already
cached by the sequence facts (`sequenceFromBattle.ts` / `fortificationLevel()` in
`sequenceFromReplay.ts`).

**Files:**
- `client/src/lib/globe/battleSequencePlayback.ts` — add a pure `braceDome`
  channel (opacity/scale/shatter phase), spec-covered next to the existing
  channels.
- NEW `client/src/components/game/globe/GlobeShieldDome.tsx` — independent
  cinematicBus subscriber; does NOT edit `GlobeBattleSequence.tsx`.
- `PlanetGlobe.tsx` — one mount line.

**Done when:** playback-channel unit tests pass (dome rises in brace, shatters on
captured, flares on held, inert when `swingDecided` timing says otherwise);
headless frame capture mid-brace and at impact (beat timings are deterministic, so
frames can be scheduled); tsc + suites green.

**Risk:** LOW — the only shared-file edit is an additive pure channel with its own
tests.

### Unit B3 — "Battle Scars" (persistent aftermath decals) · size M · risk LOW

**Goal:** Today the map forgets a battle 12 seconds after it resolves. Give every
recent battle a fading mark that lives for hours: a scorch ring in the victor's
faction color where a plot was captured, a shimmering shield-glint where a defense
held — opacity/size decaying with age and scaled by the power differential. The
globe becomes a war map showing where the front lines are.

**Data (zero server change):** seed on load from the existing public
`GET /api/battles/history` (`server/routes.ts:3812` — plotId, outcome, powers,
resolveTs, real DB rows); append live via the `onBattleResolved` WS event (lat,
lng, outcome already in the payload).

**Files:**
- NEW `client/src/lib/battle/battleScars.ts` — pure: age→opacity curve, power→size,
  cap N scars, dedupe by battleId; spec.
- NEW `client/src/components/game/globe/GlobeBattleScars.tsx` + a small
  react-query hook for the history fetch.
- `PlanetGlobe.tsx` — one mount line.

**Done when:** decay/dedupe/cap math unit-tested; headless screenshot shows a scar
persisting after a resolved battle's cinematic settles (session-note
2026-07-06-playtest documents the `resolve_ts` DB trick to force resolution);
tsc + suites green.

**Risk:** LOW — additive; read-only use of an existing endpoint.

### Runners-up (scoped, not selected — future units)

- **Spoils Convoy** (M): captured plots stream resource motes back along the arc —
  needs 3 pillage fields added to the `battle:resolved` broadcast
  (`routes.ts:3028-3040`; values already computed there for the Redis replay).
- **Replay Theater** (M, MED risk): "Watch on Globe" button in `BattleWatchModal`
  republishes the true replay sequence over the cinematicBus — grazes gated code;
  mitigate with a sibling subscriber.
- **Front-line Heat** (M): 24h conflict heat domes from `GET /api/world/events` —
  overlaps B3 thematically; revisit after B3 ships.

---

## Part 2 — Economics/tokenomics dataviz

### Unit D1 — Truth pass: kill fake/stale token data 🔴 do first · size S · risk LOW

This is **compliance, not polish** — live surfaces currently show wrong and
fabricated data (HARD RULE: no mock/demo data on live surfaces):

| Surface | Problem | Truth source |
|---|---|---|
| `pages/landing.tsx:199` | "Total Supply 10,000,000,000" — **off by 10×** | 1,000,000,000 — `/api/economics` totalSupply (routes.ts:674); TOKENOMICS.md:36 |
| `landing.tsx:201` + `:149` | "Pre-Launch" / "launching soon" vs same page saying token is "Live" | ASA 755818217 is live on TestNet |
| `landing.tsx:218-220` | unsourced "5B/5B Liquidity/Land-Minted" split | TOKENOMICS.md pools model (Treasury/Circulation/Burned of 1B) |
| `landing.tsx:146` + `landing-shared.tsx:278` | "4,218 parcels claimed" frozen ticker/footer | `ownedParcelCount` from `/api/economics` (routes.ts:719) |
| `pages/landing-economics.tsx:35-39` | **"Circulating Supply Trend (Projected)" chart is synthetic sine-wave data** | remove; real replacement in D3 |
| `landing-economics.tsx:129` | "0.5–1.5 ASCEND/hr" | per-DAY: 1/day prod, max 6/day (`shared/economy-config.ts:72-82`) |
| `pages/landing-updates.tsx` (~137) | "Build Date: March 2026" | current |

**Approach:** landing token section becomes a live **KPI row of stat tiles**
(dataviz rule: a handful of headline numbers is a KPI row, not a chart) fed by the
existing `useQuery(["/api/economics"])`; delete the fake chart outright (D3 ships
its real successor); fix the copy.

**Done when:** no hardcoded token/parcel numbers remain on landing pages (grep
proves it); tiles render live values in the headless smoke; tsc + suites green.

### Unit D2 — Quick-win charts (existing endpoints only) · size S/M · risk LOW

Two charts on `/info/economics` (tokenomics page), optionally echoed on landing —
both fed by endpoints that exist today, using **recharts 2.15.2 (already a
dependency)** and the existing `client/src/components/ui/chart.tsx` wrapper:

1. **Faction Control** — horizontal bar (or donut) of territory counts per faction
   + unclaimed. *Job: identity + magnitude → categorical.* Colors are the faction
   colors from `client/src/lib/factions.ts` in **fixed order, following the
   entity** — run them through the dataviz palette validator
   (`validate_palette.js`, light AND dark surface) and record the report in the PR;
   if any adjacent pair fails CVD, add direct labels (mandatory anyway at 4+
   series). Data: `GET /api/factions` (routes.ts:1523).
2. **Battle Pulse** — the "unique graph" centerpiece: **diverging daily bars**
   centered on zero — attacker victories up in one hue, defenses held down in the
   other, neutral gray midline. *Job: polarity over time → diverging pair.* Data:
   `GET /api/battles/history` (routes.ts:3812), client-side day bucketing.

Both get the standard interaction layer (per-mark hover tooltip, ≥ mark-size hit
targets), legends + selective direct labels, text in text tokens (never series
color), one axis each, and dark-mode steps validated separately — per the dataviz
skill's non-negotiables.

**Done when:** palette validator passes (or WARN mitigated with labels/table);
charts render from live data in headless smoke; a table-view fallback exists;
tsc + suites green.

### Unit D3 — Real supply-flow history (replaces the fake trend forever) · size M · risk LOW-MED

**Goal:** the chart the fake one pretended to be: a **stacked area over time** of
circulating vs burned vs protocol treasury. *Job: part-to-whole change-over-time.*

**Data reality (from the research):** no economics history exists anywhere — 
`/api/economics` is snapshot-only and burns are cumulative per-player floats, so
**any honest time-series requires a snapshot table**. Add `economics_snapshots`
(hourly/daily sample of the existing `/api/economics` computation; new Drizzle
migration 0009+), a tiny sampler on the server tick, and
`GET /api/economics/history`. The treasury-fee component can be backfilled
immediately from `treasury_ledger.createdAt` (indexed, db-schema.ts:532-547); the
rest accrues from deploy — the chart states its data-since date honestly rather
than fabricating a past.

**Sequential-hue ramp** for the areas (one hue, light→dark; part-to-whole of the
same 1B supply), 2px surface gaps between bands, crosshair+tooltip hover.

**Done when:** migration applies; sampler unit-tested; endpoint returns real rows;
chart renders accrued data in headless smoke; no synthetic points anywhere;
tsc + suites green.

**Risk:** LOW-MED — first unit with a schema migration; keep the sampler isolated
and fail-open (a failed sample never blocks the tick).

### Later dataviz candidates (scoped, queued)

- **Biome Market Map** (M): 8-biome treemap sized by parcel count, colored by %
  owned, priced from `LAND_PURCHASE_ALGO_PROD` — needs one small GROUP BY endpoint.
- **Protocol Treasury Inflow** (S): daily fee-revenue bars from `treasury_ledger`.
- **Trade Exchange-Rate Sparklines** (S/M): stat tiles per resource pair from
  `GET /api/trade/history` filled-order ratios, in TradeStation.
- **ALGO Land-Sale Volume** (M): needs a public aggregate of the admin-only
  purchase-metrics data.

---

## Proposed execution order

1. **D1** (truth pass — factually wrong token data on the public landing page is
   the most urgent item found)
2. **B1** muster → 3. **B2** shield dome → 4. **B3** scars (the battle arc,
   cheapest-first)
5. **D2** quick-win charts → 6. **D3** supply-flow history
7. Runners-up as owner appetite dictates.

Every unit: one chat, one PR, audited, merged before the next — per the working
agreement. None touches funds/ASA/mainnet code; nothing here relaxes the
mainnet-gate items.
