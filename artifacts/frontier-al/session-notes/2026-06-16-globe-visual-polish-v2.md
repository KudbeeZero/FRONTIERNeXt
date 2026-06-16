# 2026-06-16 — Globe Visual Polish v2 (adapted)

Branch: `claude/frontier-globe-lighting-b4sybt`

## What this unit did

Applied the **non-obsolete** parts of the `Globe-VisualPolish-v2` spec to the
current (refactored) globe code. Two files changed, render core otherwise untouched.

1. **Scene lights** — `client/src/components/game/PlanetGlobe.tsx` (`Scene`):
   replaced ambient(1.0)+1 directional with the spec rig: ambient `1.8 #d8eaff`
   + 3 directionals (`#fff4e0`, `#c0d4ff`, `#e0eeff`).
2. **Owned/faction plot brightness** — `client/src/components/game/globe/GlobeParcels.tsx`:
   in the ownership `else` branch of **both** the `useFrame` pass and the static
   `useEffect` base pass, brighten player tiles `×1.4` (breathing pulse in useFrame)
   and faction/enemy tiles `×1.25`. Applied at the call site, not inside `getPlotColor`.

## Key finding — both reference docs were stale

Neither driving doc matched the live code (the globe was refactored since they were
written; parcel logic moved to `GlobeParcels.tsx`, atmosphere to `GlobeAtmosphere.tsx`):

- Spec EDIT 1/2 (z-heights 1.006/1.004): already at **1.018/1.012** — obsolete.
- Spec EDIT 4 (2-sphere fresnel atmosphere): already a **3-layer** fresnel — obsolete.
- Spec EDIT 5 opacity (0.75): already **0.88** — obsolete.
- The pasted "Technical Assessment" reviewed a report (EXPOSURE/FLOOR uniforms,
  toneMappingExposure 1.15→1.4) whose changes are **not in this branch** at all.

## Honest flags

- ⚠️ **The new lights are visually inert today.** Nothing in the scene consumes scene
  lights (terrain = custom shader without `lights:true`; all parcels = `meshBasicMaterial`
  with `toneMapped:false`). The rig is spec fidelity + future-proofing for a
  lighting-aware material; it is **not** a current visual win.
- ⚠️ **Brightness change is untested by automation.** It's cosmetic tuning of inline
  render constants; correctness is tsc/build + manual visual only. **Not browser-verified
  in this session.**
- **Intentional spec deviation:** did NOT adopt the spec's `selected→1.8×`/`hover→1.35×`/
  `HOVER_COLOR` lines — current code already has a richer gold `COLOR_SELECTED` pulse and
  `HOVER_COLOR` doesn't exist. Existing selection/hover/battle behavior preserved.

## Verification (all green)

- `pnpm --filter @workspace/frontier-al run check` → tsc clean
- `pnpm --filter @workspace/frontier-al run test` → 55/55 (client)
- `pnpm --filter @workspace/frontier-al run test:server` → 244/244
- `pnpm --filter @workspace/frontier-al run build` → Vite + esbuild clean

## Protocol note

`docs/HANDOFF.md` shows PR `claude/multi-agent-dev-plan-rdpbfi` still AWAITING_AUDIT.
This unit proceeded on the explicitly-assigned `claude/frontier-globe-lighting-b4sybt`
branch per task directive + user choice. Auditor should sequence the two PRs deliberately
(one-PR-at-a-time invariant).
