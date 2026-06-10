## Fiona — Night Shift Report
**Focus**: PR #9 weapon-system performance — client FX (WeaponProjectile.tsx, ImpactBurst.tsx, WeaponScene.tsx, fxUtils.ts, globe/LiveWeaponLayer.tsx, PlanetGlobe.tsx wiring, useGameSocket.ts event volume) and server (weapons/engagementStore.ts, weapons/service.ts, routes.ts weapon endpoints, wsServer fan-out), plus weapon-sandbox bundle isolation (vite.config.ts, weapon-sandbox-entry.tsx). NOTE: the shared checkout was switched off `origin/pr/9` mid-review by a parallel agent; all line refs below are pinned to **origin/pr/9** (verified via `git show`), not the current working tree.

**Findings Table**
| ID | Severity | Category | File(s) | Description | Impact | Suggested Fix | Test Idea |
|----|----------|----------|---------|-------------|--------|---------------|-----------|
| F1 | Med | Per-frame alloc | client/src/components/game/weapons/WeaponProjectile.tsx:65-66,84; shared/weapons/ballistics.ts:89-101 | Every frame per shot: `positionAt` re-derives `greatCircleKm` (distanceKm param unused by caller) + allocates FlightPoint/slerp objects; `latLngToVec3` returns a new `Vector3`; line 84 `headColor.clone()` allocates a Color per emitted particle. ~4-5 heap objects × 60fps × N shots. | GC churn / frame spikes during salvos on the 21k-parcel globe scene. | Memoize `distanceKm` per shot and pass it to `positionAt`; reuse a module-scope scratch `Vector3`/`Color` (`.set()`/`.copy()` instead of new/clone). | Sandbox salvo of 20 shots; record Chrome allocation timeline — heap sawtooth should flatten after fix. |
| F2 | Med | Draw calls / GPU reuse | WeaponProjectile.tsx:106-124; ImpactBurst.tsx:65-72; WeaponScene.tsx:48-53 | Each shot mounts its own sphereGeometry+basic material, Points+pointsMaterial, ringGeometry, flash sphere — 4 draw calls and 4 geometry/material creations per shot; nothing shared across instances (only the sprite texture is cached, fxUtils.ts:22-45). | Linear draw-call + GPU-upload growth per live projectile; shader recompiles on first salvo. R3F disposes on unmount so no leak, but creation cost recurs every shot. | Hoist shared geometries/materials to module scope (per-color material map), or batch heads via InstancedMesh as elsewhere on the globe. | r3f-perf / `gl.info.render.calls` before/after with 30 concurrent shots. |
| F3 | Med | Latent correctness (perf gate) | WeaponProjectile.tsx:42-43,62,98-99 | The settle gate counts `postFrames` whenever `inFlight` is false — including **before** `launchTs`. Any shot whose launch is >70 frames in the future settles permanently and never renders. Currently unreachable (LiveWeaponLayer.tsx:39 rebases `launchTs = recvNow`; sandbox uses `Date.now()`), so flagged as latent, not live. | Future scheduled/staggered launches (salvo delays, server replay of active engagements) silently render nothing. | Only advance `postFrames` when `rawT >= endProgress` (i.e. after terminal), not pre-launch (`now < shot.launchTs` → early-return after hiding head). | Unit/sandbox: mount shot with `launchTs = Date.now()+3000`; assert projectile becomes visible at T+3s. |
| F4 | Med | WS fan-out / event volume | server/routes.ts:2115-2136 (2130-2131); server/wsServer.ts:31,159-163,273-281 | Every fire does `broadcastRaw` of the **full Engagement** (attackerId, parcel ids, pk, battery ids) to all clients + `markDirty()` → full scoped game-state flush. Flush is debounced to 1.5s (good), but sustained firing keeps the O(clients) full-state pipeline hot; no rate limit on /api/weapons/fire (FRNTR cost is the only throttle). | One active battle = continuous max-size state flushes to every client; payload also over-shares resolution internals clients don't need. | Broadcast a trimmed DTO (id, specId, from/to, launchTs, tof, status, interceptAt/Ts); consider express-rate-limit on fire like the advice route (routes.ts:17-23). | Two WS clients + scripted 10 fires/s; measure bytes/s per client before/after DTO trim. |
| F5 | Low | Per-frame work after effect ends | ImpactBurst.tsx:45-61; LiveWeaponLayer.tsx:21 | ImpactBurst's useFrame has no settled gate: it writes scale/opacity/visibility every frame for the shot's full 12s retention though the burst lasts ≤1.1s (and also runs before triggerTs). WeaponProjectile got this gate; ImpactBurst didn't. | Minor CPU per resolved shot × retention window; adds up under salvos. | Mirror the `settledRef` pattern: early-return once `elapsed > durationMs` after a final hide. | Profiler: useFrame self-time for 20 resolved shots should drop to ~0 after burst completes. |
| F6 | Low | Buffer upload | WeaponProjectile.tsx:91-94 | Both `position` and `color` attributes are flagged `needsUpdate` every frame, but positions change only when a particle is emitted (in-flight frames). Post-impact fade frames re-upload an unchanged 90×3 position buffer. | Small redundant GPU upload per shot per frame (~1KB); cheap but free to fix. | Set `position.needsUpdate` only inside the `if (inFlight)` branch. | Inspect `gl.info` buffer upload counts post-impact. |
| F7 | Low | Server memory / hot path scaling | server/weapons/engagementStore.ts:96,161-181,209-219; routes.ts:2050-2053 | Engagement map is well-bounded (prune on launch L132-134 + 30s unref'd interval). Batteries: capped at 12/player but unbounded across players, never expire, and `resolveInterception` runs `solveIntercept` over **all** batteries per launch (O(B)); `deployDefense` also does an O(B) ownership count. | Fine at current scale; degrades linearly with player count under fire-heavy load. | Index batteries by ownerId; pre-filter by range feasibility (cheap greatCircleKm gate) before solveIntercept. | Bench `launch()` with 1k batteries; assert <1ms. |
| F8 | Low | Render-layer hygiene | LiveWeaponLayer.tsx:24-51; PlanetGlobe.tsx:120 | No cap on concurrent shots and no LOD/visual-prefs gating (other layers thread `useVisualPrefs`); a burst of N events mounts N×4 draw calls for 12s each. Timer cleanup is correct (Set + unmount clear). Also `headColor` (WeaponProjectile.tsx:55) allocates per render and WeaponScene children aren't memoized, so every new shot re-renders all live projectiles. | Worst-case event storm degrades globe FPS with no quality fallback. | Cap `shots` (e.g. slice newest 24), wrap WeaponProjectile in `React.memo`, hoist headColor to fxUtils. | Dispatch 100 synthetic engagements; FPS stays >40 with cap. |
| F9 | Low | Bundle (positive + note) | vite.config.ts:26-29; client/src/weapon-sandbox-entry.tsx:10-12; client/weapon-sandbox.html; package.json:14 | Sandbox does NOT leak into the main bundle: WeaponSandbox is imported only by weapon-sandbox-entry.tsx, and `build` has no extra rollup input — so weapon-sandbox.html is **dev-only** (prod build excludes it entirely; /weapon-sandbox.html 404s in prod — appears intentional per file header). Main bundle gains only WeaponScene/Projectile/ImpactBurst/fxUtils via LiveWeaponLayer (~small, justified). | None today; just confirm dev-only sandbox is the intent. | If prod sandbox is ever wanted, add `build.rollupOptions.input` with both HTML entries. | `pnpm run build` then grep dist/public assets for "WeaponSandbox" (expect no hit). |

**Key Insights**
- The FX layer already has good instincts (settle gate, pooled 90-particle trail, cached sprite texture, opportunistic + interval prune server-side, rebased client clocks) — remaining issues are uniform-application gaps, not design flaws.
- Steady-state cost is bounded by RETAIN_MS turnover (12s/shot); the real risk is burst load (salvo + no shot cap + per-shot geometry creation) and the latent pre-launch settle bug (F3) which any future scheduling feature will trip.
- Server fan-out is one WS message per fire (fine); the heavier cost is the piggybacked full-state flush via `markDirty()` — pre-existing mechanism, weapons just add a high-frequency dirty source. Payload over-sharing (pk, attackerId to all clients) overlaps with the security lane — flagged, not duplicated.
- Uncertainty: I could not run the build or profiler this shift (checkout was moved off pr/9 mid-run by a parallel agent), so F9's "no leak" is from import-graph + vite-config analysis, not a dist grep.

**Code Suggestions**
F1/F3 (WeaponProjectile.tsx, combined):
```ts
const SCRATCH = new THREE.Vector3();              // module scope
const distKm = useMemo(() => greatCircleKm(shot.from, shot.to), [shot.from, shot.to]);
useFrame(() => {
  if (!spec || settledRef.current) return;
  const now = Date.now();
  if (now < shot.launchTs) { if (projRef.current) projRef.current.visible = false; return; } // F3: don't settle pre-launch
  const rawT = (now - shot.launchTs) / shot.tof;
  ...
  const fp = positionAt(spec, shot.from, shot.to, t, distKm);  // F1: skip per-frame greatCircleKm
```
F2 (module-scope shared geometry):
```ts
const HEAD_GEO = new THREE.SphereGeometry(0.012, 10, 10);   // shared by all shots
// <mesh ref={projRef} geometry={HEAD_GEO}> ... (same for ring/flash geometries in ImpactBurst)
```
F4 (routes.ts:2130 — trim the broadcast):
```ts
const { id, weaponSpecId, from, to, launchTs, tof, status, interceptAt, interceptTs } = engagement;
broadcastRaw({ type: "weapon_engagement", payload: { id, weaponSpecId, from, to, launchTs, tof, status, interceptAt, interceptTs } });
```
F5 (ImpactBurst.tsx): add `const doneRef = useRef(false);` and in useFrame: `if (doneRef.current) return; ... if (elapsed > durationMs) { hide both; doneRef.current = true; }`.

**Confidence Score**: 8/10
