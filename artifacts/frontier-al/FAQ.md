<div align="center">

```
   .     ✦        .          *          .       .      *        .
        ◍ ── M I S S I O N   S U P P O R T ──────────────────── ◍
   *  .      Answers from the frontier control room         ✦   .
        .         *            .             .        *        .
```

# ❓ FAQ & Troubleshooting

**FRONTIERNeXt** · Commander support

<a href="../../README.md"><img src="https://img.shields.io/badge/⟵_Docs_Home-0B0E2A?style=for-the-badge" alt="Docs Home"></a>
<a href="GETTING_STARTED.md"><img src="https://img.shields.io/badge/🚀_Getting_Started-00E5FF?style=for-the-badge&labelColor=0B0E2A" alt="Getting Started"></a>
<a href="GAME_MANUAL.md"><img src="https://img.shields.io/badge/📖_Manual-2D7FF9?style=for-the-badge&labelColor=0B0E2A" alt="Manual"></a>
<a href="STRATEGY_GUIDE.md"><img src="https://img.shields.io/badge/🎯_Strategy-2EE6A6?style=for-the-badge&labelColor=0B0E2A" alt="Strategy"></a>

</div>

---

Quick answers to the questions new commanders hit most. Each answer points to the
relevant **[Game Manual](GAME_MANUAL.md)** chapter for the full story.

---

## 👛 Wallet & Token Opt-In

<details>
<summary><b>Which wallets are supported?</b></summary>

<br/>

**Pera Wallet** (mobile + browser) and **LUTE Wallet** (browser extension). Both
must be set to **Algorand TestNet** — not MainNet. See **[Getting Started, Step 1](GETTING_STARTED.md)**.

</details>

<details>
<summary><b>Where do I get ALGO to play?</b></summary>

<br/>

It's free on TestNet. Fund your wallet at the
[Algorand TestNet Faucet](https://bank.testnet.algorand.network/). You'll need a
little ALGO for plot purchases and to cover wallet minimum balances.

</details>

<details>
<summary><b>I claimed ASCEND but it isn't in my wallet. Why?</b></summary>

<br/>

You almost certainly haven't **opted in** to the FRONTIER asset yet. Algorand
requires every wallet to explicitly opt in before it can receive an asset.

1. Open your wallet → search Asset ID **`764083761`** (FRONTIER / ASCEND).
2. Tap **Opt In** and confirm (~0.1 ALGO minimum balance hold).
3. Your queued ASCEND transfer will then settle on-chain.

Full walkthrough: **[Getting Started, Step 2](GETTING_STARTED.md)**.

</details>

---

## 💰 Balances & ASCEND

<details>
<summary><b>My in-game ASCEND balance doesn't match my wallet balance — is something broken?</b></summary>

<br/>

No — this is by design. FRONTIERNeXt uses a **two-layer model**:

| Layer | Speed | Role |
|-------|-------|------|
| **In-game (database)** | Instant | The authoritative balance for everything you spend in-game |
| **On-chain (Algorand ASA)** | Batched | Real token transfers, sent in atomic groups of up to 16 — may lag by a batch cycle |

Always trust your **in-game balance** for buying facilities, commanders, and attacks.
The on-chain balance catches up shortly after. More in **[Game Manual, Ch. 6 — FRONTIER Token Economy](GAME_MANUAL.md)**.

</details>

<details>
<summary><b>How much ASCEND do I earn per day?</b></summary>

<br/>

Each owned plot generates **1 ASCEND/day** at base, plus facility bonuses (Electricity
+1, Blockchain Node up to +4 at Lv3). A fully upgraded plot tops out at **6 ASCEND/day**.

> During partner **testing mode**, emission is intentionally boosted to **50 ASCEND/day**
> per plot. See **[Testing Mode](TESTING_MODE.md)**.

</details>

<details>
<summary><b>What can I spend ASCEND on, and is it gone forever?</b></summary>

<br/>

ASCEND is **burned** (permanently removed from your balance) when you build FRONTIER
facilities, mint Commanders, deploy drones/satellites, or fire special attacks. These
are the token's sinks — see **[Economics](ECONOMICS.md)** for the full table.

</details>

---

## ⚔️ Combat, Cooldowns & Morale

<details>
<summary><b>Why can't I attack right now?</b></summary>

<br/>

You likely have an active **attack cooldown** or **morale debuff** from recent losses.
Consecutive defeats stack penalties:

- **Morale debuff:** 5 min × consecutive losses (−15% attack power)
- **Attack cooldown:** 2 min × consecutive losses

Both **reset the moment you win**. Don't throw good troops after bad — regroup,
scout, and strike a weaker target. See **[Game Manual, Ch. 15 — Morale & Cooldowns](GAME_MANUAL.md)**.

</details>

<details>
<summary><b>How long does a battle take?</b></summary>

<br/>

Every attack resolves automatically **10 minutes** after you launch it. Watch it
live in the **Battles tab**. Combat math is in **[Game Manual, Ch. 14 — Combat System](GAME_MANUAL.md)**.

</details>

<details>
<summary><b>Why can't I capture that blue Water plot?</b></summary>

<br/>

**Water plots are uncapturable by anyone** — players and AI alike. They also yield
minimal resources, so they're never worth buying. Stick to land biomes.

</details>

<details>
<summary><b>Is combat fair? Can I trust the outcome?</b></summary>

<br/>

Yes — and you don't have to take our word for it. Battle outcomes are **provably fair**.
Each battle's random swing (the `randFactor`) is derived deterministically from a
**public seed** (the battle's id + start time), and resolution is fully deterministic.
So **anyone can independently re-run the exact resolver on the public inputs and confirm
the recorded result** — the server can't fudge a winner after the fact.

You can fetch the proof yourself at `GET /api/battle/<battleId>/proof`; it returns the
seed, the re-derived `randFactor` + outcome, a reproducible hash, and `valid: true`. An
automated fairness checker (veritas) verifies live battles on a loop.

</details>

<details>
<summary><b>What's all the motion when a battle resolves? Can I turn it off?</b></summary>

<br/>

That's the **Battle Theater** — a connected cinematic: an incoming-attack telegraph on
the target, a strike arcing across the globe, an impact + capture burst in the attacker's
faction colour, and a HUD callout narrating it. It honours your OS **reduced-motion**
setting, and there's a **Battle Cinematics** toggle in globe settings. Two extras are
**off by default** there: **Cinematic Camera** (gently follows your own battles) and
**Battle Sound** (synth cues).

</details>

---

## 🪐 Map, Plots & NFTs

<details>
<summary><b>How do I read the map colors?</b></summary>

<br/>

| Color | Meaning |
|-------|---------|
| Green / yellow / grey / orange shades | Biome type (Forest, Desert/Plains, Tundra/Mountain, Volcanic…) |
| **Bright blue outline** | Your owned plots |
| **Red outline** | Enemy plots adjacent to yours |
| **Pulsing yellow** | An active orbital event affecting that plot |

Full legend in **[Game Manual, Ch. 2 — The World Map](GAME_MANUAL.md)**.

</details>

<details>
<summary><b>Where is my Plot NFT?</b></summary>

<br/>

Every plot you buy is minted as a unique **ARC-3 NFT** (total = 1, decimals = 0) to
your wallet address on Algorand TestNet.

- Find its asset ID: `GET /api/nft/plot/:plotId`
- View it in the [Pera Explorer](https://testnet.explorer.perawallet.app/)
- To hold the NFT in your wallet, opt in to that asset ID and the admin wallet
  transfers it once opt-in is confirmed.

</details>

<details>
<summary><b>Who are NEXUS-7, KRONOS, VANGUARD, and SPECTRE?</b></summary>

<br/>

The four autonomous **AI factions** that share your world and never stop playing:

| Faction | Color | Personality |
|---------|-------|-------------|
| **NEXUS-7** | Blue | Expansionist — grabs adjacent land relentlessly |
| **KRONOS** | Purple | Defensive — fortress-builder, slow to attack |
| **VANGUARD** | Red | Raider — weak defense, hits soft targets (great early prey) |
| **SPECTRE** | Green | Economic — hoards high-value, ASCEND-rich plots |

Counter-strategies for each are in the **[Strategy Guide](STRATEGY_GUIDE.md)**.

</details>

---

## 🛟 Still stuck?

| | Resource | For |
|---|---|---|
| 🚀 | **[Getting Started](GETTING_STARTED.md)** | The step-by-step launch sequence |
| 📖 | **[Game Manual](GAME_MANUAL.md)** | The complete reference for every system |
| 🎯 | **[Strategy Guide](STRATEGY_GUIDE.md)** | Tactics, build orders, and faction counter-play |
| ⚡ | **[Quick Reference](QUICK_REFERENCE.md)** | Fast lookup for every cost, modifier, and formula |
| 🌌 | **[Lore & Universe Codex](LORE_CODEX.md)** | The story and factions behind the frontier |
| 💰 | **[Economics](ECONOMICS.md)** | ASCEND supply, sinks, and pricing |

---

<div align="center">

<a href="../../README.md"><img src="https://img.shields.io/badge/⟵_Back_to_Docs_Home-0B0E2A?style=for-the-badge" alt="Back to Docs Home"></a>

<sub>🛰️ FRONTIERNeXt · Claim your sky.</sub>

</div>
