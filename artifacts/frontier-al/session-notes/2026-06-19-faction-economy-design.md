# 2026-06-19 — Faction economy & commander progression: design/scope doc

## Unit
Doc-only. The owner asked to "start building out" a large program — per-faction Algorand
wallets + treasuries, faction onboarding, and commander tier progression with changing card
art. Because the wallet/treasury part is funds/ASA/key-custody code (HARD-RULE gated:
`/mainnet-gate` + `algo-auditor` + `/security-pass`) and far too large for one safe PR, the
owner chose (AskUserQuestion) to **start with a design/scope doc only — no code** — that
decomposes the vision into sequenced, individually-gated units. Precedent:
`docs/design/strike-system-design.md`.

## What shipped (docs only)
- **`docs/design/faction-economy-and-commander-progression-design.md`** (NEW) — code-grounded
  (file:line cites from two read-only audits). Captures: current state (factions already have
  identity ASAs but no wallets/treasury; single admin-mnemonic custody; hybrid treasury ledger;
  player↔faction membership ALREADY exists off-chain; commander tier is a static buy-class;
  commander art can change off-chain via the dynamic metadata endpoint without re-mint); the
  net-new vs. exists gap; security/custody risks; a 5-workstream decomposition ordered safest→
  riskiest (WS-A onboarding · WS-B progression math · WS-C progression art · WS-D off-chain
  faction treasury accounting · WS-E on-chain faction wallets, GATED + last); the PR sequence;
  and 5 open owner decisions.
- **`docs/HANDOFF.md`** — baton rewrite: this doc is the open PR (AWAITING_AUDIT); also fixed the
  carried cosmetic SHA lag (main was at `f2a2538`, baton still cited `af0e62f`/`d6f6653`).
- This session note.

## Key grounded findings (for the auditor)
- Factions: `server/services/chain/factions.ts:48`; identities `ai_faction_identities`
  `server/db-schema.ts:159`. Custody: `server/services/chain/client.ts:174`
  (`ALGORAND_ADMIN_MNEMONIC`, one wallet). Treasury: `server/db-schema.ts:495`, `treasury.ts`.
- Player↔faction membership exists: `server/db-schema.ts:228`, join/leave `server/routes.ts:1504`,
  `client/src/components/game/FactionPanel.tsx`.
- Commander tier = buy-class `shared/schema.ts:628`/`:641`; dynamic metadata endpoint
  `server/routes.ts:967` (art mutable off-chain); terraform precedent `server/storage/terraform.spec.ts`.

## Verification
Doc-only — no behavior to test, no code/schema/secrets/funds touched. Every current-state claim
carries a file:line cite; all costs/intervals labelled PROPOSED. CI should stay green
(`check`/`test`/`test:server` unchanged).

## Decisions taken
- Big vision → design doc first, then sequenced gated PRs. Funds (WS-E) is last + gated.
- Commander-mint telemetry unit stays **PARKED** (owner pivoted to the design doc).

## Open / next
- Owner to answer the 5 open decisions in the doc, then pick the first implementing unit
  (recommended start: WS-A onboarding — smallest, no funds).
- Carried: #65 globe visual click-test still owed (owner-side); out-of-band main commit
  `9ce0962` (Fly secrets template) — confirm intentional.
