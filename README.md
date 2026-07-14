<!-- ════════════════════════════════════════════════════════════════════ -->
<!--                    F R O N T I E R N e X t                           -->
<!--           Documentation Home · Mission Control · Front Door          -->
<!-- ════════════════════════════════════════════════════════════════════ -->

<div align="center">

```
        .  *       .          .        *      .       .    *      .
   .         ✦         .            .              ✦           .
       ███████╗██████╗  ██████╗ ███╗   ██╗████████╗██╗███████╗██████╗
       ██╔════╝██╔══██╗██╔═══██╗████╗  ██║╚══██╔══╝██║██╔════╝██╔══██╗
       █████╗  ██████╔╝██║   ██║██╔██╗ ██║   ██║   ██║█████╗  ██████╔╝
       ██╔══╝  ██╔══██╗██║   ██║██║╚██╗██║   ██║   ██║██╔══╝  ██╔══██╗
       ██║     ██║  ██║╚██████╔╝██║ ╚████║   ██║   ██║███████╗██║  ██║
       ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝╚══════╝╚═╝  ╚═╝
                          N e X t   ·   v1.5.0
     .        ◍ ─────────────────────────────────────────── ◍       .
   *      .        c l a i m   t h e   f r o n t i e r          ✦   .
        .       *         .            .        *       .      .
```

### 🛰️  A persistent, blockchain-powered strategy frontier on Algorand

*Mine a 21,000-plot living planet · battle four rogue AI factions · mint Commander avatars · earn the **FRONTIER (ASCEND)** token — every plot a real on-chain NFT.*

<br/>

<!-- ── PRIMARY NAV ─────────────────────────────────────────────────── -->
<a href="artifacts/frontier-al/GETTING_STARTED.md"><img src="https://img.shields.io/badge/🚀_Getting_Started-Launch-00E5FF?style=for-the-badge&labelColor=0B0E2A" alt="Getting Started"></a>
<a href="artifacts/frontier-al/GAME_MANUAL.md"><img src="https://img.shields.io/badge/📖_Game_Manual-Read-2D7FF9?style=for-the-badge&labelColor=0B0E2A" alt="Game Manual"></a>
<a href="artifacts/frontier-al/STRATEGY_GUIDE.md"><img src="https://img.shields.io/badge/🎯_Strategy_Guide-Master-2EE6A6?style=for-the-badge&labelColor=0B0E2A" alt="Strategy Guide"></a>
<a href="artifacts/frontier-al/FAQ.md"><img src="https://img.shields.io/badge/❓_FAQ-Help-FFB020?style=for-the-badge&labelColor=0B0E2A" alt="FAQ"></a>
<a href="artifacts/frontier-al/ECONOMICS.md"><img src="https://img.shields.io/badge/💰_Tokenomics-ASCEND-F5C518?style=for-the-badge&labelColor=0B0E2A" alt="Economics"></a>
<a href="artifacts/frontier-al/LORE_CODEX.md"><img src="https://img.shields.io/badge/🌌_Lore_Codex-Explore-B26BFF?style=for-the-badge&labelColor=0B0E2A" alt="Lore Codex"></a>
<a href="artifacts/frontier-al/QUICK_REFERENCE.md"><img src="https://img.shields.io/badge/⚡_Quick_Ref-Cheat_Sheet-FF5DA2?style=for-the-badge&labelColor=0B0E2A" alt="Quick Reference"></a>

<br/><br/>

<img src="https://img.shields.io/badge/Network-Algorand_TestNet-000000?style=flat-square&logo=algorand&logoColor=white" alt="Algorand TestNet">
<img src="https://img.shields.io/badge/Token-ASCEND_·_ASA_764083761-F5C518?style=flat-square" alt="ASCEND ASA">
<img src="https://img.shields.io/badge/World-21,000_Plots-2D7FF9?style=flat-square" alt="21000 plots">
<img src="https://img.shields.io/badge/Factions-NEXUS--7_·_KRONOS_·_VANGUARD_·_SPECTRE-B26BFF?style=flat-square" alt="Factions">
<img src="https://img.shields.io/badge/License-Proprietary-E5484D?style=flat-square" alt="License">
<img src="https://img.shields.io/badge/HEAD-5bb2fac5-0B0E2A?style=flat-square" alt="HEAD SHA">

</div>

---

## 🤖  Agent Onboarding — Orient Any AI in 2 Commands

> **New agent? Paste these two commands. You're fully oriented.**

```bash
# 1. Master README (this file — stack, repo map, all links)
curl https://raw.githubusercontent.com/KudbeeZero/FRONTIERNeXt/main/README.md

# 2. Agent rules (PR conventions, forbidden patterns, test gates)
curl https://raw.githubusercontent.com/KudbeeZero/FRONTIERNeXt/main/CLAUDE.md
```

After reading both, the agent knows:
- Active app path: `artifacts/frontier-al/`
- Current HEAD: `5bb2fac5` on `main`
- Verify gate: `pnpm typecheck && pnpm test && pnpm build` (all must be green before any PR)
- Branch naming: `fix/domain-description` or `feat/domain-description`
- PR body must include: `HANDOFF: [done] → [next] → next branch: [name]`
- **Never** touch `main` directly — always PR

### Multi-Agent Coordination

Multiple agents can work in parallel without colliding:

```
Agent A → fix/routes-auth-domain        (auth router split)
Agent B → fix/routes-game-domain        (game router split)
Agent C → feat/battle-planner-ui        (battle UI)
```

**Rule:** one agent owns one branch. Run `gh pr list` before starting — if your domain has an open PR, wait or coordinate. Never force-push to a branch another agent is using.

### Rate Limit Guard Rails

| Service | Free Limit | Rule |
|---|---|---|
| GitHub Codespaces | 60 core-hrs/mo | `gh codespace stop` when done — every time |
| Gemini 1.5 Flash | 15 req/min free | Batch requests; use for large-file analysis only |
| DeepSeek API | ~$0.14/1M tokens | Browser for quick questions, API for automation loops |
| Fly.io | 3 shared-CPU machines | One staging deploy per PR — not per commit |

---

## 🧠  Memory Layers — Notion Control Center

These pages are the live brain of the project. Always check before starting work.

| Page | What it contains | Link |
|---|---|---|
| 📍 00 — Command Center | HEAD SHA, active PR, security blockers, last verified timestamp | [Open](https://app.notion.com/p/39ca1ce1cf1e817e969dd17ef36942d3) |
| 🚨 20 — Launch Blockers | Full security audit, credential rotation status, rebuild order | [Open](https://app.notion.com/p/39ca1ce1cf1e81c7b4f5d149f0cba039) |
| 📱 70 — iPhone Dev Workflow | Blink Shell + Codespaces + BT keyboard/mouse + DeepSeek/Gemini API | [Open](https://app.notion.com/p/39da1ce1cf1e81d4b357ff5ab651d596) |
| 🌐 80 — Public Wiki & Agent Directory | All public links, player docs, multi-agent rules | [Open](https://app.notion.com/p/39da1ce1cf1e81dcaedcf262a1b2e9c1) |

---

## 🌌  Mission Briefing

> **FRONTIERNeXt** is a persistent globe-based strategy game rendered as a 3D rotating
> planet. You and the AI never stop playing — territory, resources, and structures
> persist around the clock.

- **🪐 One shared world.** A single canonical 21,000-plot planet, distributed across 8 biomes via a Fibonacci sphere — every player and faction fights over the *same* map.
- **⛓️ Real on-chain stakes.** Every plot you buy mints a unique **ARC-3 NFT**; every FRONTIER token you claim is a live Algorand ASA transfer to your wallet.
- **🤖 A world that fights back.** Four autonomous AI factions expand, fortify, raid, and hoard — with Adaptive Dominance Regulation to stop any one power from owning the sky.
- **⚔️ Battles you can watch — and trust.** Every resolution plays as a connected cinematic across the globe (strike → impact → capture), and every outcome is **provably fair**: anyone can independently re-derive the result from a public seed via `/api/battle/:id/proof`.

---

## 🚀  Start Here — Player Docs

Everything a commander needs, from first wallet connection to late-game orbital warfare.

| | Guide | What you'll find |
|---|---|---|
| 🚀 | **[Getting Started](artifacts/frontier-al/GETTING_STARTED.md)** | Five-step launch sequence: connect a wallet, opt in, claim your bonus, plant your first flag → **start here** |
| 📖 | **[Game Manual](artifacts/frontier-al/GAME_MANUAL.md)** | The complete codex — every biome, resource, building, commander, special attack, landmark, and season |
| 🎯 | **[Strategy Guide](artifacts/frontier-al/STRATEGY_GUIDE.md)** | Build orders, faction counter-play, combat math, ROI tables, and scenario playbooks |
| ❓ | **[FAQ & Troubleshooting](artifacts/frontier-al/FAQ.md)** | Opt-in snags, balance mismatches, cooldowns, "where's my NFT?" — answered fast |
| 💰 | **[Economics & Tokenomics](artifacts/frontier-al/ECONOMICS.md)** | ASCEND supply, sinks, emission, treasury, and parcel pricing |

---

## 🌌  Lore & Reference

Go deeper into the universe — or grab the numbers fast.

| | Page | What you'll find |
|---|---|---|
| 🌌 | **[Lore & Universe Codex](artifacts/frontier-al/LORE_CODEX.md)** | The Ascendancy story, faction dossiers, biome lore, commander corps, artifacts, and the sky above |
| ⚡ | **[Quick Reference](artifacts/frontier-al/QUICK_REFERENCE.md)** | One-screen cheat card — every cost, modifier, formula, and cooldown |
| 🪙 | **[ASCEND Tokenomics (one-pager)](artifacts/frontier-al/TOKENOMICS.md)** | The token at a glance — supply, inflows, sinks, treasury |
| 📒 | **[Glossary](artifacts/frontier-al/GLOSSARY.md)** | A–Z of every term, from ADR to Xenorite |
| 🖨️ | **[Printable Field Handbook](artifacts/frontier-al/handbook.html)** | Self-contained HTML — open in a browser → **Print → Save as PDF** |

---

## 🛠️  Builder Docs — Operators & Developers

For anyone deploying, extending, or auditing the frontier.

| | Doc | Purpose |
|---|---|---|
| 💻 | **[Local Development](LOCAL_DEV.md)** | Run it on your desktop: clone → install → Postgres → run → test |
| 🏛️ | **[Architecture](artifacts/frontier-al/ARCHITECTURE.md)** | System design: client, engine, blockchain service layer |
| 🚢 | **[Deployment](artifacts/frontier-al/DEPLOYMENT.md)** | Ship to Fly.io (backend) + Cloudflare Pages (frontend), plus the pre-go-live checklist |
| 🔧 | **[Environment Variables](artifacts/frontier-al/ENV_VARS.md)** | Every config knob and required secret |
| 🧪 | **[Testing Mode](artifacts/frontier-al/TESTING_MODE.md)** | Partner-testing emission rates and switches |
| 🗺️ | **[Roadmap](artifacts/frontier-al/ROADMAP.md)** | The six-phase build-out toward the full release |
| 📦 | **[Game README](artifacts/frontier-al/README.md)** | Deep technical reference: API, DB schema, project structure |
| 📱 | **[iPhone Dev Workflow (Notion)](https://app.notion.com/p/39da1ce1cf1e81d4b357ff5ab651d596)** | Blink + Codespaces + BT keyboard/mouse + DeepSeek/Gemini API |

---

## 🤖  AI Tools for Development

| Tool | Best For | Access |
|---|---|---|
| **Perplexity** | Architecture decisions, HANDOFF review, Notion updates | This chat |
| **Gemini 1.5 Flash** | Large-file analysis (paste entire routes.ts ~205KB) | [aistudio.google.com](https://aistudio.google.com) · API key → `gh secret set GEMINI_API_KEY` |
| **DeepSeek Chat** | Code review, refactor suggestions | [chat.deepseek.com](https://chat.deepseek.com) · API key → `gh secret set DEEPSEEK_API_KEY` |
| **Lightning AI** | Long agent runs (>60 min), GPU tasks | [lightning.ai](https://lightning.ai) |
| **GitHub Copilot** | Inline autocomplete in Codespace editor | Built into VS Code / Codespaces |

---

## 🧭  Repository Map

This is a **pnpm monorepo**. The game lives under `artifacts/frontier-al/`; shared
libraries and infrastructure sit alongside it.

```
FRONTIERNeXt/
├── artifacts/
│   ├── frontier-al/        ◍ THE GAME — full-stack app + all player docs
│   │   ├── README.md            · Game hub & technical reference
│   │   ├── GETTING_STARTED.md    · New-commander quickstart
│   │   ├── GAME_MANUAL.md        · Complete game codex
│   │   ├── STRATEGY_GUIDE.md     · Tactics & playbooks
│   │   ├── FAQ.md                · Troubleshooting
│   │   ├── ECONOMICS.md          · Tokenomics
│   │   ├── LORE_CODEX.md         · World lore & faction dossiers
│   │   ├── QUICK_REFERENCE.md    · One-screen cheat card
│   │   ├── TOKENOMICS.md         · ASCEND one-pager
│   │   ├── GLOSSARY.md           · A–Z terms
│   │   ├── handbook.html         · Printable / PDF field handbook
│   │   ├── client/  server/  shared/   · React · Express · types
│   │   ├── docs/DATA_RECONCILIATION.md · Docs↔code number audit
│   │   └── docs/                 · ADRs, runbooks, audits
│   ├── api-server/         ◍ Shared API infrastructure
│   └── mockup-sandbox/     ◍ Prototyping environment
├── lib/                    ◍ Shared TypeScript packages
│   ├── api-client-react/        · React data hooks
│   ├── api-spec/                · OpenAPI spec + codegen
│   ├── api-zod/                 · Zod validation schemas
│   └── db/                      · Drizzle ORM + Postgres config
├── scripts/                ◍ Build & utility scripts
├── CLAUDE.md               ◍ Agent rules — read this before any PR
├── LOCAL_DEV.md            ◍ Desktop dev setup
└── SESSION_LOG.md          ◍ Agent session continuity log
```

> **New here?** Jump straight to the game → **[`artifacts/frontier-al/`](artifacts/frontier-al/README.md)**.
> **New agent?** Read `CLAUDE.md` first — it has all the rules.

---

<div align="center">

**FRONTIERNeXt** · Proprietary software © KudbeeZero — all rights reserved.

*No part of this software may be used, copied, modified, or distributed without prior written permission.*

<sub>🛰️ Built for the frontier. Claim your sky. · Last updated: 2026-07-14</sub>

</div>
