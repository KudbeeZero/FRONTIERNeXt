# Battle / Commander / Menu Architecture Refactor Plan

> Owner ask (2026-07-06, via `/goal`): make sure battles are working, refactor the whole
> battle/commander architecture and the menu system, keep the NFTs. This doc is the scoping
> pass — a fresh, read-only audit of the actual code — before any implementation unit starts.
> Follows the repo's Session Relay Protocol: this plan is its own reviewed unit; every phase
> below is a separate branch/PR, audited on green before the next starts.

## 0. What NOT to touch, and why

Two things in this space are already good and heavily used — refactoring them "because the
architecture is being redone" would be pure risk with no payoff:

- **`server/engine/battle/resolve.ts`** (the pure combat-math core) — 93% line coverage, the
  CI coverage gate's actual target, deterministic and seed-tested (`random.ts`, `resolve.spec.ts`,
  `replayLog.spec.ts`). This is a clean, small, well-factored module already. Leave the math alone.
- **NFT minting/ownership** (`server/services/chain/commander.ts`, `weapon.ts`, `db-schema.ts`'s
  `commanderNfts` / `commanderMintIdempotency` tables) — explicit owner instruction: "keep the
  NFT." No changes to mint/transfer/custody flows in this effort. HARD RULE also applies: no
  funds/ASA/transfer code moves without a `/mainnet-gate` PASS + `algo-auditor` pass, and this is
  TestNet-only right now regardless.

Everything below is UI/architecture restructuring and test-coverage broadening — not new game
rules, not new combat math, not new chain logic.

## 1. Current state (recon, 2026-07-06)

### Server battle engine (`server/engine/battle/`, ~1600 lines incl. specs)
Already well-factored: `types.ts`, `tuning.ts` (balance constants), `random.ts` (seeded RNG),
`resolve.ts` (the resolver), `replayLog.ts`, `verify.ts` (proof/audit hash), `sim.ts` (balance
simulation harness). `server/engine/ai/reconquest.ts` handles AI faction attacks. Battle/commander
routes live in `server/routes.ts` (attack, switch-commander, special-attack, sub-parcel attack,
replay, proof, battle history/stats, commander leaderboard, weapons catalog/build/upgrade/mint).

### Client battle/commander UI — the sprawl
No single "battle" module — battle-related rendering is spread across a dozen+ components with
overlapping responsibility:
- `CommanderPanel.tsx` (852 lines) — still a large orchestrator over its own `commander/*`
  subcomponents (from the 2026-07-05 refactor).
- `WarRoomPanel.tsx` (448), `BattleWatchModal.tsx` (500), `BattlesPanel.tsx` (263),
  `BattleSequenceTimeline.tsx` (145), `CommanderCombatRecord.tsx` (58),
  `TopCommandersLeaderboard.tsx` (57) — six more top-level components, each independently built,
  with duplicated data-fetching and layout patterns.
- Globe cinematic layer: `globe/GlobeBattleSequence.tsx` (253), `globe/BattleCalloutHUD.tsx` (113),
  `globe/LiveWeaponLayer.tsx` (62), `globe/BattleSoundLayer.tsx` (56) — four more files rendering
  different facets of "a battle is happening right now."

None of this is broken. It's just organically grown — nine-plus files for one concept ("watch a
battle") with no shared module boundary.

### The menu system — the real architectural smell
`GameLayout.tsx` (1441 lines) runs **two parallel navigation state machines**:
- Mobile: `activeTab: "map"|"inventory"|"battles"|"armory"|"leaderboard"|"commander"|"economics"|
  "intel"|"trade"|"factions"|"markets"` — drives a fullscreen panel swap.
- Desktop: `desktopRightTab: "warroom"|"armory"|"rankings"|"trade"|"factions"|"markets"|
  "commander"|"university"` — drives an independent side-panel tab strip.

These two state machines route into the **same underlying panel components** (e.g. mobile
`"battles"` and desktop `"warroom"` both ultimately show battle-related UI) but use different
tab keys, different labels, and are maintained independently — a change to one doesn't
propagate to the other, and it's easy for them to drift (as they already have: "War" vs
"battles", desktop's `"university"` has no mobile equivalent surfaced in the same list).

This is the concrete, well-scoped target for "refactor the whole menu system."

### Test coverage for "make sure battles are working"
CI's coverage gate (`docs/COVERAGE_GATE.md`) only gates `resolve.ts` + a few `shared/` math
modules at 80% lines / 70% branches (currently 93%/91%/78%). `replayLog.ts`, `verify.ts`,
`sim.ts`, `tuning.ts`, and `server/engine/ai/reconquest.ts` all have `*.spec.ts` files today but
aren't in the gate's `include` list — so a regression there wouldn't fail CI even though tests
exist. There's no integration-level test proving the full path (attack action → `resolveBattle`
→ battle record written → replay readable → NFT/commander state updated) end to end.

## 2. Phased plan

### Phase A — Unify the menu/navigation system (Task #2)
**Goal:** One navigation state machine, one source of truth for "what panel is showing,"
used by both mobile and desktop layouts (they can still render differently — a bottom nav vs a
side rail — but off the same tab enum and the same active-tab state).
**Files:** `GameLayout.tsx`, `BottomNav.tsx`, and whatever desktop tab-strip component holds
`desktopRightTab` today.
**Approach:** Define one canonical tab enum (pick the clearer of the two existing vocabularies,
e.g. `"warroom"` over `"battles"` if that's what the copy already says, or vice versa — decide
during implementation, not here), drive both mobile and desktop rendering from one piece of
state, delete the second state machine.
**Done when:** tsc clean, existing client tests green, manual nav paths in both mobile and
desktop layouts reachable from the single state (verified by a smoke render test if one doesn't
already exist), zero change to what any panel *renders* — only how the player gets to it.
**Risk:** low-medium. Client-only, no server/chain/combat-math changes. The risk is purely
regression in "which tab am I on" — mitigated by keeping panel components themselves untouched.

### Phase B — Consolidate the battle-watching UI (Task #3)
**Goal:** One `battle-theater/` (or similar) module owning "render a battle in progress /
just resolved," replacing the ad hoc spread across `BattleWatchModal`, `BattleSequenceTimeline`,
the four globe battle layers, and `BattlesPanel`'s history rendering — without changing what
data drives any of it (still reads from the same `resolveBattle` output / battle records).
**Files:** the eleven files listed in §1's "client sprawl" section.
**Done when:** tsc clean, tests green, no visual/behavioral regression (this is the one place
where "don't change combat/canvas behavior outside a scoped, audited unit" applies most directly
— the *math* doesn't move, only how the same data is organized into components).
**Risk:** medium — canvas/cinematic code is explicitly HARD-RULE-gated; this phase needs extra
care and should ship as its own small, reviewable diff, not a rewrite-everything commit.

### Phase C — Broaden battle-engine test coverage (Task #4)
**Goal:** the concrete "make sure battles are working" deliverable. Add `replayLog.ts`,
`verify.ts`, `tuning.ts`, and `server/engine/ai/reconquest.ts` to the coverage gate's `include`
list (they already have spec files — this is turning on enforcement, not writing tests from
scratch), plus one new integration-style test that drives the full attack → resolve → record →
replay path against the real route handlers (in-process, no live network).
**Files:** `vitest.config` coverage include list (wherever `docs/COVERAGE_GATE.md` says it lives),
new `server/engine/battle/integration.spec.ts` or similar.
**Done when:** `coverage:server` still passes at the (now broader) gate, new integration test
fails-before/passes-after is demonstrated against a seeded regression (per repo convention: no
fix without a test).
**Risk:** low — additive only, no production code path changes required unless the broadened
gate surfaces an existing gap, in which case that gap gets its own follow-up unit rather than
being silently patched inside this one.

## 3. Explicit non-goals

- No changes to NFT mint/transfer/custody code (owner: "keep the NFT").
- No changes to combat math, balance constants, or RNG (`resolve.ts`, `tuning.ts`, `random.ts`
  stay as-is — Phase C only broadens what's *tested*, doesn't touch the logic).
- No mainnet-adjacent changes of any kind.
- Not attempting all three phases in one PR — one unit per chat/branch per the working
  agreement; each phase above is its own audited PR.
