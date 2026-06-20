# 2026-06-20 — Strategic Depth Program (design doc, doc-only)

## Unit
Owner pivoted from the Phase-2 battle-stats client wire-up to scope a **major strategic-depth overhaul**:
rationalize plot upgrades, make archetype abilities actually affect systems, realize the sub-parcel
royalty model, interconnect upgrades↔archetypes↔sub-parcels↔terraforming↔battle↔economy into real
economic/control/societal consequences (thrive vs suffer, superpowers vs small allies), add plot features
(asteroids/nuclear), and fix UI/routes. Owner: "put all of this together in a plan." → doc-only design unit.

## What shipped
- `artifacts/frontier-al/docs/design/strategic-depth-program-design.md` (NEW) — grounded program design:
  current-state map (from a 3-agent code sweep, with file refs) **confirming the critique** (data_centre
  yield dead; archetype faction bonuses/power-dependency inert; center subplot not conquest-exempt; no
  yield royalty; factions have no diplomacy/treasury/tariffs; routes siloed; no plot-feature field),
  the 4 locked decisions, target design, and a phased one-PR-per-unit decomposition (SD-A wire inert
  abilities → SD-B royalty/center permanence → SD-C regional control cascade → SD-D asteroid/nuclear
  features → SD-E faction politics → SD-F faction perception lens), with HARD-RULE gates flagged and open
  questions per phase.

## Owner decisions (AskUserQuestion)
1. Royalty = **perpetual yield royalty** (center conquest-exempt + standing % of plot yield forever).
2. Archetypes = **wire up what exists first** (data_centre yield, faction bonuses, power dependency, shield_gen).
3. Politics first slice = **regional control cascade** (extend `influence` 0-100 to neighbors).
4. Plot features = **economic + military** (asteroid yield deposits + nuclear strike).
Plus a new idea added as **SD-F**: a faction **perception lens** (presentation shifts with faction lean +
intensity; lean drifts over time) — perceptual/narrative only, never alters deterministic outcomes.

## Scope / safety
Doc-only. No code/schema/funds/canvas change. `/code-review` + `/security-pass` are N/A (no code diff);
`/pr-gate` only. CI runs typecheck/tests (unaffected).

## Verification
No code changed; `check`/`test:server` (318)/client (76)/`build` remain green from #77's merge. CI on the
PR head re-confirms.

## Follow-ups
Begin implementation at **SD-A1** (wire `data_centre` yield into mining) — smallest, deterministic,
immediately makes the world feel coherent. One PR at a time per the design's sequencing.
