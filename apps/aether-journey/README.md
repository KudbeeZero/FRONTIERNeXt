# FRONTIER: Aether's Journey — Phase 1

The intimate, cinematic **prologue** to the larger FRONTIERNeXt strategy game.
You are the only human awake aboard the *Aether Voyager*. A solar storm has
fractured the ship's AI companion, **Aether** — she is not hostile, she is
*hurt*. Stabilize her, and lock the course to Mars.

This is a high-polish, client-only **Phase 1 MVP**: the opening wake-up sequence,
first contact with a damaged AI, and one satisfying hands-on repair — built so
ship systems, Aether's state, and player decisions can later be recorded on
Algorand without reshaping the runtime model.

## Run it

From the repo root (this is a pnpm workspace):

```bash
pnpm install
pnpm --filter @workspace/aether-journey dev
```

…or from this folder:

```bash
cd apps/aether-journey
pnpm dev        # http://localhost:5173
```

> The repo enforces **pnpm** (an npm/yarn `preinstall` guard will stop `npm install`).
> `pnpm dev` is the equivalent of the `npm run dev` flow.

Other scripts: `pnpm build` (typecheck + production bundle), `pnpm preview`,
`pnpm check` (typecheck only).

## What's in Phase 1

| Beat | What happens |
|---|---|
| **Wake-up** | Fade from black, bloom + vignette + film-grain post, a battered cockpit with a flickering damaged panel, drifting dust in god-rays, and Mars framed in the forward viewport. |
| **Aether** | An elegant, glitching holographic presence. Her color, jitter and dropout are **data-driven** by `aetherStability` — she literally steadies as you heal her. Dialogue uses live text corruption + modulated Web Speech. |
| **Diagnose** | Touch the glowing console control (or the HUD button) to run a neural-matrix diagnostic and isolate the fault. |
| **Repair** | **Press & hold** each desynced neural node until its containment ring fills and it locks into phase — the physical, satisfying core of the loop. |
| **Payoff** | Aether comes back online, power/nav recover with her, the course to Mars locks, and the session's actions are shown in the Algorand-ready ledger. |

## Architecture

```
src/
  main.tsx            React entry
  App.tsx             Composes the 3D scene + HUD overlays + cinematic bookends
  index.css           Tailwind + cockpit/holographic styling, scanline veil
  store/
    gameStore.ts      Zustand store — the canonical session record
    settingsStore.ts  Persisted settings (audio/voice/motion) + local run stats
    types.ts          On-chain-ready types (Phase, ShipSystems, OnchainEvent…)
  data/
    dialogue.ts       Aether's scripted lines (per-phase, with glitch levels)
  lib/
    audioEngine.ts    Procedural Web-Audio soundscape + Web-Speech (no asset files)
    glitch.ts         Text-corruption helpers
  three/
    SceneCanvas.tsx   Canvas, lighting rig, constrained orbit, post-processing
    Cockpit.tsx       Hull, console, viewport frame, flickering damaged panel
    ForwardViewport.tsx  Stars, sun, Mars
    DustMotes.tsx     God-ray dust
    AetherHologram.tsx   Aether (state-reactive)
    DiagnosticConsole.tsx  Clickable in-world diagnostic control
    NeuralRepair.tsx  Hold-to-align node repair minigame
  ui/
    CinematicLayer.tsx   StartGate (+ settings) / WakeFade / EndCard (+ run stats)
    MenuLayer.tsx        Pause overlay (☰ / Esc) + reusable settings toggles
    DialogueOverlay.tsx  Aether's dialogue box + gating CTAs
    GlitchText.tsx       Live re-rolling text corruption
    StatusHUD.tsx        Ship subsystems + journey progress
    ObjectiveTracker.tsx Current objective
    OnchainLedger.tsx    Visible audit trail (Algorand-ready)
    useDialogueDriver.ts Narrative timing / speech / glitch driver
```

## On-chain foundation (why it's structured this way)

Every meaningful action emits an `OnchainEvent` (`seq + ts + kind + payload`) into
an append-only `ledger`, shown live in the Ledger panel.

At the end of the run the **end-card commits that ledger to Algorand (testnet)**:
each event becomes a 0-ALGO self-payment carrying the event in its note field,
all signed in one **Pera Wallet** popup as a single atomic group, then the player
hands off to the main **FRONTIER-AL** game (`lib/chain/claim.ts`,
`lib/chain/handoff.ts`, `ui/ClaimPanel.tsx`). This is **testnet-only and never
moves value** — it proves the on-chain mechanic with zero funds risk. A
"continue without committing" escape is always present so the player is never
hard-locked. Config (network, algod endpoint, handoff URL) lives in
`.env.example`.

## Tech

Vite · React 18 · TypeScript · React Three Fiber + drei + postprocessing ·
Tailwind CSS · Zustand. All sound is synthesized at runtime (Web Audio) and
voice is optional (Web Speech) — the prototype runs from a clean clone with no
binary assets.

## Phase 1 — locked state (verification & hardening pass)

This pass verified the build, hardened the core interaction, and split the
bundle. **No dev-only tooling** (leva / r3f-perf / Stats) is present, there are
**no leftover `console.*` statements**, all list renders are keyed, and audio is
gated behind the BEGIN user gesture. The **store and `OnchainEvent` ledger were
left untouched** — they were already clean and self-contained.

What changed in this pass:

- **Repair interaction hardening** (`three/NeuralRepair.tsx`):
  - The hold now cancels on `pointercancel`, window `blur`, and tab-hidden — not
    just `pointerup` — so a node can't get stuck mid-charge if focus or the touch
    is lost.
  - Partial charge **decays on release** (`DECAY_RATE`), giving the hold real
    "keep-steady" weight instead of letting taps accumulate progress.
  - A synchronous `alignedRef` guard ensures each node calls `alignNode()`
    **exactly once**, closing a stale-state gap that could double-write the
    Algorand-ready ledger.
- **Bundle split** (`vite.config.ts`): `three` and the r3f stack are now their
  own cached vendor chunks. App code dropped from a single **~1.09 MB** chunk to
  **~34 kB** app + `three` ~688 kB + `r3f` ~369 kB.

**Build status:** `vite build` is **green** (no chunk-size warning). Note: the
`tsc --noEmit` step of `pnpm build` currently fails *only* in the shared pnpm
workspace because `@types/react@19` gets hoisted over the app's pinned
`@types/react@18`; this is an environment artifact, not a code defect, and does
not affect the Vite bundle. Run `pnpm build` in an isolated install (or CI) to
get the clean typecheck.

> ⚠️ **Not browser-verified.** This pass was done in a headless environment, so
> the on-screen look, post-FX feel, Aether's presence, camera/click friction,
> and the **feel** of the hardened repair (weight, resistance, payoff) have
> **not** been observed in a real browser. The decay/charge values are a starting
> point — see the playtest checklist below.

### Playtest checklist (run `pnpm dev`, play wake-up → repair a few times)

1. **Repair feel** — does the hold have satisfying weight? Is `DECAY_RATE` vs
   `CHARGE_RATE` (`three/NeuralRepair.tsx`) too punishing or too forgiving?
2. **Edge cases** — start a hold, then alt-tab / lock the screen / lift a touch
   off-node: charging should stop cleanly, never stick.
3. **Aether** — is she readable during repair (steadies as nodes lock)? Any
   jitter/dropout that reads as a glitch-bug rather than intentional?
4. **Camera/clicks** — any orbit or node-click friction; do labels stay legible?

## Phase 2 — recommended next (scoped)

1. **Lazy-load the 3D scene** behind `React.lazy` + `Suspense` so the title/Start
   gate paints instantly and the ~690 kB three core loads behind a fallback —
   the next real load-time win after this pass's vendor split.
2. **`prefers-reduced-motion` in the R3F loops** — the CSS guard doesn't reach
   the `useFrame` jitter/dropout in `AetherHologram`/`NeuralRepair`; read
   `matchMedia` once and damp animation for accessibility.
3. **Begin the real Algorand flush** — wire the `OnchainEvent` ledger to Algorand
   boxes / ASAs (FRNTR / GEOCRED / treasury), gated by the FRONTIER-AL mainnet
   gates (`/mainnet-gate` + `algo-auditor`). The seq counter can move to a
   monotonic source if entries are ever pruned before flush.
