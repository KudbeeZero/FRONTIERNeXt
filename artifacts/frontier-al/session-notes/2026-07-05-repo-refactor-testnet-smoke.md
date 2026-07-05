# 2026-07-05 — repo-wide refactor + TestNet NFT smoke harness

**Branch:** `claude/algo-codebase-refactor-test-mp28xc` · **PR:** #172 (draft)

## Gate
PR #169 was already merged by the owner before this session (along with units 5–7 direct to
`main`); zero open PRs → nothing to audit, started this unit directly. Baton was stale — rewritten.

## What shipped
Owner-requested repo-wide, behavior-preserving refactor (surveyed by three parallel agents with
file:line evidence, then executed):

- **Dead code deleted** (zero importers verified): client `globe/v2/**` experiment + its
  orphaned spec (9 tests), `MissionLoadingScreen.tsx`, `server/services/chain/treasury.ts`
  (live treasury path is inline in `storage/db.ts`), root `attached_assets/` junk.
- **Client extractions**: `CommanderPanel` → `commander/*`, `LandSheet` → `land/*`,
  `pages/testnet` data → `lib/testnetMissions.ts`, `ATTACK_ICONS` dedup → `lib/attackIcons.ts`.
- **Server centralization**: rate limiters + real-wallet predicates + soft admin check →
  `security.ts`; 19 duplicated ZodError catch blocks → `sendActionError`; NFT delivery →
  shared `services/chain/delivery.ts` (existing exports kept as wrappers).
- **TestNet NFT smoke harness**: `script/testnet-nft-smoke.ts` (`pnpm run smoke:testnet`) —
  mints plot + commander + weapon NFT via the real chain service + records a sub-parcel
  upgrade note; TestNet-only (fail-closed on mainnet), no DB writes.
- **Docs**: `docs/ALGORAND_TOOLING_2026.md` (algosdk v3 current, VibeKit/AI tooling, Nodely
  endpoints, faucets); CLAUDE.md stale-HANDOFF note dropped.

## Evidence
tsc clean · server **415 passed / 14 skipped** · client **213 passed** (222 baseline − 9
dead-v2-only tests) · production build OK.

## Wallet / NFT testing (in flight)
- Session wallet generated for on-chain smoke signing: `JD7CFMNMX4PO2HSJNRYBXUWR3W7YYLC5M3GMK4MEOCEWHZLAU2IKT7IKZA`
  (mnemonic handed to owner in chat — NOT committed; TestNet-only, disposable).
- Existing funded TestNet treasury `ZK55X7...KOXQU` unusable from sandbox (mnemonic only in Fly secrets).
- Owner to fund the session wallet → run `smoke:testnet` live. Note: sub-plots have no NFT by
  design (on-chain note anchoring only); NFTs = plots, commanders, weapons.

## Flagged, not done (owner decisions)
- Orphaned scaffold island `artifacts/api-server` + `lib/{api-client-react,api-spec,api-zod,db}` —
  nothing deployed imports it; delete or keep?
- Future big splits (own audited units): `routes.ts` (4235) by domain, `storage/db.ts` (3541),
  `shared/schema.ts` barrel split, GameLayout god-component (overlaps planned dashboard unit).
- Do NOT unify `mem.ts`/`db.ts` game methods (combat/economy math divergence risk).
- `docs/audit/chain-services-audit.md` claims `recordUpgradeOnChain` breaks under algosdk v3
  (Address object vs string) — code inspection suggests v3 accepts Address; smoke test will
  settle it live.

## Addendum (same session, unit 2)
- **#172 merged** (`ad4578a`) — owner authorized merge-on-green in-session; CI green on head
  (`Typecheck & server tests` ✅).
- **Unit 2:** wrote [`docs/NEXT_LEVEL_PLAYBOOK.md`](../docs/NEXT_LEVEL_PLAYBOOK.md) — owner-requested,
  Fable-5-authored architecture & development playbook for Sonnet-class agents: phases A–D
  (onboarding, world liveness, on-chain depth incl. ARC-19 evolution path, marketplace/scale),
  the gated mainnet sequence, and a per-unit PR template. Docs-only PR (#173).
