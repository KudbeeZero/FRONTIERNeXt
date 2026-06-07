<div align="center">

```
   .   ✦       .          *            .        ✦       .     .
        ◍ ──── F R O N T I E R   G L O S S A R Y ──────────── ◍
   *   .     every term a commander needs, A to Z          ✦   .
        .         *            .             .       *        .
```

# 📒 Glossary

**FRONTIERNeXt** · Terms & definitions

<a href="../../README.md"><img src="https://img.shields.io/badge/⟵_Docs_Home-0B0E2A?style=for-the-badge" alt="Docs Home"></a>
<a href="GAME_MANUAL.md"><img src="https://img.shields.io/badge/📖_Manual-2D7FF9?style=for-the-badge&labelColor=0B0E2A" alt="Manual"></a>
<a href="QUICK_REFERENCE.md"><img src="https://img.shields.io/badge/⚡_Quick_Ref-F5C518?style=for-the-badge&labelColor=0B0E2A" alt="Quick Reference"></a>
<a href="LORE_CODEX.md"><img src="https://img.shields.io/badge/🌌_Lore-B26BFF?style=for-the-badge&labelColor=0B0E2A" alt="Lore"></a>

</div>

> Jump: [A](#a) · [B](#b) · [C](#c) · [D](#d) · [E](#e) · [F](#f) · [G](#g) · [I](#i) · [K](#k) · [L](#l) · [M](#m) · [N](#n) · [O](#o) · [P](#p) · [Q](#q) · [R](#r) · [S](#s) · [T](#t) · [V](#v) · [W](#w) · [X](#x)

---

### A

- **ADR (Adaptive Dominance Regulation)** — Balancing mechanic: if any AI faction exceeds ~2,000 plots (~10% of the map), the others raise aggression to slow it down.
- **AI Lab** — A FRONTIER facility that reduces mining cooldown (−30s / −60s / −90s by level). Generates no FRNTR itself.
- **Algorand** — The Layer-1 blockchain FRONTIERNeXt runs on, using **TestNet** (chainId `416002`).
- **Annihilate** — The Reaper commander's special ability; unlocks Siege Barrage.
- **ARC-3** — The Algorand NFT metadata standard used for each unique **Plot NFT**.
- **ASA (Algorand Standard Asset)** — The on-chain asset type. **FRNTR** is an ASA; each plot is also minted as an ASA (NFT). FRNTR Asset ID: **755818217**.
- **Attack Cooldown** — A lockout after losses: 2 min × consecutive losses; resets on a win/successful defense.
- **Attacker Power** — `(troops × 10) + (iron × 0.5) + (fuel × 0.8) + commanderBonus`, with morale/random modifiers.

### B

- **Base Upgrade** — A one-time Iron/Fuel improvement (Defense, Yield, Mine, Bunker).
- **Biome** — One of 8 terrain types (Desert, Plains, Swamp, Tundra, Forest, Mountain, Volcanic, Water), each with its own yields, defense, and price.
- **Biome Defense Modifier** — A multiplier applied to defender power in battle (e.g. Mountain 1.4×, Water 0.5×).
- **Blockchain Node** — A FRONTIER facility generating passive FRNTR (+2/+3/+4 per day by level).
- **Bunker** — A base upgrade adding +5 influence repair per day.

### C

- **Cascade Defense Penalty** — When a plot is captured, the defender's adjacent plots each lose 1 defense level.
- **Cloak** — The Phantom commander's ability; reduces enemy detection and enables Sabotage / EMP Blast.
- **Collect** — Action that gathers stored resources from all owned plots at once.
- **Commander** — A unique on-chain avatar (Sentinel / Phantom / Reaper) minted by burning FRNTR; boosts combat and unlocks special attacks. Locked 12h after deployment.
- **Consecutive Losses** — A counter driving morale-debuff duration and attack cooldown; resets on any successful defense.
- **Crystal** — A premium resource used for high-level upgrades; richest in Water, Volcanic, and Swamp biomes.

### D

- **Dark Matter** — The rarest mineral; found in Swamp, Water, and Tundra biomes and boosted by orbital impacts. Used for the Orbital Alien Dome and Legendary loot.
- **Data Centre** — A FRONTIER facility boosting resource yield (+5/+10/+15% by level). Generates no FRNTR.
- **Deep Space Probe** — A Launchpad ability: every 24h, reveals all enemy plots within 5 plots for 2 hours.
- **Defender Power** — `(defenseLevel × 15 + improvementBonus) × biomeDefenseMod`.

### E

- **Electricity** — The prerequisite FRONTIER facility (30 FRNTR); +1 FRNTR/day and unlocks all advanced facilities.
- **EMP Blast** — A special attack (Phantom+) that disables all target improvements for 10 minutes.

### F

- **Faction** — One of four autonomous AI powers: NEXUS-7, KRONOS, VANGUARD, SPECTRE.
- **Fibonacci Sphere** — The deterministic distribution that places all 21,000 plots on the globe.
- **Fortify** — The Sentinel commander's ability; hardens the home plot's defense.
- **Fortress** — A high-tier defense improvement (+8 defense, +50 storage).
- **FRONTIER / FRNTR** — The game's token; an Algorand ASA with a fixed 1,000,000,000 supply (6 decimals).
- **Full Control Bonus** — Owning all 9 sub-parcels of a plot grants +50% yield.

### G

- **Gamer Tag** — Your display name on the leaderboard and battle logs, set on first login.
- **Grace Period** — The 6-hour window after capturing an AI plot during which it cannot be reconquered.

### I

- **Influence** — A plot attribute affected by Shield Generators (reduces influence damage) and Bunkers (repair rate).
- **Iron** — A core resource for defense and attacks; richest in Mountain and Volcanic biomes.

### K

- **KRONOS** — The defensive AI faction (aggression 0.6×, defense 1.3×); slow but heavily fortified.

### L

- **Land Sheet** — The plot detail drawer with Mine / Build / Attack / Purchase actions.
- **Landmark** — A unique mega-structure (Launchpad, Orbital Alien Dome, Quantum Forge, Ancient Relay); 1 per player (Dome: 1 per server).
- **Launchpad** — A landmark that halves drone/satellite costs, adds slots, and grants the Deep Space Probe.
- **Loot Box** — A randomized-reward container in four tiers (Common, Rare, Epic, Legendary).
- **LUTE Wallet** — A supported browser-extension Algorand wallet.

### M

- **MemStorage** — The in-memory dev/demo store used when no `DATABASE_URL` is set (non-persistent).
- **Mining** — Transferring a plot's stored resources to your inventory; 5-minute cooldown per plot.
- **Morale Debuff** — A post-loss penalty reducing attack power by 15% (UI shows 25% as a deterrent).

### N

- **NEXUS-7** — The expansionist AI faction (aggression 1.3×); grabs adjacent land aggressively.
- **NFT (Plot NFT)** — Each purchased plot, minted as a unique ARC-3 Algorand ASA (total 1, decimals 0).

### O

- **Opt-In** — The Algorand requirement to register a wallet for an asset before receiving it (FRNTR ASA: 755818217).
- **Orbital Alien Dome** — The server-unique landmark; the Season Nexus that doubles FRNTR in-season.
- **Orbital Event** — A sky phenomenon — cosmetic, a Resource Burst (+50% yield), or a Tile Hazard (−40% yield, −20% defense).
- **Orbital Satellite** — A deployable that grants +25% mining yield on all your plots while active (stacks).

### P

- **Pera Wallet** — A supported mobile + browser Algorand wallet.
- **Pillage** — The 30% of stored resources a winning attacker steals from a captured plot.
- **Plains** — The neutral baseline biome (all modifiers 1.0×).
- **Plasma Core** — A rare mineral (Desert/Swamp, 1.0%); powers orbital ops and siege weaponry.

### Q

- **Quantum Forge** — A landmark for refining minerals and crafting a Legendary loot box every 48h.

### R

- **Radar Array** — A defense improvement reducing incoming attack power by 10%.
- **Rare Minerals** — Xenorite, Void Shard, Plasma Core, Dark Matter; stored in a dedicated 50-per-type vault.
- **Reaper** — The top commander tier (+30% ATK); unlocks Siege Barrage.
- **Reconquest** — An AI faction's attempt to retake a lost plot within the 48h window after the grace period.
- **Richness** — A plot's 1–100 yield-quality rating, fixed at world generation.

### S

- **Sabotage** — A special attack (Phantom+) that halves a target's mining yield for 30 minutes.
- **Season** — A ~90-day meta-cycle in three phases (Expansion, Conflict, Domination) with a reward pool.
- **Sentinel** — The entry commander tier (+10% ATK / +10% DEF); ability Fortify.
- **Shield Generator** — A defense improvement (+5 defense per level, max 2).
- **Siege Barrage** — A Reaper-only special attack hitting up to 3 nearby plots.
- **Sink** — Any action that permanently burns FRNTR (facilities, commanders, drones, satellites, special attacks).
- **SPECTRE** — The economic AI faction; favors high-richness plots and FRNTR accumulation.
- **Storage Depot** — A defense-category improvement adding +200 storage capacity per level.
- **Sub-Parcel** — One of the 9 cells in a plot's 3×3 subdivision; human-only, 4h hold to create.

### T

- **TestNet** — The Algorand test network (chainId 416002) the game runs on; uses free faucet ALGO.
- **Tile Hazard** — A harmful orbital event: −40% yield and −20% battle defense for 8 minutes.
- **Trading** — Peer-to-peer resource exchange (1–10,000 units/order; can't self-trade).
- **Treasury Reserve** — Undistributed FRNTR held by the admin wallet.
- **Turret** — The basic defense improvement (+3 defense per level, max 3).
- **Two-Layer Model** — Instant authoritative DB balances + batched on-chain ASA transfers.

### V

- **VANGUARD** — The raider AI faction (aggression 1.4×, weak defense); ideal early-expansion prey.
- **Void Shard** — A rare mineral (Tundra/Water, 1.5%); required for the Orbital Alien Dome.

### W

- **Water** — The near-uncapturable ocean biome (0.5× battle defense, Crystal 3.0×).
- **Welcome Bonus** — A one-time 500 FRNTR grant on first wallet connection (doubled to 1,000 during the Expansion phase).

### X

- **Xenorite** — A rare mineral (Volcanic/Mountain, 2.0%); used for the Launchpad and Quantum Forge.

---

<div align="center">

<a href="../../README.md"><img src="https://img.shields.io/badge/⟵_Back_to_Docs_Home-0B0E2A?style=for-the-badge" alt="Back to Docs Home"></a>
<a href="GAME_MANUAL.md"><img src="https://img.shields.io/badge/📖_Full_Manual-2D7FF9?style=for-the-badge&labelColor=0B0E2A" alt="Manual"></a>

<sub>🛰️ FRONTIERNeXt · Claim your sky.</sub>

</div>
