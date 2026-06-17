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
];
