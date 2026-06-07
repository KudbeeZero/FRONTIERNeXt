# ASCENDANCY — The Speculation LUT

### What happens next · scenarios · inflection points · the bets worth making early

> Forward-looking strategic foresight. Not a build plan — a map of futures.
> Read when thinking about where this goes, not what to code today.

-----

## HOW TO READ THIS

This is the only LUT that isn’t grounded in current files — it’s deliberately speculative.
Its job is to make you think two and three moves ahead so today’s decisions don’t close
tomorrow’s doors. Treat it as scenario planning, not prediction. The value isn’t being
right about the future; it’s being *prepared* for several of them.

Structure: the trajectory → three scenarios → the inflection points → the early bets →
the risks → the wildcards.

-----

## 1. THE BASE TRAJECTORY (if you just execute the LUTs)

Assume you ship the roadmap competently and nothing extraordinary happens:

```
NOW          Frontend live, backend pending
+1 month     Backend live, globe loads, sub-parcels + markets wired, secure chat
+3 months    Wallet auth, mainnet, first HILDA videos, first contests, ~500 wallets
+6 months    Temporal timeline mechanic stage 1-2, seasons running, ~2-5k wallets
+12 months   Forking engine live, faction narrative warfare, HILDA channel monetized,
             Jarvis running multiple workers, ~10-25k wallets
```

This is the **competent-execution path.** It’s a real, sustainable indie Web3 game with a
genuine differentiator. Not a moonshot — a solid business. Everything past here is about
what could bend that curve sharply up (or break it).

-----

## 2. THREE SCENARIOS

### SCENARIO A — “The Slow Burn” (most likely, ~60%)

You ship steadily. The temporal/timeline concept earns respect in the Algorand community
and among strategy-game purists. Growth is organic, word-of-mouth, contest-driven. You hit
a few thousand committed players who genuinely love the depth. Revenue from land sales,
$ASCEND economy, and the HILDA channel covers costs and pays you. **This is success.** Most
games never get here. The risk isn’t failure — it’s plateau.

**What bends it up:** one HILDA video goes viral. One contest gets covered by a crypto
outlet. One whale faction war becomes a story. You need *one* breakout moment, and the
flywheel (Living World LUT §7) is designed to manufacture chances at it.

### SCENARIO B — “The Category Definer” (~25%)

The “you own time, not land” framing catches. Someone influential — a crypto YouTuber, an
Algorand Foundation spotlight, a games journalist — grasps that the deterministic provable-
timeline thing is genuinely novel and writes/talks about it. Ascendancy becomes *the
example* people cite for “on-chain games done right.” This pulls in developers, partners,
and a wave of players who want to be early to the category.

**What triggers it:** the Differentiator LUT executed *and named loudly.* The concept is
the marketing. You don’t advertise features; you advertise the idea. Stage 0 (naming the
timeline) is the cheapest highest-leverage move you have.

### SCENARIO C — “The Infrastructure Play” (~15%, highest ceiling)

The most interesting future. You realize partway through that you’ve built something bigger
than a game: a **deterministic, on-chain, forkable world engine.** Other developers want it.
The timeline/observer/forking system becomes a *platform* — a framework for building
provable, branchable on-chain worlds. Ascendancy is the flagship demo; the engine is the
business. This is the Roblox/Unreal pattern: the game proves the engine, the engine is the
empire.

**What triggers it:** keeping the engine clean, modular, and separable from the game
content (which your architecture discipline already pushes toward). If `lib/` stays a clean
deterministic-world toolkit and `frontier-al` is just one consumer of it, you’ve
accidentally built a platform.

-----

## 3. THE INFLECTION POINTS (where the curve bends)

Watch for these moments. Each is a fork where the right move matters disproportionately.

### Inflection 1 — First 100 real wallets

The moment you have real players, not testers. **What matters:** retention, not
acquisition. Don’t chase more users — obsess over whether the first 100 come back daily.
Chat, contests, and the activity feed are your retention instruments. If the first 100
churn, fixing acquisition just fills a leaky bucket faster.

### Inflection 2 — First whale

Someone buys a lot of land or stakes big $ASCEND. **What matters:** the economy must
survive concentrated wealth without breaking fairness. This is where your economic-integrity
hardening (Security LUT §3) gets tested for real. A whale who breaks the game in week 3
poisons the well. Design for adversarial wealth now.

### Inflection 3 — First viral moment

A video, a war, a contest blows up and you get a traffic spike. **What matters:** can the
infrastructure take it, and is onboarding frictionless? A spike that hits a broken
onboarding or an unscaled backend converts a once-in-a-year opportunity into a once-in-a-
year embarrassment. The two-service Railway split, the readiness probes, and a dead-simple
first-session flow are what let you *catch* the wave instead of wiping out on it.

### Inflection 4 — Mainnet

Real value goes live. **What matters:** security is now existential, not theoretical. The
wallet-auth gate (Security LUT) is non-negotiable here. Post-mainnet, every bug is a
potential exploit with real money. This is the cleanest possible line between “fun project”
and “I am responsible for people’s assets.”

### Inflection 5 — The platform realization

The moment you notice another dev wants your engine, not your game. **What matters:**
recognizing it and deciding deliberately — stay a game studio or become an infrastructure
company. Both are valid; conflating them accidentally is the trap. Scenario C only opens if
you see this coming and keep the engine separable.

-----

## 4. THE EARLY BETS (cheap now, valuable later)

Things to do *now* that cost little but preserve or create big future optionality:

|Bet                                 |Cost now                 |Why it matters later                            |
|------------------------------------|-------------------------|------------------------------------------------|
|Keep `lib/` engine clean & separable|Discipline only          |Opens the platform play (Scenario C)            |
|Name the timeline concept (Stage 0) |Free                     |Plants the category-definer flag                |
|Build the activity feed early       |Low                      |Retention instrument at Inflection 1            |
|Design economy for whales now       |Design time              |Survives Inflection 2                           |
|Readiness probes + 2-service split  |Already planned          |Survives Inflection 3                           |
|Wallet auth before any real value   |Already planned          |Survives Inflection 4                           |
|HILDA from day one                  |API costs                |Manufactures viral chances continuously         |
|Capture every world event on-chain  |Already your architecture|The whole differentiator depends on it          |
|Open-source a *piece* of the engine |A weekend                |Developer goodwill, recruiting, platform seeding|

The pattern: **most of your highest-leverage future bets are things your architecture
already does or your roadmap already plans.** The speculation mostly confirms you’re
pointed right — the discipline is in not abandoning those choices under pressure.

-----

## 5. THE RISKS (what kills it)

Honest about the downside. Ranked by likelihood × damage.

### Risk 1 — Plateau (most likely)

Not failure — stagnation. A few hundred players, no growth, slow grind, motivation erodes.
**Mitigation:** the flywheel + one breakout bet (HILDA, the concept). Build engagement loops
that create *chances* at escape velocity, and keep taking shots.

### Risk 2 — Solo-builder burnout

You’re doing a lot with AI assistance, but the surface is enormous. **Mitigation:** the
SKILL + memory + LUT system exists precisely to reduce cognitive load and let agents carry
more. Jarvis/CIPHER offloading real work is a survival mechanism, not a luxury. Ruthlessly
prioritize the In-Flight queue; resist the urge to build everything.

### Risk 3 — Economic exploit at mainnet

A bug drains the treasury or breaks token value. **Mitigation:** Security LUT, adversarial
testing, audit logs, staged mainnet rollout with caps. This is the one that can end the
project overnight — treat it with the most respect.

### Risk 4 — The concept is too clever

“You own time” is brilliant to you and confusing to a casual player who just wants to buy
land and fight. **Mitigation:** the timeline depth is a *ceiling*, not a *floor.* The game
must be fun and legible at the surface (buy land, build, battle, win contests) with the
temporal mechanics as depth for those who want it. Never make the clever thing mandatory to
have fun.

### Risk 5 — Algorand ecosystem dependency

Your fate is partly tied to Algorand’s health and adoption. **Mitigation:** the engine being
chain-aware-but-not-chain-locked (you already have an ICP track) means the deterministic
world concept could port. Don’t over-index on one chain’s fortunes.

-----

## 6. THE WILDCARDS (low probability, high impact)

Things that probably won’t happen but would change everything if they did:

- **AI-native players.** Your Watcher AI agents (roadmap) evolve into autonomous players
  that other players deploy, train, and battle. The game becomes partly AI-vs-AI with humans
  as commanders/breeders. This is genuinely futuristic and your architecture supports it.
- **The forking mechanic becomes a creative tool.** Players fork timelines not to win but
  to tell stories — branching “what-if” histories become user-generated content. Ascendancy
  becomes a narrative sandbox, not just a strategy game.
- **Cross-game timelines.** If the engine becomes a platform (Scenario C), multiple games
  share one provable timeline substrate. A battle in one world is a verifiable event another
  world can reference. Shared-history multiverse.
- **Real-world data as weather/events.** Your edge-AI / WiFi-CSI sensing roadmap note —
  real-world signals seed in-game environmental events. The planet’s weather responds to
  actual physical data. Bridges digital and physical in a way no other game does.
- **The observer mechanic attracts physicists/researchers.** The relativistic framing is
  real enough that academic or science-communication interest could give you a completely
  unexpected audience and credibility vector.

None of these are roadmap items. They’re reminders that the architecture you’ve chosen has
unusually high optionality — it can become things you haven’t planned.

-----

## 7. THE STRATEGIC POSTURE

How to actually hold all this without getting lost:

1. **Execute the base trajectory.** The LUTs are the plan. Ship them. Foresight without
   execution is daydreaming.
1. **Keep the high-optionality bets cheap and alive.** Clean engine, named concept, captured
   history, HILDA running. These cost little and open the big scenarios.
1. **Watch the inflection points.** When you hit the first 100 wallets, the first whale, the
   first viral moment, mainnet, or the platform signal — slow down and choose deliberately.
   These are where disproportionate value is won or lost.
1. **Protect against the project-enders.** Economic exploit and burnout are the two that
   actually kill it. Security discipline and the agent-offload system are your defenses.
1. **Stay legible.** However clever it gets, a new player must be able to buy land, build,
   and fight within five minutes. Depth is a reward for staying, not a tax on arriving.

-----

## 8. THE ONE THING TO INTERNALIZE

You’ve accidentally-on-purpose built something with far more optionality than a typical
indie game: a deterministic, on-chain, forkable world with a provable history and a genuine
conceptual hook. Most of your best future moves are *already latent in choices you’ve made.*

The speculation isn’t “what should I add.” It’s “**don’t abandon what makes this special
when the grind gets hard.**” The plateau, the burnout, the temptation to chase a generic
audience with generic features — those are the real enemies. The architecture is right. The
concept is right. The system for executing it (SKILL + memory + LUTs + agents) is in place.

What happens next is mostly determined by whether you keep choosing the thing that makes
Ascendancy *Ascendancy* — the provable, observable, forkable timeline — over the thousand
easier things that would make it just another game.

Ship the base trajectory. Keep the big bets cheap and alive. Watch the inflections. Don’t
break the economy. Don’t burn out. Stay legible. And never forget you’re building a
timeline, not a map.

-----

*The Speculation LUT · Ascendancy · frontierprotocol.app*
*The future isn’t predicted — it’s kept open. Most of your best moves are already in motion.*