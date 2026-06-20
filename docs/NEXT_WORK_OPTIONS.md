# Next-Work Options — candidate units menu (v1, 2026-06-19)

> **A decision surface, not a commitment.** Each item is a *candidate* next unit, sized for the
> one-small-audited-unit-at-a-time flow. Owner picks **one**; nothing here starts until then.
> Legend — **Effort:** XS/S/M/L · **Gate:** PR-gate (normal audit) · `/security-pass` ·
> `/mainnet-gate` + `algo-auditor` (funds/ASA/mainnet). Funds items are flagged ⚠️FUNDS.

## How to read this
Themes are ordered by how naturally they continue the current lane. Within each theme, the
**→ recommended first pick** is the smallest safe opener. Cross-cutting recommendation at the end.

---

## A. Faction economy & commander progression
*(from `artifacts/frontier-al/docs/design/faction-economy-and-commander-progression-design.md`)*

- **WS-A — Faction onboarding** · **S** · PR-gate · no funds.
  Make faction choice a first-run step on top of the EXISTING join/leave + `FactionPanel`
  (`server/routes.ts:1504`, `players.playerFactionId`). UI/game only, fields already exist.
  **→ recommended first pick of this theme.**
- **WS-B — Commander tier progression (math)** · **M** · PR-gate · ASCEND-cost, no chain.
  Pure module `shared/commanders/progression.ts` mirroring terraform; `advanceCommanderTier`
  storage + `POST /api/actions/advance-commander`. Pure logic gets a MemStorage spec.
- **WS-C — Commander tier ART** · **S** · PR-gate · off-chain, no re-mint.
  Drive the dynamic metadata `image` (`server/routes.ts:967`) from progression level — no ASA
  change. Needs new art assets.
- **WS-D — Faction treasuries (off-chain accounting)** · **M** · PR-gate · additive schema, no funds movement.
  Extend `treasury_ledger` with nullable `faction_id`; attribute fee share per faction; dashboard
  view. Proves the model before any custody.
- **WS-E — Faction on-chain wallets + settlement** · **L** · ⚠️FUNDS · `/security-pass` + `/mainnet-gate` + `algo-auditor`.
  Per-faction keypair custody, seed funding, opt-in, receiver routing. **Last; testnet-only first;
  multiple sub-PRs. Do not start without explicit go + gates.**

## B. Telemetry / dashboard (continue the purchase-funnel lane)
- **Commander-mint telemetry instrumentation** · **S** · PR-gate · server-only, no funds. *(parked, ready)*
  Mirror the land route's `recordPurchaseTransition` calls onto `POST /api/actions/mint-avatar`
  (`server/routes.ts:2109`) so commander purchases appear in the funnel. **→ strong quick win.**
- **jsdom / Testing-Library render harness** · **M** · PR-gate · adds devDeps + vitest env.
  The deliberate test-infra PR (the admin SSR smoke in #67 deferred to this) — unlocks real DOM
  tests for admin/dashboard.

## C. Security / hardening
- **Rate-limit `/api/actions/*`** · **S–M** · `/security-pass` · no funds.
  Currently no per-action rate limit (carried risk). Extend `server/rateLimitStore.ts` /
  `server/security.ts`. **→ recommended first pick of this theme.**
- **Idempotency for `POST /api/sub-parcels/:id/build`** · **S–M** · PR-gate.
  Reuse `server/idempotencyGuard.ts` + `MUTATION_PATH_RE` (`routes.ts:498`) — replay safety for the build action.
- **algod-first finality in `verifyAlgoPayment`** · **M** · ⚠️FUNDS · `algo-auditor` + `/security-pass`.
  Today finality is indexer-only. Gated.

## D. Globe / client
- **§6 `globeProjection.ts` seam** · **M** · PR-gate · **HOLD.**
  The deferred `worldToScreen`/`surfaceHit` interface — should land **with** the combat package
  that consumes it (standalone now = dead code). Recommend not yet.
- **`feat/globe-mission-layer`** · **M** · PR-gate · additive overlay (nullable schema).

## E. Story mode (Aether's Journey)
- **Reconcile Ch.1 dialogue + VO** · **M** · PR-gate (voice-regen needs repo secrets).
  Reconcile `apps/aether-journey/src/data/dialogue.ts` to the Ch.1 script + assign `voiceId` to
  the remaining ~14 VO lines. Note: Aether is not audibly/browser-verified.

## F. Hygiene (small, safe, fast)
- **Remove the stale root `HANDOFF.md` duplicate** · **XS** · PR-gate. Keep `docs/HANDOFF.md` canonical.
- **Verify REC-004 `AGENT_ORCHESTRATION_LEDGER.md`** presence on `main` · **XS** · PR-gate (flagged absent, never re-verified).
- **#65 globe visual click-test** · owner-side, **not a code PR** — manual check on the Cloudflare preview.

---

## Cross-cutting recommendation
If continuing the **current telemetry lane**: take **Commander-mint instrumentation** (B) — smallest,
finishes what #68 started. If pivoting to the **faction program**: take **WS-A onboarding** (A) —
smallest first real step, no funds. Both are **S / no-funds / PR-gate**. Heavier or funds items
(WS-E, algod finality) stay gated and later. Pick one and it becomes the next single PR.
