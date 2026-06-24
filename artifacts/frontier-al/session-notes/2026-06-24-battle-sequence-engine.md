# 2026-06-24 — Battle Sequence Engine + cinematics (the "telegraphy")

**Goal (owner):** the engine that "sells the telegraphy — the lines connecting
everything together when there's a battle, the sequence." Build it best; loop
together ~10 things.

**Outcome:** shipped a complete battle-sequence system across **6 merged PRs**
(#122, #123, #124, #125 — plus #121 aether dock merged alongside). A battle is
now one *connected* cinematic — a deterministic 10-beat timeline that the watch
modal, the globe, and a HUD callout all drive off **one clock**.

## What shipped (10 stages)

1. **`shared/battle-sequence.ts` (+ `-tuning.ts`)** — pure, deterministic engine.
   `buildBattleSequence()` → a 10-beat timeline (muster → lock → launch → transit
   → brace → impact → clash → swing → resolve → aftermath). Durations scale with
   troops / great-circle arc distance / luck-swing magnitude; `swingDecided` flags
   a randFactor that flipped the result; `sampleSequence`/`beatAt`/`progressAt`
   seek by time. (PR #122)
2. **`client/.../sequenceFromReplay.ts`** — pure adapter: replay record + context
   → sequence; `revealedBeats` playhead. (#122)
3. **`BattleSequenceTimeline.tsx` + `BattleWatchModal`** — resolved battles play
   the real sequence; the fabricated `generateEvents` mock now runs only for live
   battles. (#122)
4. **`battleSequencePlayback.ts`** — pure: sequence + elapsed → globe render
   channels (arc travel, telegraph/strike, impact/swing envelopes, ring, capture). (#122)
5. **`sequenceFromBattle.ts`** — pure: reconstructs adjusted power from snapshot ×
   (1+rf/100); `factsFromBattle` / `factsFromResolvedEvent`. (#122, #123)
6. **`GlobeBattleSequence.tsx`** — self-subscribing R3F layer: plays the resolution
   cinematic (telegraph line + strike along the attacker→defender arc → impact →
   swing → victory/defense ring + capture). Caches live battles/parcels so a
   resolution can be choreographed after the battle leaves the active list;
   degrades to target-only when the source plot is unknown. (#122)
7. **Mounted** in `PlanetGlobe` after `LiveWeaponLayer`. (#122)
8. **`battle:resolved` client bus** (`useGameSocket.onBattleResolved`) — the server
   already broadcast a rich `battle:resolved` (real randFactor + snapshot powers +
   names) that the client dropped; wired it through so the on-globe luck-swing beat
   is data-driven. `factsFromResolvedEvent` pure. (#123)
9. **`cinematicBus.ts` + `BattleCalloutHUD.tsx`** — the verbal telegraphy: a DOM
   HUD strip tickers the engine's beat captions off the same clock the globe uses.
   The globe publishes its sequence; the HUD reuses it (no duplicate caching). (#124)
10. **`factionColor.ts`** — capture burst + strike arc carry the conqueror's faction
    colour (NEXUS-7 cyan / KRONOS purple / VANGUARD amber / SPECTRE rose); the
    outcome ring stays semantic (cyan win / red loss). (#125)

## Verification (CI-parity, all green on each merged head)

- `check` (tsc) ✓
- `test:server` **359 passed** / 11 skipped (+23 engine tests)
- `test` (client) **141 passed** (+34: adapter, playback, from-battle, cinematic
  bus, faction colour)
- `build` ✓ · Cloudflare preview deployed on each PR

## Honest flags

- **R3F globe layers + DOM HUD/modal are NOT browser/GPU-verified** here (no
  browser). All pure logic is test-pinned (engine determinism, gapless 10-beat
  invariant, data-scaling, swing-flip, sampling, no id/addr leak, faction mapping).
  Owner smoke-test on the Cloudflare preview is the remaining gate — open a resolved
  battle (modal), and watch one resolve on the globe.
- No funds / chain / schema / server-behavior change. The one server-touching item
  (#123) only *consumes* a message the server already sends.

## Next (optional polish — not started)

- Camera that follows the strike along the arc and snaps to the target on impact.
- Pre-resolution "incoming attack" telegraph (warn the defender during the pending
  countdown — true telegraphy before impact).
- Sound cues per beat (no audio system today).
