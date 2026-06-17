/**
 * shared/university/curriculum.ts
 *
 * The FRONTIER University course catalog — the actual lesson content. One module
 * per game system, each a short walkthrough + knowledge check the player can take
 * at any time. Content is grounded in the live game (the globe, the weapon build
 * system, the ASCEND economy, the Algorand TestNet wallet flow).
 *
 * Pure data. Validated for integrity by validateCurriculum() in university.spec.ts.
 */

import type { TutorialModule } from "./types";

export const CURRICULUM: TutorialModule[] = [
  // ── The planet ───────────────────────────────────────────────────────────
  {
    id: "intro_globe",
    system: "globe",
    title: "The Planet & Your Plots",
    summary: "What the rotating world is, and how the 21,000 plots work.",
    estMinutes: 3,
    steps: [
      {
        title: "A living planet",
        body: "FRONTIER is a single 3D planet of 21,000 plots spread across 8 biomes. It rotates in real time and every plot is real, server-driven territory — not decoration. Drag to spin the globe, scroll to zoom, and click a plot to select it.",
      },
      {
        title: "Plots are NFTs",
        body: "Each plot you own is minted as an ARC-3 NFT on Algorand TestNet. Owning territory is owning an on-chain asset — it persists between sessions and seasons.",
        tip: "Your holdings survive logout. The planet remembers you.",
      },
      {
        title: "Biomes matter",
        body: "The 8 biomes differ in what they yield and how they play. Where you plant your flag shapes your economy and your defensibility.",
      },
    ],
    quiz: [
      {
        id: "globe_q1",
        prompt: "How many plots make up the planet?",
        options: ["2,100", "21,000", "Unlimited", "8 per biome"],
        correctIndex: 1,
        explanation: "The world is a fixed 21,000 plots across 8 biomes.",
      },
      {
        id: "globe_q2",
        prompt: "What happens when you own a plot?",
        options: [
          "Nothing on-chain — it's local only",
          "It mints an ARC-3 NFT on Algorand",
          "It is rented for one session",
          "It deletes a rival's plot",
        ],
        correctIndex: 1,
        explanation: "Plots are ARC-3 NFTs on Algorand TestNet — durable, on-chain ownership.",
      },
      {
        id: "globe_q3",
        prompt: "Do your holdings persist after you log out?",
        options: ["No, they reset", "Yes — they're persistent and on-chain", "Only for 24 hours"],
        correctIndex: 1,
        explanation: "The game is persistent and blockchain-backed; your territory carries across sessions.",
      },
    ],
  },

  // ── Weapon builds ────────────────────────────────────────────────────────
  {
    id: "intro_builds",
    system: "builds",
    title: "Weapon Builds & Archetypes",
    summary: "Spend your attribute budget, dodge the tradeoff tax, earn an archetype.",
    estMinutes: 4,
    steps: [
      {
        title: "Five attributes, one budget",
        body: "Your build spends a fixed 60-point budget across five attributes: Firepower, Range, Guidance, Interception, and Logistics. No single attribute can exceed 20. This is the NBA-2K idea of a build — you can't max everything, so you specialize.",
      },
      {
        title: "The tradeoff tax",
        body: "Push an attribute past the soft cap of 14 and it starts taxing its tensioned partner: Firepower ⟷ Logistics, Range ⟷ Guidance, Interception ⟷ Firepower. Over-investing in one area knocks another down — exactly like 2K.",
        tip: "The Armory shows an 'eff' value with a ▼ when a tradeoff penalty is in effect.",
      },
      {
        title: "Archetypes & badges",
        body: "Where your points land determines your archetype — Siege Baron, Hypersonic Striker, Aegis Interceptor, Swarm Commodore, and more. As you build AND fight, you climb badge tiers (Bronze → Silver → Gold → Hall of Fame) that unlock weapons and flashier launch animations.",
      },
      {
        title: "Don't sleep on Logistics",
        body: "A Logistics-heavy build becomes the Swarm Commodore and earns the Quartermaster badge, which unlocks the cheap, fast-firing loitering-munition line. You don't out-hit the enemy — you out-last and out-mass them.",
      },
    ],
    quiz: [
      {
        id: "builds_q1",
        prompt: "How many points can you spend across all attributes?",
        options: ["20", "40", "60", "100"],
        correctIndex: 2,
        explanation: "The attribute budget is 60 points, with no single attribute above 20.",
      },
      {
        id: "builds_q2",
        prompt: "What happens when you push an attribute past the soft cap of 14?",
        options: [
          "Nothing — it's free",
          "It taxes its tensioned partner attribute",
          "It refunds points",
          "It locks the build",
        ],
        correctIndex: 1,
        explanation: "Past the soft cap, the tradeoff curve drags down the tensioned partner — builds must specialize.",
      },
      {
        id: "builds_q3",
        prompt: "Which badge does a Logistics build earn, and what does it unlock?",
        options: [
          "Demolition — ballistic missiles",
          "Aegis — missile defense",
          "Quartermaster — loitering munitions",
          "Marksman — cruise missiles",
        ],
        correctIndex: 2,
        explanation: "Logistics drives the Quartermaster badge, which gates the loitering-munition line (the Swarm Commodore's mass-fire payoff).",
      },
    ],
  },

  // ── Combat ───────────────────────────────────────────────────────────────
  {
    id: "intro_combat",
    system: "combat",
    title: "Strikes & Defense",
    summary: "Fire offensive weapons, deploy defenses, and survive interception.",
    estMinutes: 4,
    steps: [
      {
        title: "Offense vs defense",
        body: "Offensive weapons (ballistic, cruise, hypersonic missiles, artillery, rockets, loitering drones) launch AT a target. Defensive systems (anti-air and missile-defense batteries) are deployed to a plot you own and shoot down incoming fire.",
      },
      {
        title: "Range and cost are real",
        body: "Every shot costs ASCEND and respects real range. A 30 km howitzer is strictly local; a cruise missile reaches across the planet. You can only fire from a plot you own, and only if the target is in range.",
        tip: "Out-of-range targets are rejected — check a weapon's range before you commit.",
      },
      {
        title: "Interception is a coin you can load",
        body: "A defended target may intercept your strike. Higher Guidance makes your missiles harder to stop; a defender's Interception and the battery's base kill-probability make them easier to stop. Layer your defenses to cover point, area, and exo ranges.",
      },
    ],
    quiz: [
      {
        id: "combat_q1",
        prompt: "Where must you be to fire an offensive weapon?",
        options: ["Anywhere on the map", "On a plot you own, with the target in range", "Only from biome capitals"],
        correctIndex: 1,
        explanation: "You fire from a plot you own, and only when the target is within the weapon's range.",
      },
      {
        id: "combat_q2",
        prompt: "What do defensive batteries do?",
        options: [
          "Increase your ASCEND income",
          "Intercept incoming offensive fire",
          "Mine new plots",
          "Boost missile range",
        ],
        correctIndex: 1,
        explanation: "Anti-air and missile-defense batteries are deployed to your plots and shoot down incoming strikes.",
      },
      {
        id: "combat_q3",
        prompt: "Which attribute makes YOUR missiles harder to intercept?",
        options: ["Logistics", "Guidance", "Interception", "Range"],
        correctIndex: 1,
        explanation: "Guidance improves accuracy and makes a strike harder to shoot down.",
      },
    ],
  },

  // ── Economy ──────────────────────────────────────────────────────────────
  {
    id: "intro_economy",
    system: "economy",
    title: "ASCEND & the Economy",
    summary: "The token that powers everything — earning it and spending it.",
    estMinutes: 3,
    steps: [
      {
        title: "ASCEND is the fuel",
        body: "ASCEND is the game's token (an Algorand ASA). You spend it to unlock weapons, fire shots, upgrade gear, and deploy defenses. Unlocking a weapon is a one-time cost; firing it is a per-shot cost.",
      },
      {
        title: "Costs scale with power",
        body: "Bigger weapons cost more to unlock and fire. Cheap loitering drones let a Logistics build sustain volume; an apex hypersonic costs many times more per shot. Spend where your build is strong.",
        tip: "In testing mode, ASCEND costs are discounted so you can experiment freely.",
      },
    ],
    quiz: [
      {
        id: "econ_q1",
        prompt: "What is ASCEND?",
        options: ["A biome", "The game's token (an Algorand ASA)", "An AI faction", "A weapon tier"],
        correctIndex: 1,
        explanation: "ASCEND is the in-game token — an Algorand ASA — used for nearly every action.",
      },
      {
        id: "econ_q2",
        prompt: "How does unlocking a weapon differ from firing it?",
        options: [
          "They're the same cost",
          "Unlock is one-time; firing is per-shot",
          "Firing is free after unlock",
          "Unlocking is free",
        ],
        correctIndex: 1,
        explanation: "Unlocking is a single acquisition cost; each shot then has its own fire cost.",
      },
    ],
  },

  // ── The Algorand wallet (the requested how-to) ───────────────────────────
  {
    id: "intro_wallet",
    system: "wallet",
    title: "Your Algorand Wallet",
    summary: "Connect a wallet, opt in to ASCEND, and claim — step by step.",
    estMinutes: 5,
    steps: [
      {
        title: "Why you need a wallet",
        body: "FRONTIER runs on Algorand TestNet. Your wallet is your identity and your vault: it holds your plot NFTs and your ASCEND, and it signs the actions you take. No wallet, no on-chain ownership.",
      },
      {
        title: "Connect it",
        body: "Use an Algorand wallet such as Pera or Defly. On the game screen, choose Connect Wallet and approve the connection in your wallet app. Your address then identifies your player — the same hooks the whole game reads from.",
        tip: "This is TestNet — fund your wallet from a TestNet faucet, never with real ALGO.",
      },
      {
        title: "Opt in to ASCEND",
        body: "Algorand requires you to OPT IN to an asset before you can hold it. To receive ASCEND you do a one-time opt-in transaction (a tiny network fee). Until you opt in, the chain cannot deliver the token to you.",
        tip: "Opt-in is a standard, safe, one-time step for any Algorand ASA.",
      },
      {
        title: "Claim and confirm",
        body: "Once opted in, you can claim ASCEND. Every transaction is final only after the network confirms it — wait for confirmation before assuming a transfer landed. That confirmation is what makes ownership real rather than a promise.",
      },
    ],
    quiz: [
      {
        id: "wallet_q1",
        prompt: "Which network does FRONTIER use?",
        options: ["Ethereum mainnet", "Algorand TestNet", "A private server only", "Bitcoin"],
        correctIndex: 1,
        explanation: "The game runs on Algorand TestNet — use TestNet funds, never real ALGO.",
      },
      {
        id: "wallet_q2",
        prompt: "Why must you opt in before receiving ASCEND?",
        options: [
          "To pay a subscription",
          "Algorand requires opting in to an ASA before you can hold it",
          "To delete old tokens",
          "It's optional and does nothing",
        ],
        correctIndex: 1,
        explanation: "On Algorand you must opt in to an asset (a one-time tx) before the chain can deliver it to you.",
      },
      {
        id: "wallet_q3",
        prompt: "When is a transfer actually done?",
        options: [
          "The moment you click",
          "After the network confirms the transaction",
          "Never — it's just visual",
          "After you log out",
        ],
        correctIndex: 1,
        explanation: "A transaction is final only once the network confirms it — wait for confirmation.",
      },
    ],
  },

  // ── Factions ─────────────────────────────────────────────────────────────
  {
    id: "intro_factions",
    system: "factions",
    title: "The Four Factions",
    summary: "Who else lives on the planet, and why they act on their own.",
    estMinutes: 2,
    steps: [
      {
        title: "You're not alone",
        body: "Four autonomous AI factions share the planet. They expand, fight, and react on their own — the world keeps moving whether or not you're online. Their pressure is part of the map you're reading.",
      },
      {
        title: "Read the board",
        body: "Faction activity shapes where territory is contested and where it's safe to grow. Watch the war room and factions panels to time your moves.",
      },
    ],
    quiz: [
      {
        id: "factions_q1",
        prompt: "How many AI factions share the world?",
        options: ["One", "Two", "Four", "Eight"],
        correctIndex: 2,
        explanation: "Four autonomous AI factions act independently across the planet.",
      },
      {
        id: "factions_q2",
        prompt: "Do the factions act only when you're online?",
        options: ["Yes", "No — they're autonomous and act on their own"],
        correctIndex: 1,
        explanation: "The factions are autonomous; the world keeps evolving whether or not you're watching.",
      },
    ],
  },

  // ── Commanders ───────────────────────────────────────────────────────────
  {
    id: "intro_commanders",
    system: "commanders",
    title: "Commanders",
    summary: "Three tiers, four special attacks, and minting one as an NFT.",
    estMinutes: 4,
    steps: [
      {
        title: "Your champion on the field",
        body: "A commander is a minted champion that buffs your attacks and defense and can unleash special attacks. You mint one for ASCEND, and each comes with a companion (Wolf, Fox, or Raptor).",
      },
      {
        title: "Pick your tier",
        body: "Three tiers trade offense for defense: Sentinel (+10 attack / +10 defense) is the balanced anchor; Phantom (+18 / +6) leans aggressive; Reaper (+30 / +5) is glass-cannon raw power. After a commander attacks, it's locked for 12 hours — commit your strikes wisely.",
        tip: "More attack usually means less defense — match the tier to how you play.",
      },
      {
        title: "Special attacks",
        body: "Commanders wield tier-gated special attacks: Orbital Strike, EMP Blast, Siege Barrage (Reaper only), and Sabotage. Each costs ASCEND and has its own cooldown. You can hit a whole plot or a single cell of its 9-cell sub-parcel grid.",
      },
      {
        title: "Mint it as an NFT",
        body: "A commander can be minted as an on-chain NFT (an Algorand ASA) delivered to your wallet. The UI walks it from Minting → Ready → In Wallet — true ownership of your champion.",
      },
    ],
    quiz: [
      {
        id: "cmd_q1",
        prompt: "Which commander tier has the most raw attack?",
        options: ["Sentinel", "Phantom", "Reaper", "They're all equal"],
        correctIndex: 2,
        explanation: "Reaper is the glass cannon: +30 attack but only +5 defense.",
      },
      {
        id: "cmd_q2",
        prompt: "What happens to a commander right after it attacks?",
        options: ["It's destroyed", "It's locked for 12 hours", "It heals instantly", "It downgrades a tier"],
        correctIndex: 1,
        explanation: "A commander is locked for 12 hours after attacking, so timing matters.",
      },
      {
        id: "cmd_q3",
        prompt: "What powers a commander's special attacks?",
        options: ["Nothing — they're free", "ASCEND, with a cooldown", "Iron ore", "Faction approval"],
        correctIndex: 1,
        explanation: "Special attacks cost ASCEND and each has its own cooldown.",
      },
    ],
  },

  // ── Trade Station ────────────────────────────────────────────────────────
  {
    id: "intro_trade",
    system: "trade",
    title: "The Trade Station",
    summary: "Swap resources and buy/sell sub-parcels with other players.",
    estMinutes: 3,
    steps: [
      {
        title: "Post an order",
        body: "The Trade Station is a player-to-player exchange. You post a 'give X for Y' order across four resources — Iron, Fuel, Crystal, and ASCEND — and another player accepts it to complete the swap.",
      },
      {
        title: "The sub-parcel marketplace",
        body: "Beyond resources, you can list sub-parcels you own for sale at an ASCEND ask price. Other players buy them outright; you can cancel a listing any time before it sells.",
        tip: "Sub-parcels are the 9 cells inside a plot — tradeable real estate.",
      },
      {
        title: "Climb the trader board",
        body: "Trades you post and fill count toward the trader leaderboard. Active market-makers rise to the top.",
      },
    ],
    quiz: [
      {
        id: "trade_q1",
        prompt: "Which of these is a tradeable resource at the Trade Station?",
        options: ["Plutonium", "Iron", "Mana", "XP"],
        correctIndex: 1,
        explanation: "The four resources are Iron, Fuel, Crystal, and ASCEND.",
      },
      {
        id: "trade_q2",
        prompt: "How is a resource order completed?",
        options: [
          "The server auto-fills it",
          "Another player accepts your 'give X for Y' order",
          "It expires into ASCEND",
          "A faction buys it",
        ],
        correctIndex: 1,
        explanation: "Orders are peer-to-peer: you post, another player accepts.",
      },
      {
        id: "trade_q3",
        prompt: "In what currency do you list a sub-parcel for sale?",
        options: ["Iron", "ASCEND", "Fuel", "Real USD"],
        correctIndex: 1,
        explanation: "Sub-parcel listings carry an ASCEND ask price.",
      },
    ],
  },

  // ── Prediction Markets ───────────────────────────────────────────────────
  {
    id: "intro_markets",
    system: "markets",
    title: "Prediction Markets",
    summary: "Stake ASCEND on outcomes — and verify the result can't be rigged.",
    estMinutes: 4,
    steps: [
      {
        title: "Bet on what happens next",
        body: "Prediction markets let you stake ASCEND on binary outcomes across the game: battles, factions, the season, orbital events, and the economy. Your stake joins a liquidity pool; winners split it (minus a 5% protocol fee).",
      },
      {
        title: "Open → Closed → Resolved",
        body: "Each market is Open (you can stake), then Closed (staking locks while the real-world fact settles), then Resolved (the outcome is set and winners claim). You can't change a position once a market closes.",
      },
      {
        title: "Provably fair — verify it yourself",
        body: "When a market is created it commits to an immutable resolution source (e.g. a replayable battle outcome or an ownership snapshot at a turn). After it resolves, hit 'Verify proof': the resolver re-runs on the public inputs and checks the hash. That's how you know the admin cannot pick winners.",
        tip: "If the re-run doesn't match, the proof fails — fairness you can check, not just trust.",
      },
    ],
    quiz: [
      {
        id: "mkt_q1",
        prompt: "What do you stake in a prediction market?",
        options: ["Iron", "ASCEND", "Plots", "Nothing"],
        correctIndex: 1,
        explanation: "You wager ASCEND into a liquidity pool; winners split it minus a 5% fee.",
      },
      {
        id: "mkt_q2",
        prompt: "What does 'Verify proof' on a resolved market prove?",
        options: [
          "That you won",
          "That the outcome wasn't tampered with — the admin can't pick winners",
          "That the market is still open",
          "Your wallet balance",
        ],
        correctIndex: 1,
        explanation: "Verification re-runs the resolver on public inputs and checks the hash, proving the result is honest.",
      },
      {
        id: "mkt_q3",
        prompt: "When can you no longer change your position?",
        options: ["Never", "Once the market is Closed", "Only after you claim", "After 12 hours"],
        correctIndex: 1,
        explanation: "Staking locks when a market moves from Open to Closed.",
      },
    ],
  },

  // ── Terraforming ─────────────────────────────────────────────────────────
  {
    id: "intro_terraform",
    system: "terraform",
    title: "Terraforming",
    summary: "Reshape your land — and weaponize an enemy's.",
    estMinutes: 3,
    steps: [
      {
        title: "Reshape the land",
        body: "Terraforming changes a plot's biome and condition. You can convert a biome between Desert, Forest, Ice, Toxic, and Plains, reduce its hazard, raise its stability, or boost its resource multiplier.",
      },
      {
        title: "Watch hazard and stability",
        body: "Two gauges run 0–100: hazard and stability. A plot becomes 'degraded' when hazard climbs above 60 or stability drops below 30 — degraded land underperforms. Converting a biome carries a small stability penalty, so don't flip biomes carelessly.",
        tip: "Healthy land = low hazard, high stability, and a boosted resource multiplier.",
      },
      {
        title: "Corrupt the enemy",
        body: "Terraforming cuts both ways: 'corrupt land' raises an enemy plot's hazard and lowers its stability — an attack on their economy rather than their army.",
      },
    ],
    quiz: [
      {
        id: "terra_q1",
        prompt: "When is a plot considered 'degraded'?",
        options: [
          "When stability is above 70",
          "When hazard > 60 or stability < 30",
          "Only when it's a Toxic biome",
          "Never",
        ],
        correctIndex: 1,
        explanation: "Degraded = hazard above 60 OR stability below 30; such land underperforms.",
      },
      {
        id: "terra_q2",
        prompt: "What does 'corrupt land' do to an enemy plot?",
        options: [
          "Heals it",
          "Raises hazard and lowers stability",
          "Mints them an NFT",
          "Gives them ASCEND",
        ],
        correctIndex: 1,
        explanation: "Corrupting land raises hazard and lowers stability — an economic attack.",
      },
      {
        id: "terra_q3",
        prompt: "Boosting resources improves which value?",
        options: ["The resource multiplier", "Your commander's attack", "Missile range", "Faction standing"],
        correctIndex: 0,
        explanation: "boost_resources raises the plot's resource multiplier.",
      },
    ],
  },

  // ── Seasons ──────────────────────────────────────────────────────────────
  {
    id: "intro_seasons",
    system: "seasons",
    title: "Seasons & Rewards",
    summary: "A persistent world that pays out — without wiping your progress.",
    estMinutes: 3,
    steps: [
      {
        title: "The world persists",
        body: "Unlike most games, FRONTIER does NOT hard-reset between seasons. Your plots, sub-parcels, and improvements carry forward. A season is a ~90-day competitive chapter layered on top of a world that keeps its memory.",
      },
      {
        title: "Settlement day",
        body: "When a season ends, the leaderboard is snapshotted and FRONTIER token rewards are paid to the top 10 players. The split is top-heavy — first place takes the largest share (about 30% of the pool).",
        tip: "Rank matters most at the very end — position yourself before settlement.",
      },
      {
        title: "Heed the countdown",
        body: "As a season closes, the game broadcasts warnings at 24 hours, 6 hours, and 1 hour. Use them to lock in territory and standings before the snapshot.",
      },
    ],
    quiz: [
      {
        id: "season_q1",
        prompt: "What happens to your progress at the end of a season?",
        options: [
          "Everything resets to zero",
          "It persists — ownership and improvements carry forward",
          "Only ASCEND is kept",
          "Your account is deleted",
        ],
        correctIndex: 1,
        explanation: "The world is persistent; seasons settle rewards without wiping progress.",
      },
      {
        id: "season_q2",
        prompt: "Who receives the end-of-season FRONTIER token rewards?",
        options: ["Everyone equally", "The top 10 players", "Only first place", "The factions"],
        correctIndex: 1,
        explanation: "The top 10 share a top-heavy reward pool, with first place taking the largest cut.",
      },
      {
        id: "season_q3",
        prompt: "When does the game warn you a season is ending?",
        options: ["No warning", "At 24h, 6h, and 1h", "Only at the very end", "A week before"],
        correctIndex: 1,
        explanation: "Countdown warnings broadcast at 24 hours, 6 hours, and 1 hour before settlement.",
      },
    ],
  },

  // ── Orbital: satellites & recon drones ───────────────────────────────────
  {
    id: "intro_orbital",
    system: "orbital",
    title: "Satellites & Recon Drones",
    summary: "Put assets in orbit: scout the enemy with drones, boost your yield with satellites.",
    estMinutes: 4,
    steps: [
      {
        title: "Two things you put in the sky",
        body: "Orbital assets come in two flavors. Recon drones are intelligence — you launch one at an enemy parcel and it scouts. Satellites are economy — you launch one over your own holdings and it boosts what they mine. They cost ASCEND and they expire, so you redeploy as the game moves.",
      },
      {
        title: "Recon drones",
        body: "A drone costs 20 ASCEND to deploy and scouts for 15 minutes before it returns. You can have up to 5 drones out at once. Aim one at enemy territory to gather intel on what that parcel holds — recon before you commit to a strike, not after.",
        tip: "Drones have no range limit and no redeploy cooldown — once one returns, you can send it straight back out.",
      },
      {
        title: "Satellites",
        body: "A satellite costs 50 ASCEND and stays in orbit for 1 hour, granting +25% mining yield across ALL of your territories while it's up. You can run up to 2 satellites at once, and the bonus stacks — two active satellites is roughly +50% on your whole economy for that window.",
        tip: "Satellites only ever help YOUR mining — they don't attack, defend, or touch enemy plots.",
      },
      {
        title: "Don't confuse it with Orbital Strike",
        body: "There's also an 'Orbital Strike' — but that's a commander special attack (25 ASCEND, 30-minute cooldown, 3x damage that ignores half the target's defense), not an orbital asset you deploy. Satellites boost income; drones gather intel; Orbital Strike is a one-off bombardment your commander fires.",
      },
    ],
    quiz: [
      {
        id: "orbital_q1",
        prompt: "What does deploying a recon drone do?",
        options: [
          "Boosts your mining yield",
          "Scouts an enemy parcel for intel",
          "Fires a bombardment at the target",
          "Mints an NFT",
        ],
        correctIndex: 1,
        explanation: "A drone (20 ASCEND, 15-minute scout, up to 5 at once) gathers intelligence on enemy territory — it's recon, not attack.",
      },
      {
        id: "orbital_q2",
        prompt: "What does an active satellite give you?",
        options: [
          "+25% mining yield on all your territories for 1 hour",
          "A permanent defense bonus",
          "Vision of the whole map forever",
          "A free plot",
        ],
        correctIndex: 0,
        explanation: "A satellite (50 ASCEND, 1-hour orbit, up to 2 at once) grants +25% mining yield across your holdings, and the bonus stacks per satellite.",
      },
      {
        id: "orbital_q3",
        prompt: "How is 'Orbital Strike' different from a satellite?",
        options: [
          "It's the same thing",
          "Orbital Strike is a commander special attack; a satellite is a passive yield boost",
          "Orbital Strike boosts mining; satellites attack",
          "Neither exists",
        ],
        correctIndex: 1,
        explanation: "Orbital Strike is a commander special attack (3x damage, ignores 50% defense); satellites are passive economy boosts you put over your own plots.",
      },
    ],
  },

  // ── NFT minting deep-dive ────────────────────────────────────────────────
  {
    id: "intro_nft",
    system: "nft",
    title: "How Minting Works",
    summary: "Plots, commanders, and weapons become real Algorand ASAs — opt-in, delivery, and finality.",
    estMinutes: 5,
    steps: [
      {
        title: "Everything you own is an ASA",
        body: "Your plots, commanders, and weapons aren't database rows pretending to be assets — each is minted as a 1-of-1 Algorand Standard Asset. A plot mints with the unit name PLOT; a commander as CMDR; a weapon as WPN. ASCEND, the currency, is a separate fungible ASA (asset 755818217, 6 decimals).",
      },
      {
        title: "ARC-3 metadata",
        body: "Each minted asset is ARC-3 compliant: its on-chain metadata URL ends in '#arc3', baked permanently into the asset at mint time. That '#arc3' tag is what tells any Algorand wallet or explorer how to read the asset's name, image, and properties.",
        tip: "The '#arc3' fragment is the standard's fingerprint — it's literally part of the asset's metadata URL.",
      },
      {
        title: "Opt-in comes first",
        body: "On Algorand a wallet can't receive an asset it hasn't opted into. So a freshly-minted NFT is held in custody until your wallet has opted in — only then can it be transferred to you. The chain even checks your opt-in status before attempting delivery; until you opt in, the asset literally cannot land.",
      },
      {
        title: "Finality, not just a click",
        body: "Minting and delivery are real transactions that the server waits to confirm on-chain (waiting a couple of rounds for a mint to finalize) before treating it as done. Mints are tracked as pending → confirmed → (or failed), and an idempotency guard makes sure a rapid double-tap can never mint the same thing twice.",
        tip: "'Confirmed' means the network agreed — that's when your asset is truly yours.",
      },
    ],
    quiz: [
      {
        id: "nft_q1",
        prompt: "What form do your plots, commanders, and weapons take on-chain?",
        options: [
          "Off-chain database entries only",
          "1-of-1 Algorand Standard Assets (ASAs)",
          "Ethereum ERC-721 tokens",
          "Shares of the ASCEND token",
        ],
        correctIndex: 1,
        explanation: "Each is minted as its own 1-of-1 ASA (PLOT / CMDR / WPN). ASCEND is a separate fungible ASA, 755818217.",
      },
      {
        id: "nft_q2",
        prompt: "What does the '#arc3' on an asset's metadata URL signify?",
        options: [
          "A version number",
          "ARC-3 metadata compliance, baked into the asset at mint",
          "That the asset is for sale",
          "A discount code",
        ],
        correctIndex: 1,
        explanation: "The '#arc3' fragment marks the asset as ARC-3 compliant so wallets and explorers can read its metadata.",
      },
      {
        id: "nft_q3",
        prompt: "Why is a freshly-minted NFT held in custody before you get it?",
        options: [
          "To charge you rent",
          "Because Algorand requires your wallet to opt in before it can receive the asset",
          "Because minting is reversible",
          "It isn't — it's sent instantly",
        ],
        correctIndex: 1,
        explanation: "A wallet can't receive an asset it hasn't opted into, so the asset is custodied until you opt in, then delivered.",
      },
    ],
  },

  // ── First 10 minutes (onboarding) ────────────────────────────────────────
  {
    id: "intro_basics",
    system: "basics",
    title: "Your First 10 Minutes",
    summary: "Connect a wallet, claim ASCEND, own a plot, set a build, and fire your first shot.",
    estMinutes: 5,
    steps: [
      {
        title: "1. Connect your wallet",
        body: "FRONTIER runs on Algorand TestNet, and your wallet is your identity. Choose Connect Wallet and pick one of the supported wallets — Pera, Defly, Kibisis, or LUTE — then approve the connection. Your address is now your player.",
        tip: "This is TestNet: fund it from a TestNet faucet, never with real ALGO.",
      },
      {
        title: "2. Claim your ASCEND",
        body: "Every new player gets a 500 ASCEND welcome bonus — the fuel for almost everything you'll do. To claim it on-chain you must first be opted in to the ASCEND asset (Algorand requires opting in before a wallet can receive a token). Opt in, then claim, and wait for confirmation.",
        tip: "If you haven't opted in to ASCEND, the claim can't deliver — opt in first.",
      },
      {
        title: "3. Own a plot",
        body: "The planet is 21,000 plots. To take one, you buy it with a TestNet ALGO payment (cheap in testing mode). The server verifies your payment on-chain, and your new plot mints as an ARC-3 NFT in your wallet. Note: plots cost ALGO, while shots and deploys cost ASCEND.",
      },
      {
        title: "4. Set a build, then fire",
        body: "Open the Armory and spend your 60-point budget across the five attributes — Firepower, Range, Guidance, Interception, Logistics — with no attribute above 20 (and push past the soft cap of 14 and you start taxing its partner). Then fire your first shot: you must own the firing plot, the target must be in range, and the shot costs ASCEND. Confirm the hit and you're playing.",
        tip: "You can only fire from a plot you own at a target within range — that's why step 3 comes before step 4.",
      },
    ],
    quiz: [
      {
        id: "basics_q1",
        prompt: "How much ASCEND does a new player receive as a welcome bonus?",
        options: ["0", "100", "500", "21,000"],
        correctIndex: 2,
        explanation: "New players get a 500 ASCEND welcome bonus to get started.",
      },
      {
        id: "basics_q2",
        prompt: "What do you pay to acquire your first plot?",
        options: [
          "ASCEND",
          "A TestNet ALGO payment (the plot then mints as an ARC-3 NFT)",
          "Iron",
          "Nothing — every plot is free",
        ],
        correctIndex: 1,
        explanation: "Plots are bought with an on-chain TestNet ALGO payment and mint as ARC-3 NFTs; ASCEND is for shots and deploys, not buying land.",
      },
      {
        id: "basics_q3",
        prompt: "What must be true before you can fire your first shot?",
        options: [
          "Nothing — you can fire from anywhere",
          "You own the firing plot, the target is in range, and you have the ASCEND to pay",
          "You must own all 21,000 plots",
          "Your wallet must hold real ALGO",
        ],
        correctIndex: 1,
        explanation: "You fire from a plot you own, only at a target within range, and each shot costs ASCEND.",
      },
    ],
  },

  // ── Advanced: layered defense tactics (combat) ───────────────────────────
  {
    id: "combat_layered_defense_adv",
    system: "combat",
    title: "Layered Defense Tactics",
    summary: "Defense in depth: how point, area, and terminal-high/exo batteries combine to catch threats no single layer could.",
    estMinutes: 8,
    steps: [
      {
        title: "Why one battery is never enough",
        body: "Every defense battery models a full system — radar, command, and a magazine — tuned for ONE layer. The four layers run point → area → terminal-high → exo. Low layers (C-RAM, Iron Dome) are cheap, react fast, and hold deep magazines, but can't reach high or far. High layers (THAAD, Aegis SM-6, Arrow-3) reach the exoatmosphere and hit hard, but are expensive, slow to cycle, and carry few rounds. No single battery covers the whole threat spectrum, so survivable bases STACK layers.",
        tip: "Read a battery by its envelope: interceptRangeKm (reach), maxAltKm (ceiling), basePk (kill chance), magazine (shots), reactionMs (speed to engage).",
      },
      {
        title: "The point layer — fast, close, cheap",
        body: "Point defense is your last-ditch inner ring against short-range, low-flying threats — artillery, rockets, drones. C-RAM is the fastest reactor in the game (1500 ms) with the deepest magazine (40) and the lowest ceiling: range 4 km, alt 2 km, Pk 0.55. Iron Dome extends the bubble to 70 km / 10 km alt at Pk 0.65 with a 20-round magazine. These shine against cheap mass: many incoming, each easy to hit.",
        tip: "Low ceiling is the point. C-RAM physically cannot touch a ballistic threat arcing at 100+ km altitude — that's a higher layer's job.",
      },
      {
        title: "The area layer — the mid-altitude band",
        body: "Area defense bridges point batteries and the exo shield. NASAMS- and Patriot-class interceptors live here, alongside David's Sling (range 300 km, alt 50 km, Pk 0.74). Patriot PAC-3 MSE reaches 120 km / 35 km alt at Pk 0.75. They trade C-RAM's deep magazine and instant reaction for far greater reach — David's Sling reacts in 6000 ms vs C-RAM's 1500 ms — catching cruise and shorter ballistic threats before they reach the point bubble.",
        tip: "Layers overlap on purpose. A threat that survives the area layer should fly into a point battery for a second engagement — depth, not redundancy.",
      },
      {
        title: "Terminal-high / exo — ceiling-busters, and the gate",
        body: "The top layer catches ballistic and hypersonic threats in their terminal-high or exo phase. THAAD reaches 150 km altitude (Pk 0.8); Aegis SM-6 hits 370 km range / 110 km alt (Pk 0.82); Arrow-3 Shield tops out at 1000 km altitude with the highest Pk in the game (0.88) — but only 6 rounds and a long cooldown. These are gated by the aegis badge: C-RAM needs 'none', Iron Dome 'bronze', David's Sling 'silver', THAAD/Aegis SM-6 'gold', Arrow-3 'hall_of_fame'.",
        tip: "Against a hypersonic or ballistic strike, your low layers have the wrong ceiling — only a gold+ exo battery can engage. Build defense to the HIGHEST threat you expect.",
      },
    ],
    quiz: [
      {
        id: "def_adv_q1",
        prompt: "An enemy launches a ballistic threat arcing well above 100 km. Which battery can engage it?",
        options: [
          "C-RAM Point Defense (alt 2 km)",
          "Iron Dome Battery (alt 10 km)",
          "Arrow-3 Shield (alt 1000 km)",
          "NASAMS AMRAAM (alt 14 km)",
        ],
        correctIndex: 2,
        explanation: "Only a high/exo battery has the ceiling. Arrow-3 reaches 1000 km altitude; C-RAM (2), Iron Dome (10), NASAMS (14) top out far too low.",
      },
      {
        id: "def_adv_q2",
        prompt: "Why pair a deep-magazine point battery with a long-reach area battery instead of relying on either alone?",
        options: [
          "They share one magazine, so pairing doubles ammo",
          "The area layer engages far out at high Pk; leakers fly into the point layer for a fast second shot",
          "Point batteries can't fire unless an area battery is present",
          "Pairing raises each interceptor's basePk",
        ],
        correctIndex: 1,
        explanation: "Defense in depth: overlapping layers give a threat multiple engagement chances. Magazines and Pk are per-battery — pairing doesn't merge them.",
      },
      {
        id: "def_adv_q3",
        prompt: "What unlocks Arrow-3 Shield, the top exo-layer battery?",
        options: [
          "The aegis badge at 'bronze'",
          "The aegis badge at 'hall_of_fame'",
          "No badge — it's available to everyone",
          "The aegis badge at 'silver'",
        ],
        correctIndex: 1,
        explanation: "Arrow-3 Shield is gated by aegis 'hall_of_fame' — the highest tier. The ladder: none → bronze → silver → gold → hall_of_fame.",
      },
    ],
  },

  // ── Advanced: archetype mastery (builds) ─────────────────────────────────
  {
    id: "builds_archetype_mastery_adv",
    system: "builds",
    title: "Archetype Mastery",
    summary: "Land your points so your effective top-two attributes derive the exact archetype you want — without bleeding value to the tradeoff tax.",
    estMinutes: 8,
    steps: [
      {
        title: "The budget, the cap, and the tax",
        body: "You distribute a fixed 60-point budget across five attributes, none above 20. The catch is the SOFT CAP at 14: every point above 14 costs 0.5 of its tensioned partner's EFFECTIVE value. Your raw allocation is what you spend; the effective values are what's derived after the tax. Push one attribute to 20 and you've spent 6 past the cap — 3.0 effective points bled out of its partner.",
        tip: "Effective, not raw, is what counts. A raw 20 has already drained its partners by 3.0 on the way up.",
      },
      {
        title: "The three tension pairs",
        body: "Three symmetric pairs decide who pays: firepower ⟷ logistics (heavy hitters reload slower), range ⟷ guidance (reaching far costs precision), and interception ⟷ firepower (defense sacrifices offense). The penalty is two-way. Note firepower sits in TWO pairs, so over-stacking firepower bleeds BOTH logistics and interception — and is taxed by both.",
        tip: "The tax is free when it lands on an attribute you don't want. A pure interception wall taxes firepower — which you weren't using anyway.",
      },
      {
        title: "The archetype roster",
        body: "Your archetype is purely a function of where your EFFECTIVE points land — its top two attributes. The roster: Siege Baron (firepower+range, the default), Artillery Marshal (range+logistics), Hypersonic Striker (firepower+guidance), Ghost Marksman (guidance+range), Aegis Interceptor (interception+guidance), and Swarm Commodore (logistics+firepower). The game scores each archetype against your top two and picks the best match.",
        tip: "Swarm Commodore's primary is LOGISTICS, secondary firepower — the inverse of Siege Baron. Make logistics your single highest effective attribute with firepower second.",
      },
      {
        title: "Hitting a target archetype on purpose",
        body: "To land a specific archetype, make its PRIMARY your single highest effective attribute and its SECONDARY your second. The trap: the tradeoff tax can silently reorder your effective top two. The discipline — keep your two target attributes at or below the soft cap where possible, and never push a NON-target attribute past 14 if its partner is one of your two targets.",
        tip: "Cheapest clean build: spend your two target attributes up toward 14 (no tax), then park leftover points in an attribute whose partner you don't need.",
      },
    ],
    quiz: [
      {
        id: "build_adv_q1",
        prompt: "You raw-allocate firepower to 20. With a soft cap of 14 and tradeoff rate 0.5, how much effective value is taxed out of EACH of firepower's tensioned partners?",
        options: ["1.0 each", "3.0 each", "6.0 each", "0 — the tax only applies above 20"],
        correctIndex: 1,
        explanation: "Points above the cap = 20 − 14 = 6; tax = 6 × 0.5 = 3.0. Firepower is in two pairs (logistics, interception), so each partner loses 3.0.",
      },
      {
        id: "build_adv_q2",
        prompt: "Which pair defines the Swarm Commodore archetype (primary, secondary)?",
        options: [
          "firepower primary, range secondary",
          "interception primary, guidance secondary",
          "logistics primary, firepower secondary",
          "range primary, logistics secondary",
        ],
        correctIndex: 2,
        explanation: "Swarm Commodore is logistics primary, firepower secondary — sustained attritable volume. (firepower+range is Siege Baron; interception+guidance is Aegis Interceptor.)",
      },
      {
        id: "build_adv_q3",
        prompt: "What's the cleanest way to hit a target archetype while paying zero tradeoff tax?",
        options: [
          "Push the archetype's primary to its max of 20",
          "Spread all 60 points evenly across five attributes",
          "Keep your two target attributes at or below 14, and park leftover points in an attribute whose partner you don't need",
          "Invest only in the secondary and leave the primary at zero",
        ],
        correctIndex: 2,
        explanation: "The tax triggers only above 14. Keep both targets ≤14, and dump spare points where the tax (if any) lands on something you don't care about.",
      },
    ],
  },
];
