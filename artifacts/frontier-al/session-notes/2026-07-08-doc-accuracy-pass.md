# 2026-07-08 — Documentation accuracy pass

Owner: "go through all of the documents in the README and make sure everything's
updated" → "yes, but there's other documents in the read me" (the linked doc set, not
just README.md itself).

Audited all 16 docs linked from the README's Player Resources / Operator & Developer
Docs tables via 3 parallel background agents, cross-checked against facts confirmed
live earlier this session. Fixed what needed fixing (doc-only, no code):

## Stale ASCEND ASA ID (`755818217` → live `764083761`)
Found in 9 files, all updated: `GETTING_STARTED.md`, `FAQ.md`, `TESTING_MODE.md`,
`TOKENOMICS.md`, `GLOSSARY.md`, `handbook.html`, `README.md`, `replit.md`,
`docs/NEXT_LEVEL_PLAYBOOK.md`. `docs/DATA_RECONCILIATION.md` is a dated point-in-time
audit (2026-06-07) — left the original number, added an addendum note pointing to the
current live ID instead of rewriting history. Left untouched (historical/generated,
not "current state" docs): `CHANGES.md` (changelog), `SECURITY_AUDIT_REPORT.md`,
`docs/audit/*`, `session-notes/*`, `coverage/` (generated report).

## Loot boxes wrongly documented as unimplemented
`GAME_MANUAL.md` §18 and `QUICK_REFERENCE.md` both said loot boxes were "planned — not
yet active" / `Player.lootBoxes` always empty. False — confirmed live this session
(`server/engine/lootbox/open.ts` deterministic award-on-trigger logic,
`InventoryPanel.tsx` real open-box flow, live player data with awarded boxes). Rewrote
both to "Live" status. Verified actual drop-rate constants in `shared/schema.ts`
(`LOOT_BOX_DROP_CHANCE`): mine 3%/Common, battle 25%/Rare, orbital 50%/Epic — no
`quantum_forge` trigger exists yet. GAME_MANUAL's table already matched this;
`STRATEGY_GUIDE.md`'s table didn't (had 5%/"guaranteed Common + 15% Rare"/25% Rare) —
corrected to match code.

## Roadmap file lacked a supersession pointer
Root `CLAUDE.md` says `artifacts/frontier-al/ROADMAP.md` and `ROADMAP_90DAY.md` are
superseded by `docs/FRONTIER_MASTER_ROADMAP.md`, but `ROADMAP.md` itself had zero
indication of this — presented itself as the live plan. Added a banner at the top
pointing to the master roadmap.

## npm → pnpm in TESTING_MODE.md
Two `npx vitest run` instructions replaced with the actual pnpm-filtered scripts
(`pnpm --filter @workspace/frontier-al run test:server` / `run test`) — this repo's
preinstall hook refuses non-pnpm.

## Not fixed this pass — flagged for later
- `ARCHITECTURE.md` is a 26-line stub that cuts off mid-section — severely incomplete
  relative to its stated scope. Real content-writing task, not a mechanical fix; left
  as a known gap rather than rushed.
- `DEPLOYMENT.md` and `ENV_VARS.md` both present `api.frontierprotocol.app` as the
  working API origin with no caveat — it's still returning a Cloudflare 525 (confirmed
  earlier this session, unresolved, dashboard-only). Worth a one-line caveat next pass.
- `ECONOMICS.md` never mentions the 50 ASCEND/day testing-mode emission override (only
  shows production-mode numbers) — a gap, not a false claim.
- `ENV_VARS.md`'s `PUBLIC_BASE_URL` entry doesn't mention the new scheme
  auto-normalization (`assertChainConfig()`, shipped earlier this session).

## Scope check
Docs only — no code, no server, no client, no mainnet-adjacent surfaces touched.

## Verified
No test suite applies to markdown/HTML docs. Confirmed via `git diff --stat` that
every changed file is one of the 14 doc files listed above; no accidental code diffs.
