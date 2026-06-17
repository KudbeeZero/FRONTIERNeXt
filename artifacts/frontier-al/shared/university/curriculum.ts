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
];
