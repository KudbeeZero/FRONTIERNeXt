# Faction Economy & Commander Progression — Design / Scope (v0.1)

> **STATUS: DESIGN ONLY — NOTHING HERE IS BUILT.**
> Every number, cost, and interval below is **PROPOSED / untested**. This document
> changes **no** code, schema, funds, or config. Its only job is to decompose a large
> owner-requested program into **small, sequenced, individually-audited PRs**, and to
> mark which units touch funds so they hit the right gates.
>
> **Funds gate (HARD RULE):** no funds / ASA / transfer / wallet code moves toward
> mainnet without a **`/mainnet-gate` PASS** *and* an **`algo-auditor` pass**, plus a
> **`/security-pass`** for any new key custody. See `artifacts/frontier-al/CLAUDE.md`
> and `docs/MAINNET_READINESS_FLOW.md`. The on-chain workstream (WS-E) is explicitly
> **last** and testnet-only first.
>
> Precedent for this kind of code-grounded, no-code spec: `strike-system-design.md`.

## 1. The vision (owner)

1. Each of the 4 AI factions gets its **own Algorand wallet + treasury**, managed
   separately from the single admin wallet.
2. **Faction onboarding** becomes a real flow — players join one of the 4 factions
   (factions are something "people are gonna have to join").
3. **Commander tier progression** — a commander can **advance through tiers**, and
   advancing **changes the card art**.

This is a multi-PR program, not one unit. The wallet/treasury piece is the most
security-sensitive code in the repo. This doc sequences it so each step is small and
auditable, and the risky funds work is isolated behind the gates.

## 2. Current state (code-grounded)

| Area | Today | Evidence |
|---|---|---|
| Factions | 4 game entities: **NEXUS-7, KRONOS, VANGUARD, SPECTRE** (behaviours: expansion/defense/raid/economic) | `server/services/chain/factions.ts:48` |
| Faction on-chain identity | Each has **one identity ASA** (1M supply), minted once at bootstrap, recorded in `ai_faction_identities`. Held under **admin** custody (admin = manager). **No faction wallet/address.** | `ai_faction_identities` `server/db-schema.ts:159`; `bootstrapFactionIdentities` `server/services/chain/factions.ts:193` |
| Key custody | **One** admin wallet (`ALGORAND_ADMIN_MNEMONIC` → one address) signs **everything**: NFT mints, ASCEND transfers/burns, payment receipt, treasury settle, faction ASA mint. **No production wallet-generation pattern** exists (`generateAccount()` only in tests). | `server/services/chain/client.ts:174`; `ENV_VARS.md` |
| Treasury | **Hybrid**: off-chain `treasury_ledger` (fees, `settled` flag) + periodic on-chain `settleTreasury()` that self-transfers accumulated FRONTIER to the **admin** wallet. **No per-faction treasury.** | `treasury_ledger` `server/db-schema.ts:495`; `server/services/chain/treasury.ts` |
| Purchase receiver | All ALGO purchase payments (plot + commander) are verified to land in the **admin** wallet. | `verifyAlgoPayment` `server/services/chain/commander.ts:206`-272 |
| Player ↔ faction | **Already exists, off-chain.** `players.playerFactionId` + `factionJoinedAt`; join/leave routes (48h switch cooldown); `FactionPanel` UI. Players start **unaligned**; faction choice is **not** part of first-run. No on-chain membership proof. | `server/db-schema.ts:228`; `server/routes.ts:1504`; `client/src/components/game/FactionPanel.tsx` |
| Commander "tier" | A **static buy-class**: `sentinel`/`phantom`/`reaper`, fixed stats + price at mint. **No advancement mechanic.** | `CommanderAvatar` `shared/schema.ts:628`; `COMMANDER_INFO` `:641`; prices `shared/economy-config.ts:86` |
| Commander NFT art | **Static per tier** (`/nft/commanders/{tier}.png`). The on-chain ARC-3 metadata **URL is immutable**, **but** that URL resolves to a **server-dynamic** metadata JSON — so the `image` it returns can change **without re-minting**. | metadata endpoint `server/routes.ts:967`-1025; art URL `:1008`; mint `server/services/chain/commander.ts:43` |
| Upgrade pattern to mirror | **Parcel terraforming** — ASCEND cost, state mutation, level counter, pure-ish logic with a MemStorage spec. | `server/storage/terraform.spec.ts` |

## 3. Gap — what's net-new vs. already there

- **Already there (reuse, don't rebuild):** faction entities + identity ASAs; player↔faction
  membership + join/leave + UI; commander mint + dynamic metadata endpoint; treasury ledger +
  settlement; payment verification + replay guard.
- **Net-new:** per-faction **wallets** (4 keypairs) + **custody/funding/opt-in**; per-faction
  **treasury accounting**; routing purchase funds to a faction instead of admin; a **first-run**
  faction-choice step; a commander **progression level** distinct from buy-class; **art that
  varies by progression**.

## 4. Security & HARD-RULE constraints (funds workstream)

Per-faction wallets introduce real custody surface. Risks to design against (all apply to WS-E):

1. **Key custody** — 4 new mnemonics/keys to generate, store, rotate. A leaked faction key
   drains that treasury. Never commit secrets; document in the env checklist; real values in a
   secrets manager (`CLAUDE.md`).
2. **Seed funding & opt-in** — each faction wallet needs min-balance ALGO to opt into ASAs
   (FRONTIER, identity ASA). A dry wallet fails mid-flow.
3. **Settlement atomicity** — if a faction wallet receives ALGO but the DB write fails, funds can
   strand. Mirror the existing replay/idempotency discipline (`redeemed_payments`).
4. **Testnet→mainnet leakage** — faction addresses must never be hardcoded such that testnet
   values reach mainnet. Verify via `/mainnet-gate`.
5. **Rotation / governance** — who can change fee splits, settlement cadence, freeze/clawback?
   Keep admin-controlled until a real governance design exists (avoid scope creep).
6. **Unclaimed balances** — when a player leaves a faction, what happens to attributed value?
   Define before money moves.

**Gate mapping:** WS-A/B/C/D are game/accounting only (no funds) → normal `/pr-gate` + audit.
**WS-E** (any real keypair/funding/settlement) → **`/security-pass` + `/mainnet-gate` +
`algo-auditor`**, testnet-only first; nothing in `ops/kestra/` points at mainnet.

## 5. Workstream decomposition (each = its own small PR)

Ordered **safest → riskiest**. One unit, one PR, audited + merged before the next.

### WS-A — Faction onboarding (game/UI; no funds)
Make faction choice a **first-run step** built on the EXISTING join/leave + `FactionPanel`.
Smallest viable: a post-auth "choose your faction" prompt that calls the existing join route;
optionally surface the 4 factions' identity/lore. No schema change (fields exist). **Gate:** PR-gate.

### WS-B — Commander tier **progression** (math; no chain)
Introduce a progression **level** distinct from the buy-class tier. Pure module
`shared/commanders/progression.ts` (costs + next-level + stat deltas) mirroring `TERRAFORM_COSTS`;
a `storage.advanceCommanderTier(playerId, commanderId)` method (mem + db) and a
`POST /api/actions/advance-commander` route mirroring `mint-avatar`. **ASCEND cost only — no ALGO,
no NFT change.** Pure logic gets a MemStorage spec (terraform precedent). **Gate:** PR-gate + audit.

### WS-C — Commander tier **art** (off-chain; no re-mint)
Drive the dynamic metadata `image` from the commander's progression level
(`/nft/commanders/{tier}_{level}.png`), so advancing changes the art **without** touching the
immutable ASA URL or re-minting. Add the art assets + a fallback to the base tier image.
**No funds, no chain tx.** **Gate:** PR-gate. *(Open question: some marketplaces cache metadata;
note that wallets may need a refresh — acceptable for testnet.)*

### WS-D — Faction treasuries, **OFF-CHAIN first** (accounting; no wallets)
Extend `treasury_ledger` with a nullable `faction_id` and attribute a configurable fee share to
the purchasing player's faction; expose per-faction totals in the admin dashboard. **No new
wallets, no new on-chain movement** — settlement still goes to admin; this is pure accounting that
makes "which faction earned what" visible and proves the model before any real custody. **Gate:**
PR-gate + audit (schema add is additive + reversible; still no funds movement).

### WS-E — Faction **on-chain wallets + settlement** (GATED; the risky one)
Per-faction keypair custody, seed funding, ASA opt-in, and routing purchase funds to a faction
treasury address. This is the only workstream that creates/holds keys and moves money.
**Requires `/security-pass` (custody) + `/mainnet-gate` + `algo-auditor`; testnet-only first.**
Likely itself splits into sub-PRs (custody model → wallet provisioning (testnet) → opt-in/funding
→ receiver routing → settlement). **Do not start without explicit owner go + the gates.**

## 6. Proposed PR sequence

1. **This doc** (design/scope) — no code.
2. **WS-A** faction onboarding step — PR-gate.
3. **WS-B** commander progression math — PR-gate + audit.
4. **WS-C** commander progression art — PR-gate.
5. **WS-D** faction off-chain treasury accounting — PR-gate + audit.
6. **WS-E** faction on-chain wallets — **`/security-pass` + `/mainnet-gate` + `algo-auditor`**,
   testnet-only, multiple sub-PRs.

(Parked, separate lane: the **commander-mint telemetry** instrumentation unit — small, safe — can
slot in anywhere before WS-E as a quick win.)

## 7. Open decisions for the owner

1. **WS-E custody model:** env-var mnemonics (matches today, simplest) vs a KMS/secrets-manager vs
   HD-derivation from the admin seed. *(Recommend: decide at WS-E `/security-pass`, not now.)*
2. **Onboarding:** is choosing a faction **mandatory** at first run, or optional (current behaviour)?
3. **Treasuries:** do faction treasuries ever **pay players out**, or are they protocol-side only?
   (Payouts massively increase custody/attack surface.)
4. **Commander art on advancement:** **off-chain dynamic** (recommended — no re-mint, no funds) vs
   **on-chain re-mint** (burns + re-mints the ASA; funds/chain work → gated).
5. **Faction identity ASA vs membership:** should joining a faction ever transfer/lock a faction
   identity token to the player (on-chain proof), or stay off-chain (`playerFactionId`)?

## 8. Out of scope of this document

No code, no schema/migration, no funds/wallet/treasury/ASA/mint changes, no new deps. Every cost
and interval above is **PROPOSED** and must be set + tested in its own implementing PR. WS-E does
not begin until its own gated PR with explicit owner approval.
