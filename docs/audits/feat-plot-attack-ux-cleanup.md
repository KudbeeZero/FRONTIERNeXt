# Audit — PR #33 `feat/plot-attack-ux-cleanup` (retire DEPLOY ATTACK modal, restore real plot card)

- **Date:** 2026-06-15
- **Auditor:** independent `/handoff-audit` (start-of-chat gate, adversarial subagent in an isolated worktree)
- **Verdict:** **PASS**
- **PR / branch:** #33 `feat/plot-attack-ux-cleanup`
- **Head SHA:** `0a534c7` · **Base / merge-base:** `ff25dcd`
- **Diff:** 15 files, +305/-1126 — frontend + docs + artifact-removal only.
- **Gate action taken:** merged to `main` via squash (`5222678`).

## Claims vs. evidence
| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | Retired global DEPLOY ATTACK modal | ✅ | `AttackModal.tsx` deleted (-439); `GameLayout.tsx` import + `<AttackModal>` render removed; `attackModalOpen` replaced by `attackIntent`. Tree-wide grep: zero remaining import/render/trigger (2 prose comments only). |
| 2 | Every Attack trigger routes to Battlefront prefilled | ✅ | All call `handleRequestAttack(parcelId?)` (selects parcel, switches to Commander tab, bumps `attackIntent`): PlanetGlobe `GameLayout:793`, LandSheet `:1153`, CommandCenterPanel via `commandCenterProps.onAttack` `:770`. CommanderPanel `openBattlefrontSignal` effect opens Battlefront + `attackMode="plot"`. |
| 3 | On-chain attack/claim tx logic UNCHANGED (CRITICAL) | ✅ | Only change inside `handleAttackConfirm` is deletion of a dead `setAttackModalOpen(false)` UI-close call. `attackMutation`/`queueAttackAction(plotId, troops, iron, fuel, crystal)` args + endpoints byte-for-byte unchanged. `handlePurchase → purchaseMutation` untouched. CommanderPanel still wires `onAttack={handleAttackConfirm}` (`:998,:1072`). No amount/target/endpoint altered. |
| 4 | Extra resources behind Advanced collapse (default false); single combat-warning | ✅ | `useState(false)` for `showAdvanced` (`CommanderPanel:435`); Iron/Fuel/Crystal sliders inside `{showAdvanced && …}`; single `commander-combat-warning` line above Confirm. |
| 5 | Restored real plot card via `SelectedPlotPanel`, portaled + clamped | ✅ | `FloatingPlotWidget.tsx` deleted (-246); `GameLayout` renders `<SelectedPlotPanel>` with real props (`onClaim={handlePurchase}`, `isClaiming`, `isWalletConnected`); `createPortal(..., document.body)`; `plotPanelPosition.ts` `right: "calc(18rem + 16px)"`. |
| 6 | Removed stray `right-reports/` | ✅ | `right-reports/` fully deleted (6 files incl. 4 binary); not present on merged tree. |
| 7 | Retro-audit doc for #32 matches what #33 remediates | ✅ | `docs/audits/feat-surface-armory-battle-nav.md` is a retro-FAIL for #32 flagging exactly the items #33 fixes (mock-data widget, stray artifacts, orphaned `SelectedPlotPanel`). |

## Tests (run by the auditor on the head SHA — Linux, real CI parity)
- `pnpm install --frozen-lockfile` → **exit 0**.
- `pnpm run check` (tsc) → **exit 0, clean**.
- `pnpm run test:server` → **244/244 passed** (30 files), exit 0.
- `pnpm test` (client) → **49/49 passed** (8 files), exit 0.
- `pnpm run build` → **exit 0** (chunk-size warning only, pre-existing). Independently confirms no dangling imports survive the `AttackModal`/`FloatingPlotWidget` deletions.
- Cloudflare Pages bot independently reported a **successful preview deploy** on `0a534c7`.

## Scope creep
None. Changed-file set outside `client/src` + `docs/` + `README` + `right-reports/` is empty. No `server/`, `shared/`, schema, route, `.sql`, drizzle, or economy files touched.

## Untested assertions
- No dedicated UI test for the new attack-routing / Advanced-collapse (`data-testid`s exist but no spec asserts them). The PR discloses this ("not runtime-verified").

## Security
- Clean. The refactor is UI navigation/state plumbing only; the value-bearing path `handleAttackConfirm → attackMutation` and `handlePurchase → purchaseMutation` are unchanged (same args/endpoints/amounts/targets). No funds/auth/ASA/secret/input-validation code in the diff.

## What I could NOT verify
- Runtime/visual behavior (portal stacking, `calc(18rem+16px)` rail clamp, Advanced collapse, the on-screen Battlefront-open-on-attack flow) — static diff + types + build only.
- On-chain attack/claim against a live testnet (out of scope; logic provably unchanged).

## Gate / recommendation
**PASS → merged.** All seven claims verified with `file:line` evidence; the critical transaction-integrity claim holds; all four suites green on the head SHA; zero scope creep. Only residual risk is unbooted runtime/visual behavior and the absence of a dedicated UI test — both disclosed by the PR and non-blocking given green typecheck + build. Merging also restores `main` to a good state by landing the #32 remediation.
