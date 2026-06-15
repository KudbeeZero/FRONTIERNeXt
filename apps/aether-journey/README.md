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
    CinematicLayer.tsx   StartGate / WakeFade / EndCard
    DialogueOverlay.tsx  Aether's dialogue box + gating CTAs
    GlitchText.tsx       Live re-rolling text corruption
    StatusHUD.tsx        Ship subsystems + journey progress
    ObjectiveTracker.tsx Current objective
    OnchainLedger.tsx    Visible audit trail (Algorand-ready)
    useDialogueDriver.ts Narrative timing / speech / glitch driver
```

## On-chain foundation (why it's structured this way)

Every meaningful action emits an `OnchainEvent` (`seq + ts + kind + payload`) into
an append-only `ledger`. In Phase 1 this is logged client-side and shown in the
Ledger panel — but the shape deliberately mirrors what a later phase will flush to
an **Algorand box** / mint as **ASA rewards** (FRNTR / GEOCRED, treasury,
plots, outpost unlocks). No reshaping required to go on-chain.

## Tech

Vite · React 18 · TypeScript · React Three Fiber + drei + postprocessing ·
Tailwind CSS · Zustand. All sound is synthesized at runtime (Web Audio) and
voice is optional (Web Speech) — the prototype runs from a clean clone with no
binary assets.
