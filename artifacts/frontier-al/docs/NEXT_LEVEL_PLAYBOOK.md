# FRONTIER-AL — Next-Level Architecture & Development Playbook

> **Authored by Claude Fable 5 (2026-07-05) for execution by Sonnet-class agents.**
> This is the standing plan for taking the game from "working TestNet strategy game"
> to "the game people talk about." It is written so that any future session can pick
> one unit, execute it without re-deriving context, and land it as one reviewed PR.

---

## 0. How to use this document (read this first, every session)

1. Read [`docs/HANDOFF.md`](../../../docs/HANDOFF.md) (the baton). It names the active unit.
   This playbook is the **backlog**; the baton is the **pointer**. Baton wins on "what's next."
2. Follow the chat loop in root [`CLAUDE.md`](../../../CLAUDE.md): audit the previous PR
   (`/handoff-audit`), do **exactly one unit** from this playbook on this chat's branch,
   close out with one PR (`/closeout`).
3. Each unit below has: **Goal · Files · Steps · Done-when · Risk**. Do not exceed the unit's
   file scope without flagging it in the PR as scope creep with a reason.
4. If a unit conflicts with reality (file moved, API changed), trust the code, fix the
   playbook **in the same PR**, and note it. This document must never rot silently.
5. Never mark a unit "validated" without the test evidence named in its **Done-when**.

**Verification commands (run from repo root; all must be green before any PR):**

```bash
pnpm --filter @workspace/frontier-al run check         # tsc
pnpm --filter @workspace/frontier-al run test:server   # 415+ tests
pnpm --filter @workspace/frontier-al run test          # 213+ client tests
pnpm --filter @workspace/frontier-al run build         # vite + esbuild
```

---

## 1. Architecture as-is (the map — verified 2026-07-05)

```
artifacts/frontier-al/
├── client/src/
│   ├── components/game/
│   │   ├── globe/**            ◍ 3D planet (three.js) — 21,000 plots, 8 biomes. LIVE,
│   │   │                         server-data-driven. HARD RULE: no behavior changes
│   │   │                         outside a scoped, audited unit.
│   │   ├── GameLayout.tsx      god-component shell (1441 lines, 20+ useState) — mounts
│   │   │                         globe, wires WS, hosts ~17 panels + dashboard v2 toggle
│   │   ├── commander/*         CommanderPanel subcomponents (extracted 2026-07-05)
│   │   ├── land/*              LandSheet subcomponents (extracted 2026-07-05)
│   │   └── dashboard/*         widget dashboard v2 (dnd grid, resizable)
│   ├── lib/                    algorand.ts (wallet txns), attackIcons, testnetMissions,
│   │                             devSession, serverClock, dashboard/layout
│   └── contexts/WalletContext.tsx   Pera/Defly/Lute via @txnlab/use-wallet-react
├── server/
│   ├── routes.ts               ~130 handlers, 4,200 lines — SPLIT TARGET (Phase D)
│   ├── security.ts             ✅ centralized: rate limiters, wallet predicates,
│   │                             admin checks, NFT-delivery claim evaluation
│   ├── auth.ts · rateLimitStore.ts · idempotencyGuard.ts · routeOwnership.ts · stateScope.ts
│   ├── engine/{ai,battle,markets,narrative,season}   deterministic game math (COVERAGE-GATED ≥80%)
│   ├── storage/
│   │   ├── db.ts (3,541)       DbStorage — Postgres/Drizzle, real deployment
│   │   ├── mem.ts (1,595)      MemStorage — dev/test twin. ⚠ PARITY TRAP: game methods are
│   │   │                         duplicated by design; NEVER "unify" them (survey verdict).
│   │   └── game-rules.ts       pure shared helpers — the only sanctioned shared home
│   ├── services/chain/         Algorand: client.ts (env/network), land.ts, commander.ts,
│   │                             weapon.ts, delivery.ts (shared), asa.ts (ASCEND),
│   │                             upgrades.ts (sub-parcel notes), factions.ts, eligibility.ts,
│   │                             transferQueue.ts (Postgres retry queue)
│   └── veritas/                provable-fairness grind
├── shared/                     schema.ts (1,206 lines, 152 exports — barrel-split target),
│                                 economy-config.ts, weapon-economy.ts, weapons/*, orbitalEngine.ts
├── migrations/                 Drizzle 0000–0011
└── script/                     build.ts, mint-golden-plot.ts, testnet-nft-smoke.ts
```

**On-chain model (TestNet, ASA `764083761` = ASCEND):** single admin/custodian wallet
signs everything. NFTs = 1-of-1 ARC-3 ASAs for **plots** (`PLOT`), **commanders** (`CMDR`),
**weapons** (`WPN`); custody-then-deliver (buyer opts in → transfer). **Sub-plots have no
NFT by design** — anchored via 0-ALGO note txns (`recordUpgradeOnChain`). Faction identity
ASAs bootstrapped at world init. ASCEND transfers go through a batched atomic-group queue
with Postgres retry.

**Known chain gaps (from `docs/audit/chain-services-audit.md`):**
- Live ASCEND ASA `764083761` has **no clawback address** (immutable) → `clawbackAscendAsa`
  fails against it; in-game ASCEND spends rely on off-chain accounting.
- `recordUpgradeOnChain` under algosdk v3 is **unverified live** (`smoke:testnet` settles it).
- One admin key = mint + treasury + custodian. Fine for TestNet; **must** split before mainnet.

**Invariants that gate everything (HARD RULES — absolute):**
- No funds/ASA/transfer code toward mainnet without `/mainnet-gate` PASS **and** `algo-auditor` pass.
- Never merge `wip/atomic-purchase`; nothing in `ops/kestra/` points at mainnet.
- No mock/demo data in plot/HUD surfaces. No globe/combat behavior drift outside audited units.
- No fix without a test (fails before, passes after). Coverage gate: game-math core ≥80% lines.
- `mem.ts`/`db.ts` game methods stay parallel; shared logic goes only into pure helpers in
  `game-rules.ts` that **both** import.

---

## 2. What "next level" means (the thesis)

The engine, economy, chain layer, and security posture are solid and test-backed. What
separates this from a great game is now concentrated in four places:

1. **The first five minutes.** A new player must feel the stakes (real NFTs, live AI
   factions) within one session without reading docs.
2. **A world that visibly fights back.** The AI factions act, but the *globe* barely shows
   it. Combat resolves in toasts, not spectacle.
3. **Ownership that feels owned.** NFTs exist but the claim/custody flow is buried; plots
   don't visibly evolve with their on-chain history.
4. **An economy with a destination.** ASCEND accrues but has few sinks and no player-to-
   player surface; seasons need arcs with endings.

Each phase below attacks one of these. Units are sized for **one chat = one PR**.
Order within a phase matters; phases can interleave when the owner reprioritizes.

---

## 3. Phase A — First Five Minutes (player onboarding & clarity)

### A1. Onboarding quest chain ("First Command")
- **Goal:** A guided 6-step quest for new players: pick faction → claim starter plot →
  mine once → build one improvement → deploy a drone → face a scripted micro-raid.
  Each step grants small ASCEND (off-chain ledger, existing welcome-bonus rails).
- **Files:** new `server/engine/narrative/onboarding.ts` (+spec); quest state on player row
  (migration 0012); client `components/game/OnboardingQuest.tsx` mounted from GameLayout's
  existing panel rails; reuse `ObjectiveHud.tsx` patterns.
- **Steps:** define quest graph as data (id, trigger, reward, copy) → server evaluates
  transitions on existing action endpoints (no new game verbs) → client renders current
  step + pulse-highlights the relevant HUD button (`data-testid` anchors already exist).
- **Done-when:** server spec covers every transition incl. replay-safety (idempotent step
  completion); client test renders each step; manual owner smoke on preview.
- **Risk:** LOW. Touches no combat/economy math; rewards go through existing bonus path
  with its Sybil gate (`eligibility.ts`).

### A2. Objective HUD real lose-detection (carried from baton)
- **Goal:** `evaluateObjective` gets the player's real territory count (currently
  hardcoded `1`), enabling genuine win/lose pressure in the mission HUD.
- **Files:** `server/routes.ts` (`/api/factions` handler), `shared` battleObjective types,
  `client/src/components/game/ObjectiveHud.tsx`.
- **Done-when:** unit test: player with 0 plots ⇒ lose state; N plots ⇒ correct thresholds.
- **Risk:** LOW.

### A3. Cinematic taste pass on the intro
- **Goal:** Retune `IntroCinematic.tsx` pacing/copy (owner has notes); optional globe
  fly-in variant behind a flag.
- **Done-when:** build + client tests green; owner approves on preview. **Client-only.**
- **Risk:** LOW.

---

## 4. Phase B — A World That Fights Back (spectacle & liveness)

### B1. Weapons Unit 3 — engagement cinematics (carried from baton)
- **Goal:** A fired weapon draws an arc/impact on the globe, driven by the existing
  `weapon_engagement` WebSocket event (today: toast only).
- **Files:** new `client/src/components/game/globe/WeaponArcLayer.tsx` (additive layer —
  do NOT modify existing globe files beyond mounting the layer); listen on the existing
  WS client; shared types already carry the event.
- **Done-when:** unit test for the arc math (pure function: origin/target latlng → bezier
  frames); layer mounts behind a flag first; owner verifies on preview, then flag removed
  in a follow-up unit.
- **Risk:** MEDIUM (globe-adjacent — additive only, audited; this is the sanctioned "scoped
  unit" the HARD RULE contemplates).

### B2. Weapons Unit 2 — defensive DEPLOY UI (carried from baton)
- **Goal:** UI to place defensive weapons on owned plots (server API exists in
  `routes.ts` weapons block ~2502–2743).
- **Files:** client only: extend `land/` panel with a deploy tab; reuse LandSheet patterns.
- **Done-when:** client tests for the deploy form logic; server untouched.
- **Risk:** LOW.

### B3. Faction war-front visualization
- **Goal:** Render faction influence as animated biome-edge glows so AI expansion is
  visible at a glance (server already tracks per-faction ownership).
- **Files:** additive globe layer (same pattern as B1); data from existing `/api/factions`.
- **Done-when:** pure-function tests for boundary extraction from parcel ownership; flag-
  gated first render.
- **Risk:** MEDIUM (globe-adjacent, additive).

### B4. AI faction "operations" — telegraphed offensives
- **Goal:** Factions periodically declare a named operation (e.g. "KRONOS ignites the
  Ashlands") with a 24h countdown, target region, and stakes — turning random AI turns
  into events players can rally against. Builds on `factionVoice.ts` + narrative engine.
- **Files:** `server/engine/ai/` (operation scheduler + spec), `engine/narrative/`,
  event over existing WS, client banner component.
- **Done-when:** deterministic spec (seeded RNG — follow `rng` test patterns); operations
  respect existing attack cooldowns; no change to battle resolution math itself.
- **Risk:** MEDIUM — touches AI turn flow; the battle engine itself must remain untouched.

---

## 5. Phase C — Ownership That Feels Owned (on-chain depth)

> ⚠ Everything in this phase that moves funds/ASA config toward mainnet is GATED
> (`/mainnet-gate` PASS + `algo-auditor`). On TestNet, iterate freely but keep the gates
> in sight — build mainnet-shaped from day one.

### C1. Run + institutionalize the TestNet NFT smoke test
- **Goal:** `pnpm run smoke:testnet` executed against a funded wallet; results (asset IDs,
  Lora links) recorded in `docs/TESTNET_AUDIT.md`; settles the `recordUpgradeOnChain`
  algosdk-v3 question. If it fails: fix + regression test (that's the unit).
- **Done-when:** four green flows on-chain, doc updated, any fix test-backed.
- **Risk:** LOW (TestNet-only, fail-closed script).

### C2. NFT vault — one surface for everything you own
- **Goal:** A single "Vault" panel listing all player NFTs (plots/commanders/weapons) with
  custody state, one-click opt-in + claim (client `lib/algorand.ts` already builds opt-in
  txns), and Lora/allo.info links. Kills the scattered claim-nag UX.
- **Files:** client `components/game/VaultPanel.tsx` + a consolidated server endpoint
  `GET /api/nft/inventory/:playerId` (read-only aggregation of existing tables).
- **Done-when:** server spec for the aggregation; client tests for custody-state rendering;
  no new mint/transfer code paths.
- **Risk:** LOW-MEDIUM (reads only; delivery uses existing `delivery.ts`).

### C3. ARC-19 upgrade path for evolving NFTs (design + TestNet spike)
- **Goal:** Plots/commanders that visibly evolve: move new mints to ARC-3+ARC-19 (mutable
  metadata via template-ipfs reserve address) so a plot's NFT reflects its level/biome/
  battle scars. Existing mints stay ARC-3 (immutable — document the split).
- **Files:** `server/services/chain/` (new `arc19.ts` + spec, mint param plumbing);
  ADR in `docs/` weighing pinning infra (IPFS provider) — **owner decision checkpoint**.
- **Done-when:** TestNet spike mints an ARC-19 asset and updates its metadata once, proven
  via indexer read; ADR merged. NOT wired into purchase flow yet (that's C4).
- **Risk:** MEDIUM (new chain code, TestNet-only; gated before any mainnet shape).

### C4. Wire ARC-19 into new mints + metadata refresh worker
- **Goal:** New plot/commander mints use ARC-19; a worker refreshes metadata on level-up
  (batched, rate-limited, fire-and-forget like `upgrades.ts`).
- **Prereq:** C3 merged + owner ADR sign-off.
- **Risk:** MEDIUM-HIGH. Full `algo-auditor` pass required before merge.

### C5. Waitlist reward payout (🛑 GATED — LAST in this phase)
- **Goal:** The deliberately-unbuilt on-chain ASCEND/NFT payout for waitlist tiers.
- **Prereq:** `/mainnet-gate` PASS + `algo-auditor` pass. Do not start without both.

---

## 6. Phase D — An Economy With a Destination + Scale

### D1. Player-to-player plot marketplace (escrow-shaped, TestNet)
- **Goal:** List/browse/buy owned plots for ASCEND. Server-mediated escrow using the
  custodian model already proven by the purchase flow (buyer pays → custody transfer →
  NFT delivery via `delivery.ts`). No new trust assumptions.
- **Files:** `server/engine/markets/` extension + spec; migration for listings table;
  client marketplace panel; idempotency via existing `withIdempotency`.
- **Done-when:** full spec coverage of list/delist/buy incl. replay + double-spend attempts
  (follow `idempotencyGuard.spec.ts` patterns); economy math reviewed against
  `shared/economy-config.ts` sinks.
- **Risk:** MEDIUM-HIGH (economy-adjacent). Needs `/security-pass` before merge.

### D2. Season arcs with endings
- **Goal:** `engine/season/` gets a defined arc: escalation weeks → climax event →
  scored ending → archive + reset ceremony (NFTs persist; territory resets).
- **Done-when:** deterministic season-transition spec; owner-approved arc copy.
- **Risk:** MEDIUM.

### D3–D6. The structural splits (mechanical, one per chat)
Sequenced so each is a pure move with tests green:
- **D3.** `routes.ts` → domain routers (`server/routes/{auth,nft,factions,actions,weapons,
  trade,markets,subparcels,admin}.ts`) — the seams and line ranges are documented in the
  2026-07-05 survey (session note). Keep shared closures (`assertPlayerOwnership`,
  `maybeGrantWelcomeBonus`) in a `routes/context.ts`.
- **D4.** `storage/db.ts` → domain modules (orbital/trade/sub-parcels/treasury/season/
  markets) — leave combat + economy methods in place.
- **D5.** `shared/schema.ts` → split with a re-export barrel at the old path (zero import
  churn), constants separated from types from zod schemas.
- **D6.** `GameLayout.tsx` decomposition — **coordinate with the dashboard v2 widget
  migration** (baton: ~17 panels to widgets); don't do both in one unit.

### D7. Observability before mainnet
- **Goal:** Structured logging (pino or console-JSON), request IDs, chain-txn audit log
  surfaced in an admin panel, `/healthz` with chain + DB probes (Kestra flows in
  `ops/kestra/` already poll uptime — never point them at mainnet).
- **Risk:** LOW-MEDIUM.

---

## 7. Mainnet path (the gate sequence — do not reorder)

1. All Phase C TestNet flows proven live (C1) + admin key split (mint vs treasury vs
   custodian — new env vars, documented in `ENV_VARS.md` + deployment checklist).
2. New ASCEND mainnet ASA **with clawback configured correctly from creation** (the
   TestNet ASA's missing clawback is unfixable — do not repeat).
3. `/test-matrix` refresh → `/security-pass` on the full chain surface → `/mainnet-gate`
   PASS → `algo-auditor` pass → owner go.
4. Rotate the TestNet admin wallet (documented as compromised-by-convention: address is
   public in docs, mnemonic has passed through host dashboards).

---

## 8. Tooling adoptions (cheap wins, any time)

- **VibeKit / Algorand agent skills** (see `docs/ALGORAND_TOOLING_2026.md`): add the Kapa
  docs MCP (`https://algorand-docs.mcp.kapa.ai/`) to `.mcp.json`; consider
  `algorand-devrel/algorand-agent-skills` for chain-work sessions.
- **`@algorandfoundation/algokit-utils` 9.2.0** (NOT the v10 beta): adopt opportunistically
  when touching `services/chain/client.ts` — simplifies confirmation-waiting and client
  construction. Respect the workspace `minimumReleaseAge` guard.
- **Nodely endpoints**: if `algonode.cloud` defaults ever degrade, flip `ALGOD_URL`/
  `INDEXER_URL` to `https://testnet-api.4160.nodely.dev` / `testnet-idx.4160.nodely.dev`
  (env-only, no code).

---

## 9. Unit template (copy into the PR body)

```md
## Unit: <playbook id + name>
**Goal:** <one sentence>
**Scope (files):** <list — anything beyond this is flagged scope creep>
**Test evidence:** <spec names + counts, fails-before/passes-after for fixes>
**Honest gaps:** <what is NOT verified (browser/on-chain/device)>
**Gates:** <none | /security-pass | /mainnet-gate + algo-auditor>
## Audit checklist
- [ ] Scope matches diff  - [ ] Claims → file:line  - [ ] CI green on head
- [ ] HARD RULES untouched  - [ ] Playbook updated if reality diverged
```

**Definition of done, always:** tsc + server + client + build green · one PR · baton
rewritten · dated session note · no `[skip ci]` on the final commit.
