# 2026-07-06 — Unit D1: token/economics truth pass

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #195
merged) · **Unit:** first unit from
[`BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md`](../docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md) —
kill fake/stale token data on live public surfaces before adding new charts.

## What was wrong (found by research, verified here)

| Surface | Problem | Fix |
|---|---|---|
| `pages/landing.tsx` TokenSection | "Total Supply 10,000,000,000" — real on-chain ASA is 1,000,000,000 (10× wrong) | now `fmtSupply(data.totalSupply)` from live `/api/economics` |
| `pages/landing.tsx` TokenSection | "Status: Pre-Launch" contradicting the same page's "Algorand TestNet LIVE" ticker | now "Live · TestNet" |
| `pages/landing.tsx` TokenSection | unsourced "5B Liquidity-Backed / 5B Land-Minted" split — no code or doc supports it | replaced with a real In Circulation / Treasury / Burned breakdown from `/api/economics` |
| `pages/landing.tsx` HypeTicker | "4,218 parcels claimed" frozen forever | live `ownedParcelCount` |
| `pages/landing.tsx` HypeTicker | "$ASCEND token launching soon" — the ASA is live | "$ASCEND token LIVE on TestNet" |
| `pages/landing-economics.tsx` | "Circulating Supply Trend (Projected)" chart was **synthetic sine-wave data** (`Math.sin(i)`/`Math.cos(i)`) — a mock-data HARD-RULE violation on a live surface | removed outright (D3 will ship the real replacement, needs a new snapshot table) |
| `pages/landing-economics.tsx` | "0.5–1.5 ASCEND/hr" — real rate is per **day**: 1/day base, 6/day fully upgraded | copy fixed to match `TOKENOMICS.md` / `shared/economy-config.ts` |
| `pages/landing-shared.tsx` LandingFooter | "4,218 / 21,000" parcels-reserved frozen (shown on 6 pages via the shared footer) | live `ownedParcelCount` |
| `pages/landing-updates.tsx` | "Build Date: March 2026" static and already stale; query typed `playerCount`/`parcelCount` that `/api/economics` never returns | replaced tile with live "Parcels Claimed"; fixed the query type to `ownedParcelCount` |

Grepped the whole client tree afterward for the removed literals
(`10,000,000,000`, `5,000,000,000`, `Pre-Launch`, `Liquidity-Backed`,
`Land-Minted`) — zero remaining hits.

## Implementation notes

- `landing.tsx` gained a small shared `useEconomicsSnapshot()` hook (same
  `["/api/economics"]` queryKey as `landing-economics.tsx`, so react-query
  dedupes the request across components on the same page).
- `HypeTicker` and `TokenSection` are now named exports (previously
  module-private) purely so the new test can render them directly without
  mounting the whole landing page.
- No server changes, no schema changes — every fix is either a live query
  against the existing `/api/economics` endpoint or a copy correction.

## Tests

New `client/tests/landing-token-data.spec.tsx` — SSR smoke (same
`renderToStaticMarkup` + `QueryClientProvider` harness as `admin.spec.tsx`,
`Router ssrPath` pattern as `gamelayout-entry.spec.tsx`; no jsdom). Pins that
the removed hardcoded/fabricated strings never reappear, and that the
live-data components render the loading placeholder (not a baked-in number)
before the query resolves. 6 new tests, all passing.

**Verification:** tsc clean · server 439/14 skipped · client **236** (230 + 6
new) · repo-wide grep confirms no stale literals remain.

**Honest gap:** not manually screenshot-verified in a running browser — the
research agent noted this class of pages hasn't needed the
`docs/HEADLESS_VISUAL_TESTING.md` recipe before (public landing SPA content,
not the 3D globe canvas), and `/api/economics` requires blockchain env vars
this sandbox doesn't have configured. The SSR smoke test proves the code path
is correct and wired to real data; the owner should eyeball the deployed
landing/tokenomics pages once live.

## For the next session

Unit D1 done. Next per the plan: **B1 War Council Muster** (attacker-side
pending-battle build-up), then B2/B3, then D2 (quick-win charts).
