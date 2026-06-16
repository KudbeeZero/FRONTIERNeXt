# ASCENDANCY — The Provably-Fair Prediction Market LUT

### The only prediction market where the house literally cannot cheat — and you can verify it

> The integrity architecture that turns your biggest liability into your biggest edge
> Structural trust, not a disclaimer. Build before prediction markets touch real value.

-----

## THE PROBLEM (stated plainly)

A prediction market run by the same party that controls the game has an unavoidable
accusation waiting for it:

> “You made the game. You set the odds. You resolved the outcome. How do I know you didn’t
> tilt a battle, delay a result, or pick the winning side to favor the house’s book?”

This accusation is **fatal to trust** even if you never actually cheat. The mere *ability*
to cheat poisons the well. Disclaimers don’t fix it. “Trust us” doesn’t fix it. The only
fix is making cheating **structurally impossible and publicly verifiable.**

Here’s the part most people miss: **you already have the architecture to do this, and
almost nobody else does.** Your determinism + on-chain history isn’t just a differentiator
for gameplay — it’s the foundation for the most trustworthy prediction market in Web3
gaming.

-----

## THE CURRENT STATE (the gap to close)

Today, `resolveMarket(marketId, winningOutcome)` takes the winning outcome **as a parameter
set by an admin.** That’s the exact trust problem in code form — a human (you) decides who
won. Even with the admin-key guard, the *capability* to choose outcomes exists. That must be
removed entirely.

-----

## THE SOLUTION: TRUSTLESS DETERMINISTIC RESOLUTION

### The core principle

Market outcomes are **never decided by anyone.** They are **derived** — computed from
verifiable facts that already exist on-chain or in the deterministic engine, by code that
anyone can run and check. The house has no hand on the lever because there is no lever.

```
WRONG (current):  admin → picks winningOutcome → resolveMarket()
RIGHT (target):   on-chain facts → deterministic resolver → outcome (no human, ever)
```

### Three pillars

**Pillar 1 — Outcomes resolve from verifiable facts, not opinions**
A market can only be created about something that resolves to a **fact recorded on-chain
or computed deterministically.** Examples:

- “Will faction NEXUS-7 hold Sector 12 at turn 1500?” → resolved by reading on-chain
  ownership at turn 1500. A fact. Not a judgment.
- “Will this battle’s attacker win?” → resolved by the deterministic battle engine, which
  produces the same result for everyone given the seed. Verifiable by replay.
- “Will total $ASCEND burned exceed X by season end?” → resolved by summing on-chain burns.
  A fact.

Markets about un-provable things (subjective outcomes, off-chain events) are **not allowed.**
The resolution criterion must be a deterministic function of public data.

**Pillar 2 — The resolver is automated, public, and removed from the dev**
Resolution runs as an **automated function with no admin input**, triggered by time or
on-chain state. The dev wallet **cannot** call resolve with a chosen outcome — that code
path is deleted. The resolver:

1. Reads the on-chain / deterministic fact the market was created about.
1. Computes the outcome by a published, open formula.
1. Settles payouts automatically.
1. Records the resolution + the inputs it used on-chain, so anyone can re-run it.

**Pillar 3 — Anyone can verify, including before resolution**
Because outcomes derive from deterministic facts, a player can **independently compute the
result themselves** and confirm the market resolved correctly. The battle seed, the
ownership snapshot, the burn total — all public. Verification isn’t “trust the explorer,”
it’s “run the same function on the same public inputs and get the same answer.”

-----

## THE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│  PROVABLY-FAIR MARKET LIFECYCLE                                  │
│                                                                  │
│  1. CREATE                                                       │
│     Market must specify a RESOLUTION SOURCE — a deterministic    │
│     function of public data, declared at creation and immutable: │
│       { type: "ownership_at_turn", sector: 12, turn: 1500 }      │
│       { type: "battle_outcome", battleId: "..." }                │
│       { type: "burn_threshold", amount: 100000, byTurn: 2000 }   │
│     The source is recorded on-chain. It CANNOT change later.     │
│                                                                  │
│  2. STAKE                                                        │
│     Players stake $ASCEND on outcome A or B. Pools tracked.      │
│     (Your existing placeBet logic — keep it.)                    │
│                                                                  │
│  3. LOCK                                                         │
│     At a published cutoff, staking closes. No late bets.         │
│     Cutoff is BEFORE the resolving fact is knowable.             │
│                                                                  │
│  4. RESOLVE (automated, no human)                                │
│     A scheduler detects the resolution condition is met, reads   │
│     the on-chain/deterministic fact, computes the outcome by the │
│     declared formula, and settles. NO winningOutcome parameter.  │
│     The dev cannot influence this. The function is the judge.    │
│                                                                  │
│  5. RECORD + VERIFY                                              │
│     Resolution writes: the source, the exact inputs read, the    │
│     computed outcome, and a hash — all on-chain. Anyone can       │
│     re-run the function on the same inputs and confirm.          │
└─────────────────────────────────────────────────────────────────┘
```

-----

## THE CODE CHANGES

### Change 1 — Markets declare an immutable resolution source

```typescript
// Resolution sources — each is a deterministic function of public data
type ResolutionSource =
  | { type: "ownership_at_turn"; sector: number; turn: number; faction: string }
  | { type: "battle_outcome"; battleId: string }
  | { type: "burn_threshold"; amount: number; byTurn: number }
  | { type: "territory_count"; faction: string; turn: number; threshold: number };

interface PredictionMarket {
  // ... existing fields ...
  resolutionSource: ResolutionSource;   // NEW — declared at creation, immutable
  resolutionCutoffTs: number;           // staking closes here
  resolvedInputs?: object;              // NEW — the exact facts read at resolution
  resolutionHash?: string;              // NEW — hash of inputs+outcome for verification
}
```

### Change 2 — Delete the admin-chosen outcome path

```typescript
// REMOVE this signature entirely — it's the trust hole:
//   resolveMarket(marketId, winningOutcome: MarketOutcome)   ← DELETE

// REPLACE with a resolver that DERIVES the outcome:
async resolveMarketTrustlessly(marketId: string): Promise<Resolution> {
  const market = await this.getMarket(marketId);
  if (Date.now() < market.resolutionCutoffTs) {
    return { error: "Not yet resolvable" };
  }
  // Read the fact the market was created about — from chain / deterministic engine
  const { outcome, inputs } = await this.computeOutcome(market.resolutionSource);
  const hash = sha256(JSON.stringify({ source: market.resolutionSource, inputs, outcome }));
  // Settle payouts by the existing pool math
  await this.settle(market, outcome);
  // Record verifiable resolution
  await this.recordResolution(marketId, { outcome, inputs, hash });
  return { outcome, inputs, hash };
}

// The judge — pure function of public data, no human input possible
async computeOutcome(source: ResolutionSource): Promise<{ outcome: MarketOutcome; inputs: object }> {
  switch (source.type) {
    case "ownership_at_turn": {
      const owner = await this.getOwnershipAtTurn(source.sector, source.turn);
      return { outcome: owner === source.faction ? "a" : "b", inputs: { owner } };
    }
    case "battle_outcome": {
      const battle = await this.getBattle(source.battleId);
      // deterministic — re-runnable by anyone with the seed
      return { outcome: battle.attackerWon ? "a" : "b", inputs: { seed: battle.seed, result: battle.attackerWon } };
    }
    case "burn_threshold": {
      const burned = await this.getTotalBurnedByTurn(source.byTurn);
      return { outcome: burned >= source.amount ? "a" : "b", inputs: { burned } };
    }
    // ... etc
  }
}
```

### Change 3 — Automated resolution scheduler (no admin trigger)

```typescript
// Runs on a timer. Resolves any market whose condition is met. No human in the loop.
async resolveReadyMarkets(): Promise<void> {
  const markets = await this.getResolvableMarkets();   // cutoff passed, fact knowable
  for (const m of markets) {
    await this.resolveMarketTrustlessly(m.id);
  }
}
```

### Change 4 — A public verification endpoint

```typescript
// Anyone can fetch how a market resolved and re-verify it themselves
// GET /api/markets/:id/proof
{
  resolutionSource: {...},     // what it was about
  resolvedInputs: {...},       // the exact public facts read
  outcome: "a",
  resolutionHash: "0x...",     // hash they can recompute
  // For battle markets: the seed, so they can replay the battle and confirm
}
```

-----

## WHY THE DEV LITERALLY CANNOT CHEAT

Walk the attack surface and close each door:

|Cheat attempt                        |Why it’s impossible                                                         |
|-------------------------------------|----------------------------------------------------------------------------|
|Pick the winning side                |No `winningOutcome` parameter exists — outcome is derived                   |
|Tilt a battle result                 |Battle is deterministic from a seed set at deploy time; replayable by anyone|
|Change ownership to favor a bet      |Ownership is on-chain; rewriting it is rewriting Algorand history           |
|Delay resolution to manage the book  |Resolution is automated on a timer from a public condition                  |
|Change the resolution rule after bets|`resolutionSource` is immutable, recorded at creation                       |
|Quietly settle wrong                 |Resolution records inputs + hash on-chain; anyone re-runs and catches it    |
|Front-run with dev knowledge         |Staking locks BEFORE the fact is knowable; dev has no special timing        |

Every lever a dishonest house would pull is either deleted, automated, or publicly
verifiable. The house isn’t *promising* not to cheat — it’s *structurally unable* to.

-----

## THE MARKETING TRUTH (your words, made real)

> “The only prediction market where the house literally cannot cheat — and you can verify
> it yourself.”

This is not a slogan. It’s a true statement about the architecture, and it’s genuinely rare.
Most prediction markets — in crypto and out — rely on a trusted oracle or a trusted operator
to resolve. Yours resolves by deterministic computation on public data, with the operator
removed from the loop and every resolution independently re-runnable.

That is a real, defensible, possibly-unique claim. Lead with it. It directly extends your
“provable timeline” differentiator: the same determinism that lets you fork history is what
makes the market trustless. **One architecture, two killer features.**

-----

## THE GUARDRAILS

- ✅ Deterministic — outcomes derive from seeds/chain, never opinion
- ✅ Additive — extends the existing markets system; delete only the admin-outcome path
- ✅ On-chain truth — leans on Algorand permanence as the trust anchor
- ✅ Battle engine pure — markets READ battle results, never influence them
- ✅ Removes the dev from resolution entirely — the key trust move
- ✅ Publicly verifiable — proof endpoint + re-runnable computation

-----

## BUILD ORDER

1. Add `resolutionSource` + `resolutionCutoffTs` to the market schema (additive, nullable).
1. Implement `computeOutcome` for the first 2-3 source types (ownership, battle, burn).
1. Delete the admin `resolveMarket(winningOutcome)` path. Replace with
   `resolveMarketTrustlessly`.
1. Wire the automated `resolveReadyMarkets` scheduler.
1. Add the `GET /api/markets/:id/proof` verification endpoint.
1. Update the markets UI to show the resolution source up front (“this resolves from
   on-chain ownership at turn 1500”) and a “verify” link after resolution.
1. Restrict market creation to only allow provable resolution sources.

Do this BEFORE prediction markets handle real $ASCEND value. It’s far easier to build
trustless from the start than to retrofit trust after an accusation.

-----

*Provably-Fair Prediction Market LUT · Ascendancy · frontierprotocol.app*
*The house has no lever because there is no lever. Verify it yourself.*