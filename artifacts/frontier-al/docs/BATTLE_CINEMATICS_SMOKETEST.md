# Battle Cinematics — owner smoke-test guide

The battle-sequence system (PRs #122–#128) is **fully test-backed at the pure-logic
level** but **not browser/GPU-verified** — that's the one gate left, and it needs
your eyes. This is the checklist. Use a Cloudflare **branch preview** (linked on
each PR) or the live site after deploy.

> All of it is driven by one deterministic engine — `shared/battle-sequence.ts` —
> so the modal, the globe, and the HUD callout should agree beat-for-beat.

## Setup

1. Open the app, connect a wallet, and get to the globe.
2. You want at least one **battle** in progress. Either attack an AI-held plot, or
   watch the AI factions — they attack on a cadence. The battle auto-resolver runs
   every few seconds (`BATTLE_RESOLVE_INTERVAL_MS`, default 5s).

## What to check

### 1. Pre-resolution telegraph (the build-up) — PR #127
- In the final ~8 seconds before a pending battle resolves, a **targeting reticle**
  should build on the **defender's plot**: an outer ring brightening + pulsing
  faster, an inner ring converging toward centre.
- ✅ Pass: it intensifies as the clock runs down. ✅ It sits on the *target* plot.

### 2. On-globe resolution cinematic (the payoff) — PR #122/#123/#125
When the battle resolves, watch the target plot:
- a **telegraph line** + a **strike** travels the **attacker→defender arc**,
- an **impact flash**, then
- a **victory ring** (cyan) or **defense ring** (red), and on a capture a **burst**
  in the **conqueror's faction colour** (NEXUS-7 cyan / KRONOS purple / VANGUARD
  amber / SPECTRE rose).
- ✅ The arc goes from the *attacker's* plot to the *defender's* plot.
- ✅ On an upset (underdog wins on the luck roll) you should see an extra **amber
  swing pulse** (PR #123 — only fires when randFactor flipped the result).

### 3. HUD callout (the words) — PR #124
- A strip near the top-centre should **ticker the beat captions** in sync with the
  globe: `Target lock → Inbound … → Impact → Fortune swings … → VICTORY/DEFENSE HELD`.
- ✅ The words match what the globe is doing at the same moment.

### 4. Watch modal (the replay) — PR #122
- Open a **resolved** battle ("Watch Battle"). The feed is now titled **"Battle
  Sequence"** and plays the real 10 beats with a playhead + intensity pips — **not**
  the old random lore lines.
- ✅ For a *live* (unresolved) battle the old narrative feed still shows (no spoiler).

### 5. Reduced-motion / toggle — PR #128
- Globe colour settings → toggle **"Battle Cinematics"** off: the globe FX, telegraph,
  and HUD callout should **stop**; the modal shows the beats as a **static list**.
- Set your OS to **Reduce Motion** (macOS: Accessibility → Display → Reduce Motion):
  the cinematics should auto-suppress even with the toggle on. ✅ The live-event
  boxes + the textual replay log still convey every outcome.

## If something's off

Tell me **which beat** and **what you saw** — the timeline is deterministic, so I can
map a wrong-looking moment straight to a beat (`muster/lock/launch/transit/brace/
impact/clash/swing/resolve/aftermath`) and the module that renders it. Common knobs:

- Timing feels too fast/slow → `shared/battle-sequence-tuning.ts` (per-beat ms).
- Arc origin wrong / missing → the attacker `sourceParcelId` wasn't known client-side
  (`GlobeBattleSequence` falls back to a target-only cinematic).
- Colours → `client/src/lib/battle/factionColor.ts`.

## Status of the build queue

Shipped + merged: the engine + watch-modal playback + on-globe cinematic + real
randFactor + HUD callouts + faction colour + incoming telegraph + reduced-motion.
**Optional, not started** (your call): a camera that follows the strike along the
arc, per-beat sound cues. I recommend smoke-testing the above before adding more,
since none of it is verified from the build environment.
