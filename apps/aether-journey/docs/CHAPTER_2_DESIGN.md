# Aether's Journey — Chapter 2 design doc

> Status: **approved direction, no code yet.** Decisions locked with the owner:
> beat = *The Debris Field*; mechanic = **wiring/logic (nav-circuit reroute)**; failure =
> **soft fuel cost** (no hard lose); length = **two stages**. Phase 1 ends at `stabilized`
> (Aether healed, course locked to Mars); Chapter 2 continues from there. This doc is the
> spec the build unit implements.

## 1. Where it picks up

Phase 1 closes with Aether stabilized and the Mars course locked — but the ship is still wounded
(`StatusHUD` shows **life-support** never fully recovered; only `power` + `navigation` came back during
the repair). Chapter 2 cashes that in.

**Premise — "The Debris Field."** Minutes after the course lock, proximity alarms: the same solar storm
that fractured Aether shattered a derelict ahead into a slow debris field directly on the Mars heading.
Autopilot **can't** solve it — the nav computer's **routing logic was fried** in the storm, so it can't
compute a trajectory. Aether and the player have to **re-wire the nav core by hand** to bring
trajectory-solving back online before the ship drifts into the field. Aether is lucid now but newly
anxious: she's afraid of getting it wrong and hurting the one human she just bonded with. The chapter is
about **trust flowing the other way** — in Ch.1 you steadied her; here she has to trust you at the panel
while she feeds you the logic.

Dramatic question: *can a half-broken ship and a still-healing AI rebuild the mind that steers them, in
time?*

## 2. The mechanic — **Nav-Circuit Reroute** (wiring / logic)

A different *verb* from Ch.1's press-and-hold: instead of holding a node, the player **lays wires across
a circuit board** to restore the nav computer's logic, in **two escalating stages**.

**The board (data-authored):** a grid of **terminals** (sources ▸ and sinks ◂, color/label-matched),
**junctions** including **logic gates** (AND / OR / NOT), and **damaged cells** wires can't cross. The
player drags wire paths terminal→terminal; a board is solved when **every sink receives the correct
signal** through the gates.

**Two stages:**
- **Stage 1 — Power routing.** Simple matched source→sink wiring around damaged cells. Teaches the verb:
  drag, reroute, no crossings. No gates yet.
- **Stage 2 — Logic restoration.** Adds AND/OR/NOT junctions: a sink only powers if its gate's inputs are
  satisfied, so the player must reason about *which* sources feed *which* gate. This is the "logic" payoff
  and the harder board.

**Soft fuel cost (the only tension):** a **DRIFT / FUEL** meter sits above the board. A **short** — wiring
two mismatched terminals, or a path that clips a damaged cell — is rejected **and** vents a small amount of
fuel (the ship drifts a little closer). It **never hard-fails**: fuel can deplete fully and you keep trying,
but low fuel triggers Aether's worried lines and a redder HUD, so sloppiness *feels* costly without a game
over. Matches Phase 1's no-lose spirit, with a bit more edge.

**Aether as collaborator, not timer:** her carried-over `aetherStability` sets how much help she gives —
high stability → she pre-highlights one correct terminal per stage and calls out shorts a beat earlier; low
→ you're more on your own. A clean Ch.1 makes Ch.2 gentler without gating it.

**Win:** both boards solved → nav logic reboots → a short **transit** cinematic flies the ship through the
field → resolve beat. Fuel remaining is logged to the ledger (a soft score, not a gate).

> Authoring everything (board layout, terminals, gates, damaged cells, fuel budget, drift-per-short) as
> **data** means difficulty + both stages are tunable without touching component code.

## 3. Extension seams (maps 1:1 to the current architecture)

The `Phase` union in `src/store/types.ts` is the single seam — extend it and `tsc` flags every
`Record<Phase, …>` / switch that needs a Ch.2 arm.

| Seam | File | Change |
|---|---|---|
| **Phase union** | `src/store/types.ts` | add `"approach"` (alarm + briefing), `"rewiring"` (the two-stage puzzle), `"transit"` (resolve cinematic). Add `OnchainEvent["kind"]`: `NAV_STAGE_CLEARED`, `NAV_ONLINE`, `TRANSIT_COMPLETE`. |
| **Store** | `src/store/gameStore.ts` | new slice: `circuit` (`stage: 1\|2`, `connections[]`, `fuelRemaining`). Methods: `beginApproach()` (from `stabilized`), `enterRewiring()`, `applyShort()` (decrement fuel + log), `commitStage()` (validate board → advance stage 1→2, or stage 2→`transit`), `completeTransit()`. |
| **Puzzle logic (pure)** | new `src/lib/navCircuit.ts` | pure validators: `isValidConnection`, `evaluateGates`, `isBoardSolved(board, connections)`. **Unit-tested** (fuel/short rules, gate truth tables, win condition). Keeps logic out of the R3F component. |
| **Board data** | new `src/data/circuits.ts` | the two `CircuitBoard` definitions (terminals, gates, damaged cells, fuel budget). |
| **Dialogue** | `src/data/dialogue.ts` | add `approach`, `rewiring`, `transit` arrays to `DIALOGUE` (each ends on a GATE line, `autoMs: 0`). Aether lines react to shorts / low fuel via `glitch`/`mood`. |
| **3D scene** | `src/three/SceneCanvas.tsx` + new `src/three/NavCircuit.tsx` | mount `<NavCircuit />` when `phase === "rewiring"`; a brief `<TransitFlight />` / camera move for `transit`. Reuses `ForwardViewport` + `Cockpit` as backdrop. |
| **Objectives** | `src/ui/ObjectiveTracker.tsx` | add per-phase text ("REROUTE POWER", "RESTORE NAV LOGIC", "HOLD ON…"). |
| **HUD** | `src/ui/StatusHUD.tsx` | surface the DRIFT/FUEL meter during `rewiring`. |
| **Gate CTAs** | `src/ui/DialogueOverlay.tsx` | `stabilized` end card gains "▸ TO THE NAV CORE" → `beginApproach()`; stage commits happen on the in-world board (COMMIT button, disabled w/ reason until solved). |
| **VO (optional)** | `voice_lines/manifest.json` | register Ch.2 `voiceId`s; Web-Speech fallback if unrendered (same as Ch.1). |

## 4. Scope — in vs. out for this unit

**In (Chapter 2):** the three new phases wired end-to-end; the two-stage `NavCircuit` puzzle (pure logic in
`navCircuit.ts` + data boards in `circuits.ts`); soft fuel/short cost; Aether-assist scaled by stability;
dialogue for all three beats (Web-Speech fallback — no pre-rendered VO required to ship); objective + HUD +
ledger updates; a short transit payoff. **Tests:** `navCircuit.ts` validators (fail-before/pass-after).

**Out (later units):** pre-rendered ElevenLabs VO for Ch.2; dialogue branching; persisting circuit/fuel to
Algorand boxes; more than the two authored boards; `prefers-reduced-motion` polish on the new scene (note +
do in a polish pass).

## 5. Decisions (locked) + residual questions

**Locked:** beat = The Debris Field · mechanic = nav-circuit wiring/logic · failure = soft fuel cost · length
= two stages (power routing → logic restoration).

**Residual (safe to default; call out if you disagree):**
1. **Drift-per-short** starting value (default: ~6% of budget per short; fully tunable in `circuits.ts`).
2. **Stage-2 gate set** — start with AND + NOT only (clearest), add OR if it plays too easy.
3. Whether low fuel changes the *transit* cinematic (default: same cinematic; fuel only flavors HUD +
   Aether lines + ledger score).

## 6. Build plan (the NEXT unit, once this doc is merged)

1. Extend `Phase` + `OnchainEvent` unions; let `tsc` surface every gap.
2. `src/lib/navCircuit.ts` (pure) + `src/data/circuits.ts` (two boards) + **unit tests** for connection
   validity, gate evaluation, short/fuel rules, board-solved.
3. Store `circuit` slice + `beginApproach`/`enterRewiring`/`applyShort`/`commitStage`/`completeTransit`.
4. `src/three/NavCircuit.tsx` (data-driven board) + `SceneCanvas` mounts + transit beat.
5. Dialogue arrays + `ObjectiveTracker` + `StatusHUD` fuel meter + `DialogueOverlay` CTA.
6. `pnpm --filter @workspace/aether-journey check` + `build` green; manual two-stage play-through.
