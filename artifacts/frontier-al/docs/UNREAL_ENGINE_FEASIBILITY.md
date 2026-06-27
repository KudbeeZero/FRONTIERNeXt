# Unreal Engine in FRONTIER-AL — feasibility & recommendation

> **Question asked:** "How can we implement Unreal Engine? Is there any way?"
> **Stated goal:** better visual fidelity. **Delivery:** owner asked to be advised.
> **Status:** decision doc. No engine code in this unit — the only code change shipped
> alongside it is a reversible, flag-gated globe swap (see §5).

---

## 1. TL;DR / recommendation

**You cannot "add" Unreal Engine to the current app.** FRONTIER-AL is a pure-browser
three.js game (no native binary, no GPU server). Unreal is a separate C++/Blueprint
engine that compiles to a native executable — there is no package you `pnpm add` to get
Unreal rendering inside the existing React canvas. Unreal can only reach your players via
one of two heavy paths:

1. **Pixel Streaming** — Unreal runs on a cloud **GPU**, streams H.264 video to the
   browser. Keeps the browser entry point; adds a GPU fleet + signalling + TURN.
2. **Native desktop client** — a separate downloadable Unreal app on the existing API.

Both are **multi-month** efforts with real, ongoing cost.

**For your actual goal — better visual fidelity — Unreal is the wrong first move.** The
cheaper, browser-native path is already half-built in this repo (the `globe/v2` lighting
rebuild + an installed-but-unused postprocessing pipeline). **Recommendation: do the
three.js fidelity uplift first** (§5), and keep Unreal Pixel Streaming as a costed,
deferred spike (§7) you can green-light later with eyes open.

---

## 2. What the game is today

| Aspect | Reality | Evidence |
|---|---|---|
| Client engine | three.js `0.170` + React Three Fiber `8.17` (browser WebGL2) | `package.json`, `client/src/components/game/PlanetGlobe.tsx` |
| Map | 21,000 plots as GPU **InstancedMesh** + custom GLSL | `client/src/components/game/globe/GlobeParcels.tsx` |
| Real-time | WebSocket, dirty-flag broadcast every ~1.5s | `server/wsServer.ts` |
| Hosting | Static Vite assets on Fly.io (`frontiernext.fly.dev`); ~$0 incremental render cost | `vite.config.ts` |
| Battle logic | **Deterministic, server-side** (seeded mulberry32) | `server/engine/battle/resolve.ts` |

The renderer is the browser. Nothing on the server renders pixels — so any Unreal path is
an **addition** of a whole new rendering tier, not a swap of a library.

---

## 3. The three Unreal paths

### A. Pixel Streaming (in-browser)
- **How players reach it:** same browser URL; they receive a **video stream** of Unreal
  rendered on a server, sending input back over WebRTC.
- **Infra added:** cloud **GPU** instances (one GPU per ~1–N concurrent players depending
  on resolution/quality), a signalling server, STUN/TURN relays, autoscaling.
- **Cost:** GPU-hours dominate — roughly **$0.50–$3 per concurrent player-hour** (cloud
  GPU list price; assumption stated in §4). Scales with *concurrency*, not MAU.
- **Latency:** encode + network adds **~50–150 ms** on top of your existing WS latency.
- **Server reuse:** all of it — the deterministic engine, WS, DB, chain are untouched;
  Unreal is purely a new client.
- **Effort:** **XL.** Reauthor the globe (21k instances, day/night, atmosphere) in Unreal
  materials, build the Pixel Streaming deployment, wire input + the WS game-state feed.

### B. Native desktop client
- **How players reach it:** download a Windows/Mac Unreal app that talks to the existing
  WebSocket/REST API.
- **Infra added:** none server-side; you gain a **build/sign/distribute** pipeline and a
  second client to keep in sync with the web client.
- **Cost:** no per-player GPU cost (renders on the player's machine); cost is engineering
  time + store/distribution overhead.
- **Latency:** same as today (no streaming hop).
- **Server reuse:** all of it — again a rendering re-skin over the same API.
- **Effort:** **L–XL**, plus the friction that players must install it (a web game asking
  for a download loses most casual traffic).

### C. Full engine replacement
- Throw away the working three.js client and rebuild everything in Unreal. **Out of
  scope** — highest risk, discards shipped, tested code, and still lands on path A or B
  for delivery anyway.

---

## 4. Cost / latency comparison

| | Today (three.js) | A. Pixel Streaming | B. Desktop client |
|---|---|---|---|
| Incremental render cost | ~$0 (player's browser) | **$0.50–$3 / concurrent player-hr** (GPU) | ~$0 (player's machine) |
| Added latency | — | ~50–150 ms | — |
| Player friction | none (open URL) | none (open URL) | **install required** |
| New infra to operate | none | GPU fleet + signalling + TURN | build/sign/distribute |
| Effort to first playable | — | XL | L–XL |

> **Assumption:** the $/player-hour band is cloud GPU list pricing (e.g. a single mid-tier
> cloud GPU at ~$1–3/hr serving 1–several streams). Reserved/spot capacity lowers it;
> high-res/60fps raises it. The point is the **shape**: Pixel Streaming converts a ~$0
> render budget into a per-concurrent-user GPU bill. Validate with a real quote before
> committing.

---

## 5. The cheaper path to the same goal (recommended)

"Better visual fidelity" is achievable **in the browser, now**, reusing assets already in
the repo. Each step is a small, independently auditable PR:

1. **Wire in the v2 lighting rebuild — _shipped in this unit_.** `globe/v2/PlanetGlobeV2`
   (one world-space sun, a single day/night terminator, no magenta corona — see
   `client/src/components/game/globe/v2/REBUILD_NOTES.md`) is now mounted behind the
   **`VITE_GLOBE_V2`** flag (default **off**). It is typecheck + unit-test backed
   (`client/tests/globe-v2-sunmodel.spec.ts`) but **not GPU-verified** — flip the flag on
   a dev/throwaway build to smoke-test (drag the globe → terminator stays put; no magenta).
2. **Postprocessing pass** — `@react-three/postprocessing` is **already installed** and
   largely unused. A Bloom + tuned tone-mapping pass (optional SSAO) is a cheap, large
   perceived-quality jump.
3. **PBR surface + HDR environment** — replace the unlit terrain shader path with a lit
   PBR material and an HDR/IBL environment map for realistic planet shading.
4. **LOD on the 21k instances** — distance-based detail to free GPU headroom for the above.

These deliver most of the visual win Unreal would, at ~$0 incremental cost, with no new
infrastructure, and without losing the browser entry point.

---

## 6. Decision matrix

| Your goal | Recommended path |
|---|---|
| **Better visual fidelity** (your stated goal) | three.js uplift (§5) — start here |
| Cinematics / trailer only | Unreal offline render (no live integration, no streaming infra) |
| Native-grade perf / physics, install acceptable | Unreal **desktop client** (path B) |
| Unreal visuals **and** must stay in-browser | Unreal **Pixel Streaming** (path A) — costed spike first (§7) |
| Replace everything | Not advised (path C) |

---

## 7. If you still want Unreal — a low-risk spike

Don't commit the whole game. Time-box a **proof-of-concept** instead:

- **Scope:** one cloud GPU running Unreal Pixel Streaming, rendering a **static planet**
  (no live game state, no 21k live plots), reachable from one browser.
- **Goal:** measure real latency, real $/hour, and visual delta vs. the §5 three.js uplift
  on the same hardware budget.
- **Exit criteria:** a number for $/concurrent-player-hour and a side-by-side screenshot.
  Then decide path A vs. staying on the three.js uplift — with data, not vibes.
- **Explicitly NOT in the spike:** wiring the WS game-state feed, input mapping, or
  reauthoring the real globe. Those are only worth it after the POC clears.

---

## 8. Non-goals / HARD RULES respected

- **No funds / ASA / mainnet code** touched — this is rendering only.
- **No change to live behavior for current players** — the v2 swap (§5.1) defaults **off**;
  the existing `PlanetGlobe` remains the live globe until the flag is explicitly set.
- **No mock/demo data** introduced into live plot/HUD surfaces — v2 reuses the same live
  `parcels` prop; its deterministic mock biomes only appear when `parcels` is empty
  (preview), exactly as today's globe behaves with no data.
- **No globe/combat behavior change** outside this scoped, flag-gated, reversible swap.
