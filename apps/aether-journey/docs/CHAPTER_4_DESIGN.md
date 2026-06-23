# Aether's Journey — Chapter 4 design doc

> Status: **spec for the build unit.** Direction from `GAME_ARC.md` §3–4 (locked beats):
> beat = *Blackout*; new verb = **deduction under uncertainty**; central decision =
> *trust Aether's read vs. override it with your own*. Picks up after Ch.3's `aftermath`
> — the bus is set, trust has moved, and the consequences of Ch.3 (`comms_lost`,
> `vesta_loose`) come due here.

## 1. Where it picks up

Mars is close, but the approach crosses the planet's **shadow** — a comms dead zone where
the storm-scarred instruments go unreliable. If Ch.3 left **comms critical** (`comms_lost`)
or **VESTA loose** (`vesta_loose`), the blackout bites harder: more noise, fewer clean
clues. The ship is flying half-blind and has to **fix its position from a degraded beacon**
before the insertion window in Ch.5.

**Premise — "Blackout."** A navigation beacon is still transmitting, but the signal is
corrupted to a short coded burst. Aether can hear it too — and for the first time she is
*unsure*. She'll offer a **read** of the code, but she tells you plainly she might be wrong,
and the instruments can't confirm. The chapter is the inverse of Ch.1: there you trusted a
broken AI; here you decide, **under real uncertainty**, how much to trust a healing one.

Dramatic question: *when neither of you can be certain, do you defer to her judgment or back
your own — and what does that say about the bond you've built?*

## 2. The mechanic — **Signal Decode** (deduction)

A new *verb*: not allocation (Ch.3) but **inference from partial feedback** — a
Mastermind-style decode. The beacon's true code is a hidden sequence of **glyphs**; each
**probe** the player submits returns only **how close** it was, never which positions:

- **exact** — right glyph, right position.
- **partial** — right glyph, wrong position (duplicate-correct, classic Mastermind scoring).

From a few probes the player narrows the space and locks the code. **No hard-fail** (until
Ch.5): probes are unlimited, but each one costs a beat of the closing window, and Aether's
worry grows — so efficient deduction *feels* better without a game-over.

**Aether as a fallible partner (the decision).** At any point Aether will surface a
**proposal** — a code **consistent with every probe so far** (a real deductive step, not an
oracle). Crucially, when many candidates remain consistent, her proposal **may be wrong** —
and she says so, with a confidence that scales with how few candidates remain (and with
carried `trust`). The player's choice each round:

- **Trust her** — submit her proposal. Early, that's a *gamble* on incomplete information; late, it's the fast finish. Locking the code on her proposal is the game's clearest **"I trust you"** beat (trust ↑, flag `trusted_aether_blind` if done while uncertainty was high).
- **Override** — deduce and submit your own probe. Backs your own read (flag `solo_decode`); neither warmer nor colder by itself, but a wrong *trusting* lock that she warned about can sting the bond.

**Uncertainty is real and measured.** The engine tracks how many candidate codes remain
consistent with the feedback (`remainingCount`); that number drives Aether's confidence
line, the HUD, and whether trusting her is a leap or a formality. Carried `trust` scales how
much she narrows for you (high trust → she eliminates an extra candidate class; low → you're
more on your own) — Ch.1's "assistance scales with the bond" rule, now applied to inference.

**Win:** an exact lock (all glyphs, all positions) → position fixed → short cinematic →
resolve beat that sets up the Ch.5 descent. Probes used + whether you trusted her are logged.

> Glyphs, code length, palette, the secret, and Aether's confidence curve are all **data**,
> so difficulty (search-space size) and the trust tension tune without touching components.

## 3. Extension seams (maps 1:1 to the current architecture)

| Seam | File | Change |
|---|---|---|
| **Puzzle logic (pure)** — *this unit* | new `src/lib/beacon.ts` | `score` (exact/partial w/ duplicates), `isSolved`, `consistent`, `firstConsistent` (Aether's deductive proposal), `remainingCount` (uncertainty), `allCodes`. **Unit-tested.** |
| **Beacon data** — *this unit* | new `src/data/beacon.ts` | the Ch.4 `BeaconPuzzle` (length, palette glyphs, secret) + Aether confidence thresholds. |
| **Phase union** | `src/store/types.ts` | add `"blackout"` (briefing), `"decode"` (the probe board), `"fix"` (resolve). `OnchainEvent["kind"]`: `PROBE_SENT`, `SIGNAL_LOCKED`, plus reuse `DECISION_MADE`/`TRUST_SHIFT`. |
| **Store** | `src/store/gameStore.ts` | `decode` slice (`probes[]`, `aetherProposal`). Methods: `beginBlackout()`, `enterDecode()`, `submitProbe(code)` (scores + records, locks on exact → trust/flags via `makeChoice`), `acceptAetherProposal()` (the trust path), `completeFix()`. |
| **Dialogue** | `src/data/dialogue.ts` | `blackout`/`decode`/`fix` arrays (GATE-terminated); Aether's lines react to `remainingCount` (confident vs. "I'm not sure") and to a wrong trusting lock. |
| **3D scene** | `src/three/SceneCanvas.tsx` + new `src/three/SignalDecode.tsx` | mount the decode board (an `<Html>` probe panel like PowerBus) when `phase === "decode"`; freeze OrbitControls then. |
| **HUD / Objectives** | `src/ui/StatusHUD.tsx`, `src/ui/ObjectiveTracker.tsx` | show probes used + candidates-remaining during `decode`; objective text per phase. |
| **Gate CTAs** | `src/ui/DialogueOverlay.tsx` | `aftermath` (Ch.3) CONTINUE → `beginBlackout()` (replacing the temporary `concludeRun` terminus); `blackout` → "READ THE SIGNAL" → `enterDecode()`; `decode` gates on the board; `fix` → continue toward Ch.5. |

## 4. Scope — in vs. out

**This unit (first Ch.4 PR):** the pure `beacon` deduction engine + `BeaconPuzzle` data +
**tests** (scoring incl. the duplicate-glyph edge cases, consistency, the solver/proposal,
uncertainty count). No store/scene yet — rules first, exactly like Ch.2 (#104) and Ch.3 (#107).

**Next units:** Phase/event union + store `decode` slice (wires the trust decision through the
shipped `makeChoice` path) → the `SignalDecode` scene + HUD + dialogue + CTAs (and re-points
Ch.3's `aftermath` from the temporary `concludeRun` terminus into `beginBlackout`). **Out
(later):** pre-rendered VO; persisting probes to Algorand; Ch.5 reading `trusted_aether_blind`.

## 5. Decisions (locked) + residual (safe defaults)

**Locked:** beat = Blackout · verb = deduction (signal decode) · central decision = trust
Aether's read vs. override · no hard-fail.

**Residual (defaulted; flag if you disagree):**
1. **Search space** — length **4**, palette **6** glyphs (1296 codes; classic Mastermind).
   Tunable in `beacon.ts`/`data`; Ch.3 `comms_lost`/`vesta_loose` can later widen it.
2. **Aether's proposal** — deterministic `firstConsistent` (first code consistent with all
   feedback). Honest deduction, reproducible, testable; trust only scales her *confidence
   wording* + a possible extra elimination, never an oracle peek at the secret.
3. **High-uncertainty threshold** for the `trusted_aether_blind` flag — default `remainingCount > 4`
   when locking on her proposal. Tunable.
