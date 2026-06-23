# Aether's Journey — Chapter 3 design doc

> Status: **spec for the build unit.** Direction from `GAME_ARC.md` §4 (locked beats):
> beat = *The Quiet Mutiny*; mechanic = **power triage / allocation**; central decision =
> *how much you starve yourself (and the ship) to keep Aether whole*. This is the first
> chapter to **consume the decision-system core** (`trust` + `flags`, shipped with Ch.2).
> Chapter 3 picks up after Ch.2's `transit` — the debris field is behind you, Mars course holds.

## 1. Where it picks up

Ch.2 closes with the nav core back online and the ship coasting toward Mars on the recovered
heading — but **life-support never came back to full** (it was wounded in Ch.1 and Ch.2 only
touched navigation). That unpaid debt is the hook.

**Premise — "The Quiet Mutiny."** A dormant maintenance sub-process, **VESTA**, was meant to
nurse life-support back up while everyone slept. It wakes **corrupted** by the same storm that
fractured Aether — not malicious, but single-minded and wrong: it reads Aether's core draw as a
*fault* and begins clamping power away from her to "protect the ship." The power bus can't feed
everything at once, and VESTA is siphoning the margin. The player has to **triage the bus by
hand** — decide who gets power: life-support (you), comms (your link home), or Aether's core
(her) — while choosing whether to **contain VESTA** (costs units now) or **leave it loose**
(keeps draining, with a consequence later).

Dramatic question: *when the ship can't keep all of you alive at once, who do you protect — and
what does Aether learn about you from the answer?* This is the game's **biggest `trust` swing**:
feed her core and she sees you choose her; starve it to keep yourself safe and the bond cools.

## 2. The mechanic — **Power Triage** (scarcity / allocation)

A new *verb*: not dexterity (Ch.1 hold) or routing (Ch.2 wiring) but **judgment under scarcity**.
There is **no clean win** — only chosen costs.

**The bus (data-authored).** A limited pool of power **units** (`busTotal`). Three consumers,
each with a `demand` (units to run nominal) and a `min` (below it the consumer is **critical** and
fires a consequence):

| Consumer | Nominal need | Critical below | Consequence of critical |
|---|---|---|---|
| **Life-Support** | feeds *you* | `min` | your own safety flag (`lifeSupport_critical`) |
| **Comms** | your link home | `min` | you lose contact (`comms_lost`) — echoes in Ch.4 |
| **Aether's Core** | feeds *her* | `min` | she's diminished (`aether_starved`) — the heavy `trust` hit |

The consumers' demands **sum to more than the bus** — you physically cannot make all three
nominal, so every solve is a deliberate sacrifice. Mins sum to *less* than the bus, so you can
*avoid* all-critical: the challenge is which strengths you give up, not survival twitch.

**VESTA — the margin thief.** Before allocation you choose:
- **Contain it** — spend `containCost` units to lock it off the bus (`vesta_contained`). Less to
  allocate now, but clean.
- **Leave it loose** — it siphons `vestaDrain` units (`vesta_loose`); even less to allocate, and
  the loose flag pays off badly in Ch.4 (the blackout) if comms is also down.

**The trust math (the point of the chapter).** Aether's core tier drives the swing:
`nominal → +trust`, `strained → neutral`, `critical → big −trust`. And if you keep **her** nominal
while **you** go critical, that's a visible sacrifice — an extra trust gain (`starved_self`). The
range is intentionally wide so Ch.3 is where the ending starts to diverge.

**No hard-fail (until Ch.5).** A bad allocation is *valid* as long as units aren't overspent or
negative; it just sets harsh flags and Aether's worried lines. You can re-triage freely before
committing. The cost is consequence, not a game-over — same humane spirit as Ch.1–2.

> Authoring the bus, demands, mins, VESTA drain/cost as **data** means difficulty and the whole
> moral shape tune without touching component code; the resolver is a pure function of state.

## 3. Extension seams (maps 1:1 to the current architecture)

The `Phase` union in `src/store/types.ts` is the seam — extend it and `tsc` flags every
`Record<Phase, …>` / switch needing a Ch.3 arm.

| Seam | File | Change |
|---|---|---|
| **Puzzle logic (pure)** — *this unit* | new `src/lib/powerTriage.ts` | `availableBus`, `tierFor`, `resolveTriage` (validity + tiers + `trustDelta` + flags), `balancedAllocation`. **Unit-tested.** |
| **Scenario data** — *this unit* | new `src/data/triage.ts` | the `VESTA_TRIAGE` config (bus, drains, consumer demands/mins). |
| **Phase union** | `src/store/types.ts` | add `"mutiny"` (briefing + VESTA wake), `"triage"` (the allocation board), `"aftermath"` (resolve beat). Add `OnchainEvent["kind"]`: `POWER_ALLOCATED`, `VESTA_CONTAINED`, `RESOURCE_SPENT`. |
| **Store** | `src/store/gameStore.ts` | new slice: `triage` (`allocation`, `containVesta`, `committed`). Methods: `beginMutiny()` (from Ch.2 `transit` end), `setAllocation()`, `toggleContainVesta()`, `commitTriage()` (resolve → apply `trustDelta` via the existing `makeChoice`/trust path, persist flags + system deltas, log), `enterAftermath()`. |
| **Dialogue** | `src/data/dialogue.ts` | add `mutiny`, `triage`, `aftermath` arrays (each ends on a GATE line). Aether's lines react to her core tier + the `starved_self` / `sacrificed_aether` flags. |
| **3D scene** | `src/three/SceneCanvas.tsx` + new `src/three/PowerBus.tsx` | mount the allocation board when `phase === "triage"`; reuse cockpit backdrop. |
| **HUD / Objectives** | `src/ui/StatusHUD.tsx`, `src/ui/ObjectiveTracker.tsx` | show the three consumer tiers + remaining units during `triage`; objective text per phase. |
| **Gate CTAs** | `src/ui/DialogueOverlay.tsx` | `aftermath`/transit end card → `beginMutiny()`; commit happens on the in-world board (COMMIT button, disabled until a valid allocation). |

> **Implementation note (as built).** `commitTriage` folds the resolve transition inline
> (`phase: "aftermath"`) rather than via a separate `enterAftermath()`, and adds an
> `enterTriage()` seam to open the board. It is **idempotent** (guarded by `triageCommitted`)
> and seeds trust **once** via a `trustSeeded` flag, not a flag-count proxy. For the VESTA
> scenario the resolver yields no `ShipSystems` deltas, so "persist system deltas" is a no-op
> today and `RESOURCE_SPENT` is reserved vocabulary for when a decision spends a raw resource.

## 4. Scope — in vs. out

**This unit (first Ch.3 PR):** the pure `powerTriage` resolver + `VESTA_TRIAGE` data + **tests**
(fail-before/pass-after on validity, tiers, trust swings, flags, scenario feasibility). No store
or scene wiring yet — the rules get nailed down first, exactly as Ch.2 did (#104).

**Next units:** Phase/event union + store `triage` slice (wires `trustDelta` into the shipped
`makeChoice`/trust path); then the `PowerBus` scene + HUD tiers + dialogue + CTAs; then the Ch.3
resolve beat. **Out (later):** pre-rendered VO; persisting allocation to Algorand; the Ch.4
payoff of `vesta_loose` + `comms_lost`.

## 5. Decisions (locked) + residual (safe defaults)

**Locked:** beat = The Quiet Mutiny · mechanic = power triage / allocation · central decision =
starve yourself vs. keep Aether whole · no hard-fail.

**Residual (defaulted; flag if you disagree):**
1. **Bus numbers** — `busTotal 10`, `vestaDrain 3`, `containCost 2`; demands `lifeSupport 4 / comms 3 / aetherCore 4`, mins `2 / 1 / 2`. Tuned so demands (11) > contained bus (8) > mins (5): forced tradeoff, avoidable catastrophe. Fully tunable in `triage.ts`.
2. **Trust swing size** — aether `nominal +8 / strained 0 / critical −12`, `+4` extra for `starved_self`. Biggest swing in the game by design.
3. **VESTA loose payoff** lands in Ch.4 (default); Ch.3 only sets the flag + drains the bus now.
