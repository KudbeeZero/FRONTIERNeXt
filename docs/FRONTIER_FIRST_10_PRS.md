# FRONTIER — First 10 PRs

> The immediate execution queue after this docs PR lands. Based on the 2026-07-06 audit, not the
> default template order — the audit changed the order in two ways: (a) a machine-readable
> registry must precede the dashboard shell that consumes it; (b) the SEV1 purchase-verification
> fix is the highest-ROI item in the repo and is inserted (owner-gated) rather than deferred.
> Rules per PR: one branch at a time, CI green on head, gate lane per
> [`FRONTIER_BRANCH_MACHINE.md`](./FRONTIER_BRANCH_MACHINE.md). Rollback = revert commit unless
> stated. **PR 0 (this one)** delivers the six FRONTIER docs.

---

## PR 1 — chore: machine-readable agent registry
- **Branch** `chore/state-registry-json` · **Gate** merge-on-green (docs/type lane)
- **Files** `docs/state/agent-registry.json` (generated from `FRONTIER_AGENT_REGISTRY.md` tables),
  `shared/opsRegistry.ts` (types + zod schema), spec validating JSON against schema.
- **Accept** registry JSON validates; every §A/§B registry row present with risk + kill-switch field.
- **Owner action** none. **Rollback** revert.

## PR 2 — feat: agent kill switches (fail-closed)
- **Branch** `feat/agent-kill-switches` · **Gate** owner review (touches worker behavior)
- **Files** `server/agentFlags.ts` (+spec), wire checks into battle resolver, market resolver,
  season manager, **ASCEND transfer worker** (registry #2/#5/#6/#7), mirroring the `AI_ENABLED`
  double-gate pattern.
- **Tests** per-worker spec: flag OFF ⇒ cycle no-ops (fails before wiring, passes after);
  transfer worker OFF ⇒ queue untouched.
- **Accept** every write/funds worker stoppable at runtime without deploy.
- **Owner action** approve flag names/defaults (all default ON, present behavior unchanged).
- **Rollback** revert (flags default to current behavior).

## PR 3 — feat: Mission Control dashboard shell
- **Branch** `feat/mission-control-shell` · **Gate** merge-on-green (UI, read-only)
- **Files** `client/src/pages/mission-control.tsx` (route in `App.tsx`), agent-card widget set on
  the existing dashboard v2 grid, `GET /api/ops/agents` (admin-gated, serves registry JSON +
  live heartbeats), kill-switch toggles calling an admin-gated flags endpoint (from PR 2).
- **Tests** ops endpoint spec (auth required, shape), card render test, toggle wiring test.
- **Accept** `/mission-control` shows all registry agents with live status; owner can kill the
  transfer worker from the UI. No mock data — cards without live data say "not wired".
- **Owner action** browser smoke on preview. **Rollback** revert (route removal).

## PR 4 — feat: transaction watcher panel
- **Branch** `feat/txn-watcher-panel` · **Gate** merge-on-green (read-only chain reads)
- **Files** Mission Control widget over existing `chainEventLog`/`chainEventStore` +
  `transferQueue` depth/age/fail counts; `GET /api/ops/chain-events` (admin-gated, paginated).
- **Tests** endpoint spec + render test with real event fixtures.
- **Accept** live tail of mints/deliveries/transfers/clawbacks with explorer links; queue health
  visible. **Owner action** none. **Rollback** revert.

## PR 5 — feat: wallet safety panel
- **Branch** `feat/wallet-safety-panel` · **Gate** owner review (wallet-adjacent, read-only)
- **Files** widget: admin address (address only), balance, ASA min-balance locked, network badge
  (TESTNET green / MAINNET red-alert), last 10 outbound txns; `GET /api/ops/wallet` using existing
  algod/indexer reads. **No signing, no secrets.**
- **Tests** endpoint spec (mocked algod), badge logic test (mainnet ⇒ alert state).
- **Accept** panel live on TestNet data; zero write paths added.
- **Owner action** confirm address display OK. **Rollback** revert.

## PR 6 — fix: verify ALGO payment on plot purchase (SEV1) 🛑 FUNDS-GATED
- **Branch** `fix/purchase-payment-verification` · **Gate** FULL: TestNet click-test + txn
  watcher capture (PR 4 panel) + `/security-pass` + explicit owner approval. **No auto-merge.**
- **Files** `server/routes.ts` purchase block (~1883) — require `verifyAlgoPayment` (already
  proven on the commander path) when `FREE_PURCHASES` is off; `services/chain/` spec.
- **Tests** fails-before/passes-after: unpaid purchase rejected; paid (mocked/indexer) accepted;
  FREE_PURCHASES=true path unchanged; idempotency preserved.
- **Accept** SEV1 in `chain-services-audit.md` marked FIXED with evidence; TestNet click-test
  captured in the PR.
- **Owner action** approve before merge; fund click-test wallet. **Rollback** revert restores
  current (testnet-tolerable) behavior — never ship to mainnet without this PR.

## PR 7 — feat: Aether companion report panel
- **Branch** `feat/aether-companion-panel` · **Gate** merge-on-green (UI + pure composer)
- **Files** `server/engine/narrative/companion.ts` (deterministic report composer from game
  state; template-based, no LLM calls) + spec; Mission Control/HUD widget.
- **Accept** reports derive from real state (territory, threats, yields); composer spec covers
  each report type. **Owner action** copy review. **Rollback** revert.

## PR 8 — feat: battle lab system map panel
- **Branch** `feat/battle-lab-system-map` · **Gate** merge-on-green (read-only)
- **Files** system-map doc (`artifacts/frontier-al/docs/design/BATTLE_SYSTEM_MAP.md`) + widget:
  battles resolved 24h, last veritas PASS/FAIL/DRIFT, proof-endpoint link, sim determinism
  timestamp; `GET /api/ops/battle-stats`.
- **Accept** real stats; veritas last-report wired (file/KV read). **Rollback** revert.

## PR 9 — feat: HERMES router mock contracts
- **Branch** `feat/hermes-router-contracts` · **Gate** merge-on-green (types only)
- **Files** `shared/hermes/contracts.ts` — typed message envelope (`from`, `to`, `intent`,
  `risk`, `payload`, `requiresApproval`), routing-table types, zod schemas + spec. Zero runtime.
- **Accept** types compile, schemas validate examples; explicitly no agent gains new powers.
- **Rollback** revert.

## PR 10 — docs: live-execution & security-pass plan
- **Branch** `docs/live-execution-plan` · **Gate** merge-on-green (docs)
- **Files** `docs/FRONTIER_LIVE_EXECUTION_PLAN.md`: the Phase-25 30/60/90 plan expanded into a
  dated calendar; scheduled `/security-pass` cadence; `smoke:testnet` result record (run it in
  this window once the owner funds the session wallet); Kestra deployment verification results;
  owner-decision log (api-server island, branch pruning).
- **Accept** every unknown from `FRONTIER_ARCHITECTURE_TRUTH.md` §10 has an owner-visible next
  step. **Rollback** revert.

---

### Sequencing note
1→2→3 are strictly ordered (registry → switches → shell). 4/5 can follow 3 in either order.
6 runs whenever the owner is ready to supervise its gates (its panel dependency is PR 4).
7/8/9/10 are independent. One branch at a time throughout.
