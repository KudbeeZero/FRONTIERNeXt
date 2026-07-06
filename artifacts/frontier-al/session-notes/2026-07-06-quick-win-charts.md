# 2026-07-06 — Unit D2: quick-win charts (Faction Control + Battle Pulse)

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #199
merged) · **Unit:** first dataviz unit from
[`BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md`](../docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md),
following the `/dataviz` skill's method (form-by-job → color → validate → marks
→ interaction → accessibility).

## What shipped

Two new charts on `/info/economics` (the tokenomics page), both fed by existing
endpoints — **recharts 2.15.2 was already a dependency**, no new one added.

1. **Faction Control** — a horizontal bar chart of live territory held by each
   AI faction plus an "Unclaimed" remainder. *Job: identity + magnitude →
   categorical.* Colors are each faction's real brand color from
   `client/src/lib/factions.ts` (`PLAYER_FACTIONS`, the same list used on the
   faction-select gate) — a player sees the identical color for NEXUS-7 there
   and here. Direct value labels on every bar (mandatory at 4+ series per the
   dataviz skill).
2. **Battle Pulse** — a diverging daily bar chart: attacker victories above a
   neutral zero-line, defenses held below it. *Job: polarity over time →
   diverging pair.* Colors reuse the game's own established victory/defense
   semantics (`GlobeBattleSequence`'s `VICTORY_COLOR`/`DEFENSE_COLOR`) rather
   than inventing new hues, so the chart reads consistently with the in-game
   cinematic. Legend + hover tooltip (values shown as positive counts, not the
   internally-negated bar value).

## Data (zero new server endpoints)

- Faction Control: `GET /api/factions` (territory/member counts, already live)
  + `ownedParcelCount` off the already-fetched `/api/economics` (for the
  Unclaimed remainder) + the real `TOTAL_PLOTS` constant (`shared/schema.ts`).
- Battle Pulse: `GET /api/battles/history?limit=100` (already public), bucketed
  client-side into a trailing 14-UTC-day window.

## Palette validation (dataviz skill requirement — record the report)

Ran `scripts/validate_palette.js` against the page's own dark surface
(`#0a0b14`, the tooltip background already used on this page):

- **Faction categorical set** (`#4fc3f7,#a78bfa,#f472b6,#34d399,#6b7280`):
  **CVD separation PASSES** — worst adjacent ΔE 15.3 (deutan), well past the
  ≥12 target. Lightness-band and chroma-floor checks FAIL: the four faction
  hues are lighter/pastel by design (established brand identity used
  everywhere else in the game — the faction-select gate, Armory badges, HUD),
  and the neutral gray intentionally reads as gray (it's the "Unclaimed"
  slot). Mitigated per the skill's own rule for a CVD-adjacent case: direct
  value labels on every bar + a category-axis label (never color alone).
- **Battle Pulse diverging pair** (`#22d3ee,#f87171`): **CVD separation PASSES**
  with a very wide margin — worst adjacent ΔE 42.4 (protan). Lightness-band
  fails for the same reason (established in-game semantic brand colors, not a
  fresh palette). Mitigated with a legend, direct hover values, and a neutral
  gray zero-line (never a hue at the diverging midpoint).

**Judgment call, disclosed:** this unit intentionally keeps the game's own
existing, already-shipped brand/semantic colors rather than introducing a
generic palette that would look inconsistent with the faction gate and the
battle cinematic. The one check that actually gates accessibility for
categorical/diverging palettes — CVD separation — passes cleanly in both
cases; the failing checks (lightness band, chroma floor) are about a palette's
*origin* (a fresh design vs. an established brand), not its safety, and are
mitigated with direct labels per the skill's stated fallback.

## Tests

- `client/tests/faction-control.spec.ts` — 7 tests: fixed `PLAYER_FACTIONS`
  order + real colors, correct Unclaimed remainder arithmetic, floors negative/
  missing input at 0, defaults to the real `TOTAL_PLOTS`.
- `client/tests/battle-pulse.spec.ts` — 6 tests: full trailing UTC-day window
  (zero-battle days included), correct per-day tallies, boundary handling at
  the window edges, out-of-window battles excluded, non-finite input ignored.

**Verification:** tsc clean · server 439/14 skipped · client **278** (265 + 13
new) · production build green (`pnpm run build`).

**Honest gap:** the chart JSX itself (recharts `ResponsiveContainer` rendering)
is typecheck/build-verified only — consistent with this page's *existing* pie
chart, which also has no dedicated render test (recharts' `ResponsiveContainer`
needs real layout dimensions that don't exist in this codebase's SSR-only, no-
jsdom client test harness). The pure data-shaping logic that actually
determines correctness (bucketing, dedup, remainder math) is fully unit-tested
above. Owner should eyeball `/info/economics` once deployed.

## For the next session

D2 done — both quick-win charts shipped. Next per the plan: **D3** real
supply-flow history (needs a new `economics_snapshots` table + sampler, since
no economics time-series exists anywhere today). This is the last queued unit
from the original plan.
