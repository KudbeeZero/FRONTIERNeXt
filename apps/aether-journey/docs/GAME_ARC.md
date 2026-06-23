# Aether's Journey — long-game arc (design)

> The vision: a **~60-minute** single-sitting narrative game where the player makes
> **real decisions** with consequences and is **genuinely challenged** by escalating
> puzzles — not a 10-minute prologue. This doc is the spine; each chapter gets its own
> detail doc (see `CHAPTER_2_DESIGN.md`) and ships as its **own one-PR unit**.

## 1. Pacing target — how we get to ~1 hour

| Ch | Title | New mechanic / verb | Decisions | Mins |
|----|-------|---------------------|-----------|------|
| 1 | **Wake & Repair** *(shipped)* | press-&-hold neural repair | — | ~8 |
| 2 | **The Debris Field** *(designed, #103)* | wiring / logic (nav-circuit reroute) | route under fuel pressure | ~12 |
| 3 | **The Quiet Mutiny** | resource **triage / allocation** | who gets power: life-support, comms, or Aether? | ~12 |
| 4 | **Blackout** | **deduction** (signal/star-map under uncertainty) | trust Aether's guess vs. your own | ~12 |
| 5 | **Descent** *(finale)* | **integration** — all prior verbs under time pressure | the ending choice | ~14 |

≈ **58 min** of directed play; replay (different decisions/endings) extends it. Chapters 3–5
are sketched here and get full detail docs before their build units.

## 2. The decision system (the "real decisions" pillar)

A lightweight, **persistent** model that threads choices through the whole game without a
combinatorial branching explosion — branch the *texture*, converge the *plot*.

- **One primary axis — `trust` (0–100).** Seeded from Ch.1's `aetherStability`. Every key
  decision nudges it and sets a **flag**. High trust = Aether helps more / opens warmer dialogue;
  low trust = she's guarded, gives less puzzle assistance, and some lines turn cold.
- **Decision points are data** (`src/data/decisions.ts`): `{ id, prompt, options[], effects }`
  where an effect can adjust `trust`, set a `flag`, or alter a resource (power/fuel/integrity).
  Surfaced through the existing `DialogueOverlay` gate-CTA pattern (no new UI framework).
- **Resources** carry across chapters: `power`, `fuel`, `lifeSupport`, already half-modeled in
  `ShipSystems`. Decisions and puzzle performance spend/restore them; Ch.5 reads the final state.
- **Everything logs to the on-chain ledger** (`OnchainEvent`) — decisions become the audit trail,
  which is the bridge to FRONTIER-AL. New kinds: `DECISION_MADE`, `TRUST_SHIFT`, `RESOURCE_SPENT`.
- **Convergent branching:** choices change dialogue, assistance level, resource state, and the
  **ending**, but not the chapter sequence — so content stays authorable and every path is testable.

## 3. The challenge curve (the "genuinely challenged" pillar)

Each chapter introduces a **new verb** and raises constraint pressure, while keeping Ch.1's
humane "you can always recover" feel until the finale earns real stakes.

- **Ch.2** adds a *budget* (fuel) — first real pressure; soft-fail (shorts cost fuel, never lose).
- **Ch.3** adds *scarcity tradeoffs* — not enough power for everything; no clean win, only chosen
  costs. The challenge is judgment, not dexterity.
- **Ch.4** adds *uncertainty* — incomplete information; a deduction puzzle (Mastermind-style signal
  decode / star triangulation) where Aether offers a guess you can trust or override.
- **Ch.5** adds *time + integration* — a multi-stage insertion sequence that recombines repair +
  wiring + allocation under a countdown. **First place a wrong move can actually fail a stage** (with
  an immediate retry), so the finale finally bites. Accumulated `trust`/resources set its difficulty.
- **Accessibility:** every puzzle keeps a "request a hint" path scaled by `trust`; a settings
  *assist mode* (in `settingsStore`) softens timers/penalties so the challenge never becomes a wall.

## 4. Chapter sketches (3–5)

- **Ch.3 — The Quiet Mutiny.** A dormant maintenance sub-process (**"VESTA"**) wakes corrupted and
  contests Aether for life-support. Mechanic: **power triage** — allocate a limited bus across
  life-support / comms / Aether's core, each with consequences. Decisions: how much you starve
  yourself to keep Aether whole. Sets the game's biggest `trust` swings.
- **Ch.4 — Blackout.** Crossing Mars's shadow into a comms dead zone; instruments unreliable.
  Mechanic: **deduction** — decode a degraded beacon / triangulate position from partial clues.
  Aether proposes an answer; trusting vs. overriding her is the decision (and a `trust` test).
- **Ch.5 — Descent.** Orbital insertion finale. Mechanic: **integration** under a countdown,
  recombining earlier verbs. The accumulated state resolves into one of the endings below.

## 5. Endings (decision payoff)

Gated on final `trust` + key flags, surfaced on the existing `EndCard`:
1. **Bonded** (high trust) — Aether intact, you arrive together; warmest hand-off to FRONTIER-AL.
2. **Functional** (mid) — you make Mars, but something between you stayed guarded.
3. **Severance** (low / sacrificed her for the ship) — you survive; Aether is diminished. A cost.

All three are reachable and **testable** (the ending selector is a pure function of state).

## 6. How this ships (respecting the repo loop)

- **One chapter = one detail doc + one build unit = one PR**, audited and merged before the next.
- Build order: **Ch.2 (design #103 → build) → decision-system core → Ch.3 → Ch.4 → Ch.5 → endings.**
- The **decision-system core** (the `trust`/`decisions`/resource slice + pure selectors + tests) is
  its own small unit right after Ch.2, since Ch.3–5 all depend on it.
- Nothing here is built yet — this is the spine the per-chapter units implement, one reviewed PR
  at a time.
