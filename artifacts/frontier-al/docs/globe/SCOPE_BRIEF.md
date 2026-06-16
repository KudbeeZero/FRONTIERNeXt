# Globe Scope Brief

> **Status:** scope brief (no behavior change). Establishes the current globe's
> capabilities, the parity/perf invariants that constrain it, the target end-state,
> and the **pluggable globe interface** that future units — including the wave-combat
> package — integrate against without reaching into globe internals.
>
> **Scope of the unit that produced this doc:** documentation only. No rendering,
> engine, or schema code changed.

Code paths are `artifacts/frontier-al/...` unless noted. Line numbers are accurate
as of the commit that introduced this brief and may drift; treat the symbol names as
the durable reference.

---

## 1. Capability inventory (as-is)

The globe is **real and server-data-driven** — not a placeholder. ~2,300 LOC across
the components below, mounted by the `PlanetGlobe` orchestrator inside a single R3F
`<Canvas>`.

| Component | File | ~LOC | Role | Data source | Per-frame? |
|-----------|------|------|------|-------------|------------|
| **PlotOverlay** | `client/src/components/game/globe/GlobeParcels.tsx:50–397` | 348 | 21k plot tiles (InstancedMesh fills + borders); hover/select/battle pulse; fog-of-war | props (`parcels`, `players`, `currentPlayerId`, `selectedPlotId`) | yes (`:181–281`) |
| **SubParcelOverlay** | `globe/GlobeParcels.tsx:407–531` | 125 | 3×3 sub-grids on subdivided macro-plots; archetype coloring; LOD-gated | props (`parcels`, `currentPlayerId`) | yes (`:418–422`) |
| **BattleArcs** | `globe/GlobeEvents.tsx:109–167` | 59 | Glowing attack arcs between plot pairs; fade after resolution | props (`battles`, `parcels`, `players`) | yes (`:64–83`) |
| **MiningPulseLayer** | `globe/GlobeEvents.tsx:208–217` | 10 | Expanding ring pulses at mining sites | props (`pulses: LivePulse[]`) | yes (`:178–192`) |
| **OrbitalZoneLayer** | `globe/GlobeEvents.tsx:301–313` | 13 | Impact zones + cosmetic orbital streaks | props (`orbitalEvents`) | yes (`:234–248`, `:285–289`) |
| **SatelliteOrbitLayer** | `globe/GlobeEvents.tsx:320–395` | 76 | Player satellites on deterministic Kepler-ish orbits | props (`players`); `satHashFloat` for phase | yes (`:351–371`) |
| **GlobeHUD** | `globe/GlobeHUD.tsx` | ~100 | Telemetry overlay, chain-health, REC badge | props + `useChainHealth()` | no (DOM overlay) |
| **GlobeTerrain** | `globe/GlobeTerrain.tsx:7–56` | 50 | Albedo-textured sphere + saturation shader | `useLoader` texture | yes (shader) |
| **GlobeAtmosphere** | `globe/GlobeAtmosphere.tsx:9–95` | 87 | Three concentric additive glow shells | uniforms | yes (shader) |
| **StarField** | `globe/StarField.tsx:8–97` | 90 | 10k background + 180 bright stars (static) | procedural buffers | no |
| **LiveWeaponLayer** | `globe/LiveWeaponLayer.tsx:23–62` | 40 | Bridges `weapon_engagement` WS events → `WeaponScene` particles; rebases timing to client clock | **self-subscribes** (`onWeaponEngagement`) | yes (internal) |
| **ObserverLayer** | `globe/ObserverLayer.tsx:35–58` | 24 | Maps camera distance → look-back time (0–24h); drives event replay | reads `camera.position`; throttled ~20s | yes (`:46–53`) |
| **GlobeColorSettings** | `globe/GlobeColorSettings.tsx:11–101` | 91 | Territory/enemy color picker; localStorage-backed | `visualPrefs` | no (modal) |
| **PlanetGlobe (Scene)** | `components/game/PlanetGlobe.tsx:56–135` | 80 | Orchestrator: mounts sub-components, CameraController, OrbitControls | prop cascade | indirect |
| **PlanetGlobe (Root)** | `components/game/PlanetGlobe.tsx:176–321` | 146 | Canvas host + chrome (HUD, compass, buttons, parcel card) | props | no |
| `lib/globe/globeConstants.ts` | — | 100 | `GLOBE_RADIUS=2`, `PLOT_COUNT=21000`, palette, LOD distance, fog radii | constants | — |
| `lib/globe/globeUtils.ts` | `:22–97` | 76 | `generateFibonacciSphere`, `latLngToVec3`, `buildArcCurve`, `tangentFrame`, `getPlotColor`, `satHashFloat` | pure | — |
| `lib/globe/globeTypes.ts` | — | 11 | `PlotCoord`, `LivePulse` | types | — |
| `lib/globe/visualPrefs.ts` | — | 84 | localStorage wrapper (colors, fog, observer) via `useSyncExternalStore` | — | — |

---

## 2. Data flow (server → globe)

State is **server-authoritative** and pushed over WebSocket on a dirty-flag +
debounce loop:

- **Flush cadence:** `server/wsServer.ts` `FLUSH_INTERVAL_MS = 1_500` (1.5s). Mutating
  actions call `markDirty()` (`wsServer.ts:268`); the next tick issues **one** atomic
  `getGameState()` read and broadcasts.
- **Envelope:** `{ type: "game_state_update", payload: <GameState> }` (`wsServer.ts:296`),
  **scoped per connection** via `scopeGameStateFor()` (`wsServer.ts:290–298`) — each
  client sees only its own economic detail; parcel positions and player names are public.
- **Props through `PlanetGlobe`** (`client/src/components/game/PlanetGlobe.tsx:34–52`):
  `parcels: LandParcel[]`, `players: Player[]`, `battles: Battle[]`,
  `orbitalEvents: OrbitalEvent[]`, `livePulses: LivePulse[]`.
- **`weapon_engagement` (out-of-band):** emitted per shot via
  `broadcastRaw({ type: "weapon_engagement", payload })` (`routes.ts:2412`,
  `wsServer.ts:304–306`); consumed by `LiveWeaponLayer` (`:16`) which **self-subscribes**
  rather than receiving it as a prop. Payload carries `launchTs`, `tof`, `from`/`to`
  lat-lng, `status` (`intercepted`|`hit`), optional `intercept`; client rebases timing
  to the local clock to absorb skew.
- **`world_event` (out-of-band):** `broadcastWorldEvent()` (`wsServer.ts:327–329`),
  on-demand narration/activity, not part of the flush tick.

---

## 3. Interaction model (as-is)

**Picking is NOT a per-tile raycaster.** It is a single coverage sphere + nearest-
neighbor snap:

1. **Coverage sphere** — one invisible mesh at `GLOBE_RADIUS * 1.01`, opacity `~0.001`,
   captures all pointer events through R3F's `onPointerMove`/`onClick`
   (`GlobeParcels.tsx:358–366`).
2. **Project to surface** — handlers take the world-space `e.point`, normalize it to the
   globe radius (`GlobeParcels.tsx:332–354`).
3. **Nearest-neighbor** — `nearestPlot()` does an **O(n) linear scan** over a flat
   `plotPositions3D` Float32Array (21k × 3), brute-force distance² compare, no spatial
   index (`GlobeParcels.tsx:100–109`). `plotCoords` itself comes from the client's own
   `generateFibonacciSphere(PLOT_COUNT)` `useMemo` (`GlobeParcels.tsx:59`) — see §4.

**Camera (`OrbitControls`, `PlanetGlobe.tsx:121–132`):** `enablePan:false`;
`minDistance: GLOBE_RADIUS*1.8`; `maxDistance: GLOBE_RADIUS*6.0`; `dampingFactor:0.08`;
`rotateSpeed:0.45`; `zoomSpeed:0.9`.

**LOD:** sub-parcel grids render only when
`camera.position.length() < SUB_PARCEL_LOD_DISTANCE (= GLOBE_RADIUS*2.6)`
(`GlobeParcels.tsx:418–422`, `globeConstants.ts`).

**Fog of war (opt-in):** visible set computed within `FOG_REVEAL_RADIUS` of owned plots
(`GlobeParcels.tsx:120–131`); hidden tiles dimmed by `FOG_DIM_HIDDEN` per frame
(`:257–261`).

**Observer mode:** camera distance → look-back offset (0–24h), throttled ~20s
(`ObserverLayer.tsx:35–58`), driving event replay.

---

## 4. Parity & invariants

### 4.1 Fibonacci parity (load-bearing)

Positions are produced by **two independent generators that must agree**:

- **Server** seeds positions **once** and **persists them**: `seeder.ts:191` (and the
  in-memory store `mem.ts:108`) call `generateFibonacciSphere(TOTAL_PLOTS)`; the result,
  including `lat/lng/x/y/z`, is written to the `parcels` table (`db-schema.ts:197–258`)
  and read back verbatim by `rowToParcel()` (`storage/game-rules.ts:74–111`).
- **Client** **regenerates** positions at runtime for rendering and picking —
  `GlobeParcels.tsx:59` calls the client `generateFibonacciSphere` (`globeUtils.ts:22–35`);
  it does **not** render from server-sent `x/y/z`.

Therefore the client's locally-computed plot index *N* must map to the server's
persisted parcel *N*. **If the two generators drift, every tile renders in the wrong
place and picking selects the wrong parcel.** This reconciles the HARD RULE "positions
are computed, never stored": the *client* never stores/receives positions to render (it
computes them); the DB row is the deterministic seed snapshot, not a runtime source of
client geometry.

The constants that must stay identical:

| Constant | Server `sphereUtils.ts` | Client `globeConstants.ts` / `globeUtils.ts` |
|----------|-------------------------|----------------------------------------------|
| Golden angle | `Math.PI*(3-Math.sqrt(5))` (`:23`) | `GOLDEN_ANGLE = Math.PI*(3-Math.sqrt(5))` |
| Candidate headroom | `Math.ceil(count*1.1)` (`:27`) | `Math.ceil(count*1.1)` (`globeUtils.ts:24`) |
| Polar exclusion | `POLAR_EXCLUSION_LAT = 75` (`:11`) | `POLAR_EXCLUSION_LAT = 75` |
| Lng normalization | `lng > 180 ? lng-360 : lng` (`:37`) | `lng > 180 ? lng-360 : lng` (`globeUtils.ts:32`) |
| plotId | `plots.length + 1` (`:40`) | `plots.length + 1` (`globeUtils.ts:32`) |

> **Drift risk / recommended guard:** there is currently no automated test asserting
> client≡server parity. A cheap, high-value future test (see §7) computes both
> distributions for a small `count` and asserts equality of `(plotId, lat, lng)`.

### 4.2 HARD RULES that bound globe work (`artifacts/frontier-al/CLAUDE.md`, `docs/SKILL.md` §3)

- **Additive-only.** Do not modify the battle engine, AI faction logic, globe render
  core, or DB transaction structure off-hand.
- **No architecture migration** (Express/Drizzle/Postgres/R3F stay).
- **New schema columns must be additive/nullable**; no destructive migrations.
- **Positions computed, never persisted client-side** (see §4.1 for the precise reading).

---

## 5. Target end-state

### 5.1 Interaction model evolution
- A stable **selection/aim contract** shared by parcel selection and any future combat
  aiming, so both resolve to the same plot for the same pixel (see §6).
- Optional **mission/combat layer** mounted as additive overlays — never editing the
  render core — driven either by server state or by an external combat package through
  the §6 interface.

### 5.2 Perf targets at 21k tiles
Hold 60fps desktop / scaled mobile, reduced-motion respected. Known cost drivers to
budget against:

1. **O(n) nearest-neighbor on every `pointermove`** — 21k distance² compares per move,
   no debounce, on a hot path (`GlobeParcels.tsx:100–109`, `:332–337`). **Primary
   optimization target** (spatial grid/index or throttle).
2. **Per-frame instanced color/matrix dirties** for animated tiles (selection/hover/
   battle pulses), with `instanceColor.needsUpdate`/`instanceMatrix.needsUpdate` flags
   (`GlobeParcels.tsx:181–281`).
3. **Full 21k re-init** on `plotVisualFingerprint` change (ownership/battle/subdivision)
   via `useEffect` (`GlobeParcels.tsx:282–330`).
4. Minor per-active-entity trig: arcs (`GlobeEvents.tsx:73`), pulses (`:178–192`),
   impact zones (`:234–248`), satellites (`:351–371`).

---

## 6. Pluggable globe interface (spec only — not implemented in this unit)

The future wave-combat package (`@workspace/frontier-combat`) renders **screen-space
overlays** (turret emplacements, projectile FX, globe-scorch decals) on top of whatever
globe renderer is mounted. To keep that package isolated and the globe render core
untouched, combat must integrate through a **narrow seam**, never globe internals.

```ts
// Proposed contract (to land in client/src/lib/globe/globeProjection.ts
// alongside its first real caller — see §7). Types only; no behavior change.

export interface GlobeProjection {
  /** Project a globe-surface lat/lon to screen pixels. Camera- and radius-aware.
   *  `visible:false` when the point is on the far side of the globe (occluded). */
  worldToScreen(lat: number, lon: number): { x: number; y: number; visible: boolean } | null;

  /** Inverse pick: screen pixel -> nearest globe surface point + plot.
   *  MUST mirror the existing coverage-sphere + nearest-neighbor snap (§3) so that
   *  combat aiming and parcel selection resolve to the SAME plot for the same pixel. */
  surfaceHit(x: number, y: number): { lat: number; lon: number; plotId: number } | null;
}
```

Notes for the implementer:
- Today these are **implicit**: forward projection is `latLngToVec3` (`globeUtils.ts:38–46`)
  composed with the camera matrix; inverse is the coverage-sphere pick (§3). Neither
  `worldToScreen` nor `surfaceHit` exists anywhere in `client/src` (grep-confirmed).
- `surfaceHit` must reuse the same `plotCoords`/`plotPositions3D` and snap logic as
  `GlobeParcels`, or combat and selection will disagree at tile boundaries.
- The seam is a read-only projection over the live camera/globe; it introduces no new
  source of truth and persists nothing.

---

## 7. Exit definition for the NEXT unit

The next unit is **one** focused, additive PR — pick A or B:

**Option A — `perf/globe-pick-index` (recommended first):**
- [ ] Replace the O(n) `nearestPlot` scan with a spatial index (lat/lng bucket grid or
      equivalent) behind the same call signature; no API change to callers.
- [ ] Land `globeProjection.ts` implementing the §6 `surfaceHit` (and `worldToScreen`)
      over the new index — its **first real caller**.
- [ ] Add the §4.1 **client≡server Fibonacci parity test** (asserts `(plotId,lat,lng)`
      equality for a sampled `count`).
- [ ] `pnpm --filter @workspace/frontier-al run check` green; `test:server` still 244+/pass;
      manual frame check: pointer-move no longer scans 21k per event.
- [ ] No change to render output (same tiles, same selection behavior).

**Option B — `feat/globe-mission-layer`:**
- [ ] New additive overlay component mounted by `PlanetGlobe` (render core untouched).
- [ ] Any new schema columns additive + nullable; no destructive migration.
- [ ] Server data path documented; no mock/demo data in plot/HUD surfaces.
- [ ] Uses the §6 seam for any surface projection; green check + tests.

Either way: reduced-motion no-op and mobile particle/count scaling are acceptance gates
for anything animated, and nothing touches funds/ASA/mainnet (those require
`/mainnet-gate` PASS + `algo-auditor`).

---

## Appendix — verification of this brief

- Doc-only change; no code touched. Expected green:
  `pnpm run typecheck` (root), `pnpm --filter @workspace/frontier-al run check`,
  `pnpm --filter @workspace/frontier-al run test:server` (244/244 baseline).
- `worldToScreen` / `surfaceHit` absence in `client/src` confirmed by grep.
- Fibonacci parity table cross-checked against `server/sphereUtils.ts` and
  `client/src/lib/globe/globeUtils.ts` + `globeConstants.ts`.
