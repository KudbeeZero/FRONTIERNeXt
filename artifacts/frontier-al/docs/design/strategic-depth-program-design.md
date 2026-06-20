# Strategic Depth Program — design

> Status: **design / scoping** (doc-only). No code changes here. This decomposes a multi-system
> overhaul into one-PR units under the chat-loop protocol. Funds/economy units carry the app HARD-RULE
> gates (`/security-pass` + `/mainnet-gate` + `algo-auditor`). Cross-references the existing
> [`faction-economy-and-commander-progression-design.md`](./faction-economy-and-commander-progression-design.md)
> (the faction-treasury/wallet workstreams it builds toward).

## 1. Context / vision (owner)

The plot systems don't hang together: upgrades (electricity, blockchain node, …) feel arbitrary,
**archetype abilities don't actually affect anything**, and the sub-parcel/royalty idea isn't realized.
The goal is to make the whole 2.5D/three.js world **interconnected** — upgrades ↔ archetypes ↔
sub-parcels ↔ terraforming ↔ battle ↔ economy — so that outcomes drive **real economic / control /
societal** consequences: a region can **thrive or suffer**, a side of the world can become a
**superpower**, and **small allies** can still cut deals and matter. Plus new plot features
(**asteroids**, **nuclear stockpiles**) and a corrected **UI (sliders/controls)** and **route** layer.

## 2. Current state (grounded — confirms the critique)

Evidence from a 3-agent code sweep (2026-06-20). The owner's critique is **substantially correct**:

**Upgrades / facilities** (`shared/schema.ts` improvement+facility defs; `server/storage/db.ts` apply;
`server/engine/battle/resolve.ts` battle read):
- Wired: `turret`/`shield_gen`/`fortress` → battle defense (`resolve.ts:57-59`); `radar` → −10% attacker
  power (`db.ts:1397`); `storage_depot` → capacity; `electricity`→prereq + `blockchain_node` → ASCEND/day
  (`schema.ts calculateAscendPerDay`); `ai_lab` → mine-cooldown (`db.ts:701-703`).
- **Broken/inert:** `data_centre`'s yield bonus increments `parcel.yieldMultiplier` (`db.ts:1224`) **but
  nothing reads it during mining** → dead. `shield_gen` is lumped into plain defense — its distinct
  "influence-loss reduction" mechanic **doesn't exist**.

**Archetypes** — two unrelated meanings:
- *Weapon archetypes* (`shared/weapons/archetypes.ts`): pure flavor labels, **zero gameplay effect**.
- *Sub-parcel archetypes* (`shared/schema.ts:902-962`): `resource`/`trade`/`fortress`/`energy` with
  `ARCHETYPE_FACTION_BONUSES` (SPECTRE/KRONOS/NEXUS-7), power-dependency
  (`computeGridPowerDependency`), and energy-alignment — **all defined but inert**: computed in
  `db.ts:2517` / `game-rules.ts:302-313` but **never read by any battle/yield/economy path**
  (UI badges only). This is exactly "archetype abilities don't benefit other systems."

**Sub-parcels / royalty** (`shared/schema.ts:844-962`; `db.ts:2281-2414`, `:1954-1961`):
- 3×3 grid (9 sub-parcels), **center = subIndex 4**, **auto-granted to the subdivider** on subdivision.
- A **30% "land tax"** already streams to the center owner on every sub-parcel *sale* (4-way split:
  30% treasury / 20% faction / 30% center owner / 20% burn).
- **Gaps vs. target:** on conquest, **all** defender sub-parcels (incl. the center) transfer to the
  attacker (`db.ts:1954-1961`) — the center is **not** retained; and there is **no royalty on plot
  yield or on plot ownership transfer**.

**Economy / politics / routes** (`shared/economy-config.ts`; `server/routes.ts`; `db.ts`):
- **`influence` (0–100)** per parcel already gates yield — below `INFLUENCE_YIELD_THRESHOLD` (50) the
  plot emits **zero** ASCEND; mining/bunker repair it (`db.ts:712-753, 1062-1064, 202-243`). This is the
  natural substrate for "thrive vs suffer / control."
- 4 AI factions (autonomous reconquest) + **off-chain** human membership (`players.playerFactionId`),
  but **no diplomacy, alliances, superpower ranking, faction treasury, or tariffs**; membership confers
  **no mechanical benefit**. Action routes (`MUTATION_PATH_RE`, `routes.ts:502`) are **siloed** —
  mining/upgrade/build don't consult faction/region/battle context.
- **No plot-feature field** — orbital effects are transient (10 min), not permanent fixtures; no
  asteroid/nuclear support.

## 3. Locked decisions (owner, 2026-06-20)

1. **Royalty = perpetual yield royalty.** The center subplot becomes **conquest-exempt** (original owner
   keeps it forever, through conquest *and* sale) **and** the original owner earns a **standing % of the
   plot's ongoing ASCEND yield, forever**.
2. **Archetypes: wire up what exists first.** Make the inert bonuses actually work before any redesign.
3. **Politics first slice: regional control cascade.** Extend `influence` so neighboring plots rise/fall
   together — a region visibly thrives or suffers; conquest damage spreads.
4. **Plot features: economic + military.** Asteroids = rare-resource/yield deposits; nuclear stockpile =
   a strike capability. Features feed **both** mining/economy and battle.

## 4. Target design + phased decomposition (one PR per unit)

Naming: **SD-n** (Strategic Depth). Each unit = one branch, one audited PR, gates per the chat loop.
Funds/economy units add `/security-pass` (+ `/mainnet-gate` + `algo-auditor` if ASA transfers move).

### Phase SD-A — Make the inert real (low-risk, high-value; decision 2)
*Pure/deterministic wiring of already-defined bonuses; no schema, no funds, no canvas. Each is a small,
test-backed unit mirroring the battle-stats/replay-log pattern.*
- **SD-A1 — data_centre yield is read.** Wire `parcel.yieldMultiplier` (already incremented at
  `db.ts:1224`) into the mine yield calc; pure helper + spec (mine yield with/without data_centre levels).
- **SD-A2 — archetype faction bonuses applied.** Read `ARCHETYPE_FACTION_BONUSES` where they claim to act:
  `resource`→yield, `fortress`→battle defense, `energy`→grid range, `trade`→(defer until a market exists,
  see open Q). Centralize a pure `archetypeBonus(parcel/subParcel, player)` used by the yield + battle
  paths; spec each.
- **SD-A3 — power dependency enforced.** Call `computeGridPowerDependency` in production: a `fortress`/
  `resource` archetype with no powering `energy` parcel is penalized (e.g. bonus suppressed / reduced
  output). Pure rule + spec.
- **SD-A4 — distinct shield_gen.** Give `shield_gen` its documented "influence-loss reduction" (reduce
  `influenceDamage` taken in `resolveBattles`) instead of being plain defense; spec.

### Phase SD-B — Royalty / center permanence (decision 1; economy → gated)
- **SD-B1 — schema + center conquest-exemption.** Add `parcels.originalOwnerId` (and persist the center
  sub-parcel's owner independent of plot owner); migration. In `resolveBattles`, **exclude subIndex 4**
  from the defender→attacker sub-parcel transfer (`db.ts:1954-1961`). Test: conquest leaves the center
  with its owner.
- **SD-B2 — perpetual yield royalty.** At ASCEND accrual/claim, stream a standing **royalty %** of the
  plot's yield to the center/original owner (alongside the existing 30% sale tax). Pure split helper +
  spec; **`/security-pass`** (economy correctness, no double-pay, rounding/lossless). If/when this routes
  on-chain ASA → **`/mainnet-gate` + `algo-auditor`**.

### Phase SD-C — Regional control cascade (decision 3; builds on `influence`)
- **SD-C1 — region model.** Group plots into regions (derive from lat/lng adjacency or a `regionId`);
  pure region-assignment + spec. No behavior yet.
- **SD-C2 — cascade.** Conquest/influence damage spreads to neighbors; region aggregate drives a
  thrive/suffer modifier on yield (extends the `influence`→yield gate). Pure cascade math + spec;
  `/security-pass` (economy).
- **SD-C3 — client surface.** Visualize regional control (globe tint / HUD). Canvas → **scoped + audited**
  per HARD RULE; SSR test.

### Phase SD-D — Plot features: asteroids + nuclear (decision 4)
- **SD-D1 — feature schema + seeding.** Add `parcels.plotFeatures` (jsonb) + `PlotFeature` type;
  deterministic genesis distribution (seeded); migration. Pure seeding + spec.
- **SD-D2 — economic features.** Asteroid → rare-resource/yield modifier in the mine path; pure + spec.
- **SD-D3 — military features.** Nuclear stockpile → a strike capability in the special-attack/weapon
  path; **weapon-economy** → `/security-pass`; cost/balance via the existing economy config.
- **SD-D4 — client render.** Asteroid/nuclear markers on the globe; canvas → scoped + audited; SSR test.

### Phase SD-E — Faction politics (later; cross-refs faction-economy design)
Tariffs + faction treasury (member trade/yield taxed into a treasury), then alliances + superpower
ranking + deals. This is the heaviest, funds-adjacent layer — sequence **after** SD-A..D and align with
[`faction-economy-and-commander-progression-design.md`](./faction-economy-and-commander-progression-design.md)
WS-D/E (off-chain accounting first; wallets/on-chain settlement last, fully gated).

### Phase SD-F — Faction perception lens (visionary; after SD-E)
*"You start to see things differently the deeper you lean."* The world's presentation — HUD framing,
narrative/intel tone, event copy, color/lighting, even which information is emphasized — shifts with the
player's **faction lean** and its **intensity**, and the lean can **drift over time** based on actions
(a political-realignment arc: start aligned one way, end another).
- Builds on what exists: `players.playerFactionId` + `factionJoinedAt`, the narrative engine
  (`server/engine/narrative`), `AiFactionLog`, and the world-event feed.
- **SD-F1 — alignment model.** A server-side `factionLean` (vector/score across factions) + `intensity`
  that **drifts** from actions (attacks on/with a faction, trades, territory near a faction, time held).
  Pure deterministic drift function + spec. No presentation yet.
- **SD-F2 — perception layer (client).** A "lens" that recolors narrative/intel/HUD copy + visual tone by
  lean+intensity (same underlying facts, faction-flavored presentation — **not** hidden game state, to
  keep fairness). Canvas/HUD → scoped + audited; SSR test. Must never alter deterministic outcomes — it's
  *perception*, not mechanics.
- Open: does lean ever gate mechanics (SD-E bonuses) or stay purely perceptual? (Recommend: perceptual +
  cosmetic + narrative; mechanical faction benefits stay in SD-E so the lens can't be a power lever.)

### UI / routes (woven through, not a silo)
Each unit updates the relevant route to consult the new context (archetype/region/feature) rather than a
big-bang "route rewrite." A dedicated **UI/controls** unit (sliders/panels) lands per phase as its
mechanics ship, so the controls reflect real, wired systems.

## 5. Sequencing & rationale
SD-A first (cheap, deterministic, immediately makes the world feel coherent — the owner's #1 complaint),
then SD-B (royalty — concrete, owner-prioritized), SD-C (regional depth on the existing substrate),
SD-D (new content), SD-E last (biggest, funds-adjacent). One open PR at a time.

## 6. HARD RULES / gates (app)
- Economy/ASCEND-accounting units (SD-B2, SD-C2, SD-D3, SD-E) → **`/security-pass`**; anything that
  **moves ASA / funds on-chain** → **`/mainnet-gate` + `algo-auditor`**, testnet-only first.
- Globe/canvas units (SD-C3, SD-D4) → **scoped + audited**, no mock/demo data, verify `VITE_TEST_GLOBE`.
- Migrations extend the applied set (currently 0000–0008 + later) — document + apply in order.
- Don't touch `wip/atomic-purchase`; nothing in `ops/kestra/` points at mainnet.

## 7. Open questions (deferred — resolve per phase)
- **Royalty %** for SD-B2 (standing yield cut) and whether it stacks with the existing 30% sale tax; cap?
- **Region definition** for SD-C1 (geographic adjacency vs. fixed zones vs. faction-territory).
- **`trade` archetype** bonus (SD-A2) — no market-throughput system exists yet; defer or define a minimal one.
- **Nuclear** balance (SD-D3): one-shot consumable vs. cooldown weapon; collateral radius; counterplay.
- **Superpower ranking** metric (SD-E): territory? influence? treasury? composite?

## 8. Risks
- Economy changes can unbalance the faucet/sink loop — each gets `/security-pass` + a coverage-gated math
  spec; no number ships "validated" without a test.
- Wiring inert bonuses (SD-A) changes live balance even though it's "just hooking up" — treat as behavior
  changes (tests that fail before / pass after).
- SD-E overlaps the faction-economy design — coordinate to avoid duplicate treasury models.
