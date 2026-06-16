<div align="center">

```
   .   ✦      .         *           .          ✦      .       .
       ╔══════════════════════════════════════════════════════╗
   *   ║   🪙  T H E   F R O N T I E R   S T A N D A R D   🪙   ║   .
       ║         ASCEND tokenomics · the one-page brief         ║
       ╚══════════════════════════════════════════════════════╝
   .        *          .              .         *        .
```

# 🪙 ASCEND Tokenomics — One-Pager

**FRONTIERNeXt** · The FRONTIER token at a glance

<a href="../../README.md"><img src="https://img.shields.io/badge/⟵_Docs_Home-0B0E2A?style=for-the-badge" alt="Docs Home"></a>
<a href="ECONOMICS.md"><img src="https://img.shields.io/badge/📊_Full_Economics-Deep_Dive-F5C518?style=for-the-badge&labelColor=0B0E2A" alt="Economics"></a>
<a href="QUICK_REFERENCE.md"><img src="https://img.shields.io/badge/⚡_Quick_Ref-FF5DA2?style=for-the-badge&labelColor=0B0E2A" alt="Quick Reference"></a>

</div>

> The fast brief. For the full financial model — sub-parcel 70/30 fee splits, the
> protocol treasury, settlement, and the `/api/economics` schema — see
> **[ECONOMICS.md](ECONOMICS.md)**. Every figure here is verified against
> `shared/schema.ts` and `shared/economy-config.ts`.

---

## 🪐 The Asset

| Property | Value |
|---|---|
| **Name / Symbol** | FRONTIER / **ASCEND** |
| **Chain** | Algorand TestNet (chainId `416002`) |
| **Standard** | Algorand Standard Asset (ASA) · ID `755818217` |
| **Total Supply** | **1,000,000,000** ASCEND — fixed & immutable |
| **Decimals** | 6 (1 ASCEND = 1,000,000 microASCEND) |
| **Custody** | Two-layer: instant DB balance + batched on-chain transfers |

> **Two-layer model:** the in-game **database balance is authoritative** for all
> gameplay and updates instantly; **on-chain** ASA transfers settle in batches and
> may briefly lag. Trust the in-game balance for spending.

---

## 📈 Where ASCEND Comes From (Inflows)

| Source | Rate |
|---|---|
| Base plot ownership | **1 ASCEND/day** per plot (production) |
| + Electricity facility | +1 / day |
| + Blockchain Node L1 / L2 / L3 | +2 / +3 / +4 / day |
| **Max per fully-upgraded plot** | **6 ASCEND/day** |
| Welcome bonus | **500 ASCEND** one-time (×2 → 1,000 during Expansion season) |
| Sub-parcel income | Macro-plot owner earns **70%** of every sub-parcel sale |

> **Testing mode** intentionally boosts base emission to **50 ASCEND/day** per plot for
> partner testing. Data Centre and AI Lab produce **0 ASCEND** — they give yield % and
> cooldown reductions instead.

---

## 🔥 Where ASCEND Goes (Sinks)

Every sink permanently burns ASCEND from circulation — the deflationary heartbeat.

| Sink | Cost |
|---|---|
| Electricity facility | 30 |
| Blockchain Node / Data Centre / AI Lab (L1–L3) | 120 / 270 / 480 |
| Commander — Sentinel / Phantom / Reaper | 50 / 150 / 400 |
| Special attacks (Orbital Strike → Sabotage) | 10 – 40 |
| Recon drone | 20 · Orbital satellite | 50 |
| Sub-parcel purchase | 10 – 100 (30% → protocol treasury) |
| Landmarks | 400 – 800 + rare minerals |

---

## 🏦 Supply Accounting

The live ledger (`GET /api/economics`) tracks four pools:

```
                    ┌──────────────────────────────────────────┐
  MAX SUPPLY        │■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■│  1,000,000,000
  (immutable ASA)   └──────────────────────────────────────────┘
                          │              │              │
            ┌─────────────┘     ┌────────┘      ┌───────┘
            ▼                   ▼               ▼
     ┌────────────┐     ┌──────────────┐  ┌──────────────┐
     │ TREASURY   │     │ IN           │  │ BURNED       │
     │ RESERVE    │     │ CIRCULATION  │  │ (permanent)  │
     │ admin held │     │ player held  │  │ spent sinks  │
     └────────────┘     └──────────────┘  └──────────────┘
```

| Pool | Meaning |
|---|---|
| **Max Supply** | The on-chain ASA `total` — 1B, never changes |
| **Treasury Reserve** | Undistributed ASCEND held by the admin wallet |
| **In Circulation** | Tokens actively held by all players (DB `frntr_balance_micro`) |
| **Burned** | Permanently spent in-game on the sinks above |

---

## 🏛️ Protocol Treasury (The Central Bank)

Sub-parcel fees feed a protocol treasury via a **70 / 30 split** — 70% to the
macro-plot owner, 30% to the treasury (100% to treasury if the plot is unowned).
Fees are tracked instantly in a `treasury_ledger` table and settled on-chain every
**24 hours** (or immediately once unsettled balance passes **1,000 ASCEND**).

→ Full mechanics, examples, and the ledger schema in **[ECONOMICS.md](ECONOMICS.md)**.

---

## 🎯 The Player's Money Loop

1. **Own a plot** → earn 1 ASCEND/day base.
2. **Build Electricity → Blockchain Node L3** → push the plot to 6 ASCEND/day.
3. **Hold 4 hours → subdivide** into 9 sub-parcels.
4. **Others buy your sub-parcels** → you keep 70% of every sale.
5. **Own all 9 yourself** → **+50% yield** on the whole plot.
6. **Burn surplus** on commanders, facilities, and attacks to expand your empire.

---

<div align="center">

<a href="ECONOMICS.md"><img src="https://img.shields.io/badge/📊_Full_Economics_Model-F5C518?style=for-the-badge&labelColor=0B0E2A" alt="Economics"></a>
<a href="../../README.md"><img src="https://img.shields.io/badge/⟵_Back_to_Docs_Home-0B0E2A?style=for-the-badge" alt="Back to Docs Home"></a>

<sub>🛰️ FRONTIERNeXt · Claim your sky.</sub>

</div>
