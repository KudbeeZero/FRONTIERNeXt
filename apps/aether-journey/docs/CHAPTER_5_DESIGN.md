# Aether's Journey — Chapter 5 design doc (finale)

> Status: **spec for the build unit.** Direction from `GAME_ARC.md` §3–5 (locked beats):
> beat = *Descent*; verb = **integration** (recombine the prior verbs under a countdown);
> this is the **first chapter a wrong move can actually fail a stage** (immediate retry —
> still no game-over). The accumulated `trust` + flags resolve into one of **three endings**.
> Picks up after Ch.4's `fix` (position fixed, Mars below).

## 1. Where it picks up

The beacon is decoded, the course is true, and Mars fills the viewport. All that's left is
the **orbital insertion** — the one maneuver the half-broken ship can't autopilot. Aether and
the player fly it **together**, by hand, against a closing window. Everything the journey
taught — steadying her (Ch.1), routing under pressure (Ch.2), triaging scarcity (Ch.3),
trusting a read (Ch.4) — comes back, fast, in sequence.

**Premise — "Descent."** A staged insertion burn. Each stage is a **rapid instance of a prior
verb** under a per-stage countdown; a wrong input **fails the stage** (the ship shudders, you
**retry immediately** — no death), but the finale finally has teeth: mistakes cost the window
and Aether's nerve. How the run has gone sets the difficulty and her help.

Dramatic question: *after everything, can the two of you fly the last, hardest thing as one —
and what does the bond you built actually come to?*

## 2. The mechanic — **Integration** (recombine, under time)

A short fixed **sequence of stages**, each a one-beat callback to an earlier chapter's verb:

| Stage | Verb (echoes) | One-beat action |
|---|---|---|
| **Realign** | Ch.1 repair | hold the core steady through entry shear |
| **Reroute** | Ch.2 wiring | patch the entry vector around a fault |
| **Balance** | Ch.3 triage | shunt the bus to the heat shield |
| **Confirm** | Ch.4 decode | confirm the landing beacon read |
| **Burn** | new — the climax | commit the final retro burn |

**Countdown + fail/retry.** Each stage runs against `secondsPerStage`. A correct action
advances; a wrong action (or the timer expiring) **fails the stage → immediate retry** of the
*same* stage (the ship loses a little, Aether reacts), never a game-over. Retries are the soft
cost that finally bites.

**Accumulated state sets the difficulty (the payoff of the whole run).** `descentTuning(trust)`:
high trust → **more time per stage and Aether assists** (she pre-flags the right move); mid →
tighter, on your own; low → tightest, and she's quiet. Ch.1's "assistance scales with the bond"
rule, now at the climax. (Carried resource flags — `lifeSupport_critical`, `comms_lost` — can
later shave time further; out of scope for the first unit.)

**Win → the ending.** Completing all stages triggers the **ending resolution**, a *pure function
of state* — `resolveEnding(trust, flags)`:
- Hard override: **`sacrificed_aether` → Severance**, regardless of the number (you chose the ship over her; that's the cost).
- Else base on trust thresholds (the shipped `endingFor`): ≥70 **Bonded**, ≥35 **Functional**, else **Severance**.
- Upgrade: a **`trusted_aether_blind`** leap that paid off pulls a *Functional* up to **Bonded** (you trusted her when it was hardest).

The three endings (existing `ENDING_COPY`) render on the EndCard, replacing the temporary
"first crossing" terminus that Ch.2–4 reused.

## 3. Extension seams (maps 1:1 to the current architecture)

| Seam | File | Change |
|---|---|---|
| **Sequence + tuning + ending (pure)** — *this unit* | new `src/lib/descent.ts` | `DESCENT_STAGES`, `descentTuning(trust)`, `resolveEnding(trust, flags)` (+ re-export `Ending`/`ENDING_COPY` from `decisions.ts`). **Unit-tested.** |
| **Phase union** | `src/store/types.ts` | add `"descent"` (the staged burn) and `"arrival"` (touchdown → ending). `OnchainEvent["kind"]`: `STAGE_PASSED`, `STAGE_FAILED`, `DESCENT_COMPLETE`. |
| **Store** | `src/store/gameStore.ts` | `descent` slice (`stageIndex`, `stageFails`). Methods: `beginDescent()`, `passStage()`, `failStage()` (retry same stage + log), `completeDescent()` (→ `arrival`, resolve + record the ending). |
| **Dialogue** | `src/data/dialogue.ts` | `descent`/`arrival` arrays; Aether's lines scale with `descentTuning.assist` + react to fails. |
| **3D scene** | `src/three/SceneCanvas.tsx` + new `src/three/Descent.tsx` | the staged burn board (an `<Html>` sequence panel + countdown) during `phase === "descent"`. |
| **Endings** | `src/ui/CinematicLayer.tsx` (`EndCard`) | replace the temporary copy with the `resolveEnding` result + `ENDING_COPY`; keep the ledger/Claim + stats. |
| **Gate CTAs** | `src/ui/DialogueOverlay.tsx` | Ch.4 `fix` CONTINUE → `beginDescent()` (replacing the temporary `concludeRun` terminus); `descent` gates on the board; `arrival` → the ending card. |

## 4. Scope — in vs. out

**This unit (first Ch.5 PR):** the pure `descent` sequence + `descentTuning` + `resolveEnding`
+ **tests** (tuning thresholds, stage integrity, every ending reachable incl. the flag overrides).
No store/scene yet — rules first, like every chapter.

**Next units:** Phase/event union + store `descent` slice (stage progression, fail/retry, the
real-time countdown) → the `Descent` scene + the **endings EndCard** (wires `resolveEnding` into
the payoff and re-points Ch.4's `fix` terminus into `beginDescent`). **Out (later):** carried
resource flags shaving the timer; per-ending bespoke cinematics; Algorand persistence of the run.

## 5. Decisions (locked) + residual (safe defaults)

**Locked:** beat = Descent · verb = integration under a countdown · first real stage-fail (retry,
no game-over) · 3 trust+flag-gated endings.

**Residual (defaulted; flag if you disagree):**
1. **Stage timings** — `descentTuning`: trust ≥70 → 12s + assist; ≥35 → 9s; else 7s. Tunable.
2. **Ending overrides** — `sacrificed_aether` forces Severance; `trusted_aether_blind` upgrades
   Functional→Bonded. Thresholds otherwise the shipped `endingFor` (70 / 35).
3. **Five stages** (one per prior verb + the burn). Could trim to 4 if pacing drags in playtest.
