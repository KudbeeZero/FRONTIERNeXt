# 2026-06-27 — Unreal Engine feasibility + flag-gated globe v2

**Branch:** `claude/unreal-engine-implementation-yfcz16`
**Question:** "How can we implement Unreal Engine? Is there any way?" → goal = better
visual fidelity; delivery = "advise me".

## What shipped (one unit)

1. **`docs/UNREAL_ENGINE_FEASIBILITY.md`** — honest decision doc. Unreal can't be dropped
   into the React app; it only reaches players via Pixel Streaming (cloud GPU, ~$0.50–$3/
   concurrent player-hr, +50–150 ms) or a native desktop client (install friction). Both
   are multi-month. Recommendation: do the browser-native three.js fidelity uplift first,
   keep Unreal as a costed, deferred spike.
2. **Flag-gated globe v2** — wired the already-built, test-backed `globe/v2/PlanetGlobeV2`
   behind **`VITE_GLOBE_V2`** (default **off**). Files:
   - `client/src/lib/globeVersion.ts` (new flag, mirrors `testMode.ts`).
   - `client/src/components/game/GameLayout.tsx` (conditional at the single mount site;
     old `PlanetGlobe` is the default branch).
   - `ENV_VARS.md` + `docs/DEPLOYMENT_ENV_CHECKLIST.md` (documented; keep unset in prod).

## Does it work?

- **Test-backed:** `check` (tsc) green; client suite **189/189** green (incl. existing
  `globe-v2-sunmodel.spec.ts`). Flag defaults off → live render path unchanged.
- **NOT GPU-verified** in this environment. v2 is a **visual preview only** — it does not
  yet support selection sync / battles / weapon layers (extra `PlanetGlobe` props are not
  threaded to v2). Owner smoke-test required: `dev`, set `VITE_GLOBE_V2=true`, drag the
  globe → terminator stays put, no magenta; unset → old globe returns.

## Next units (from the doc §5)

1. Postprocessing pass (`@react-three/postprocessing` already installed) — Bloom + tone map.
2. PBR surface + HDR environment map.
3. LOD on the 21k instances.
4. (Deferred, costed) Unreal Pixel Streaming spike — only if the uplift isn't enough.

## HARD RULES

No funds/ASA/mainnet touched; no live-player behavior change (flag off by default); no
mock data into live surfaces; reversible (remove the conditional, v2 dir stays).
