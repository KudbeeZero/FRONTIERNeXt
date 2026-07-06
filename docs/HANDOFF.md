# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — 🔎 AWAITING_AUDIT: faction single-source-of-truth · main green at `936a4ce`

**Owner /goal (2026-07-06):** the faction claim/button/menu "don't link together"
and a claimed faction "doesn't stay globally with the user — needs to stay in
their ALGO account." **This unit, done:** a research agent confirmed the faction
DOES persist durably (wallet-keyed `players.playerFactionId`) and the badge+panel
read it right, but the **entry gate + objective HUD read a divergent localStorage
key** and never reconcile — so a new device re-prompted an already-claimed player,
and panel switch/leave left the cache stale (`clearFaction` was dead code). Fix
makes localStorage a faithful cache of the authoritative server record: gate
rehydrates from `/api/auth/me` on mount, panel join/leave keeps the cache in sync.
New pure helpers `resolveEffectiveFaction`/`shouldShowFactionGate`/`asPlayerFactionId`
(8 new tests). tsc clean · client 285 · build green. Detail:
[`session-notes/2026-07-06-faction-single-source-of-truth.md`](../artifacts/frontier-al/session-notes/2026-07-06-faction-single-source-of-truth.md).

### 🔴 HIGH-PRIORITY QUEUE from this session's 5 research agents (do next, in order)

**A. Concurrent double-spend bugs (DB-health audit) — jump the queue, these are real:**
1. `fillTradeOrder` (`db.ts:2281`) — double-fill transfers resources twice (no
   `FOR UPDATE`, mark-filled keys only on `id`). **CRITICAL.**
2. `claimWinnings` (`db.ts:3278`) — not in a txn; double-claim pays out twice. **CRITICAL.**
3. `grantWelcomeBonus`+login (`routes.ts:444`) — concurrent logins double-enqueue the
   on-chain 500-ASCEND transfer (real funds). **BUG.**
4. `placeBet` (`db.ts:3216`) — non-atomic double-credit. **BUG.**
   Fix pattern already in-repo: `openLootBox`'s txn + `FOR UPDATE` + conditional
   `UPDATE … WHERE <not-done> RETURNING` + rowCount bail; each needs a
   fail-before/pass-after concurrency test like `lootbox.db.spec.ts`.
**B. Quick DB/gate wins:** `players.address`/`player_faction_id` indexes (migration
0013); extend the strict action rate-limiter to `/api/trade|markets|weapons|
sub-parcels|factions`; a middleware-binding coverage test.
**C. Menu/Armory (menu-audit agent):** quick fixes — Armory currency mislabeled
"FR"→"ASCEND" (`ArmoryPanel.tsx:253`), hidden upgrade price, inverted radius; the
Armory desktop-rail grid squeeze (`sm:grid-cols-2` in a 256px rail) is the real
"confusing" cause; mobile/desktop battles panel drift (`BattlesPanel` uses
`Date.now()`, `WarRoomPanel` uses `serverNow()`); delete dead `BottomNav.tsx`.
Full Armory rework brief in the agent report.
**D. Features (playtest + cinematic agents):** "Commander Garrison" (S — activate
the dead `defenseBonus` field: garrison a commander on a plot → adds to that plot's
defender power; reuse `lockedUntil` exclusivity; touches `resolve.ts` combat math,
NOT `battle-sequence.ts`/NFT code); "Plot Satellite View" (M — reuse the unused
`/nft/biomes/*.png` art for a 2.5D plot card); globe color layers L1 Faction Heat
(S) / L2 Conflict Heat (M) — pure visualizations of existing data. **Needs owner
conversation before code:** alliances/diplomacy (no mechanic exists) and "mother
nature" environmental events (no simulation exists) — don't invent these off-hand.

**Prior — ALL SIX battle-visuals/dataviz units (#194–#201) + deploy cleanup (#202)
shipped this session.** Plan:
[`artifacts/frontier-al/docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md`](../artifacts/frontier-al/docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md)
(merged as #195) — D1 truth pass (#196), B1 Muster (#197), B2 Shield Wall
(#198), B3 Battle Scars (#199), D2 quick-win charts (#200), and **this unit,
D3 (last queued), is done.**

**D3:** the real chart the fake sine-wave "Circulating Supply Trend" (removed
in D1) pretended to be. New `economics_snapshots` table (additive-only
migration `0012`) + an hourly sampler wired into the existing server tick
(fail-open, same pattern as `pruneActionNonces`) + new
`GET /api/economics/history` + a real stacked-area "Supply Flow" chart on
`/info/economics`. **Migration verified live**: stood up a throwaway Postgres,
ran `drizzle-kit push`, confirmed the table+index, did a real insert/select,
confirmed the hand-authored SQL is idempotent, tore the cluster down.
Deliberately **duplicates** (doesn't refactor) `/api/economics`'s computation
in the sampler — first-migration-unit risk trade, disclosed. Also deviated
from the plan's "sequential hue" wording: used the dataviz skill's actual
categorical rule for part-to-whole, reusing this page's existing Distribution-
pie colors. New `economicsSnapshotShape.spec.ts` (7 tests, split from the
DB/chain code specifically so it loads without `DATABASE_URL` — mirrors this
repo's own `lootbox.db.spec.ts` pattern for the same problem). tsc clean ·
server 446/14 skipped (7 new) · client 278 · production build green. Full
detail: [`session-notes/2026-07-06-supply-flow-history.md`](../artifacts/frontier-al/session-notes/2026-07-06-supply-flow-history.md).

**Honest gap:** the DB/chain integration functions are untested (matches this
codebase's own "blocked" convention for chain/DB code); chart JSX is
typecheck/build-verified only, same as every other chart on this page. Owner
should confirm the sampler fires in the real deployed environment and that
`/info/economics` starts accruing real history.

**Next session:** audit + merge this PR. **Nothing is queued from the owner's
/goal after this merges** — check with the owner for the next priority, or
pick from the plan's runners-up (Spoils Convoy, Replay Theater, Front-line
Heat) or the broader backlog below.

Earlier: retroactive audit of #193 PASSED (#194); research + plan merged (#195);
D1 (#196), B1 (#197), B2 (#198), B3 (#199), D2 (#200) merged, main at
`5f42ab5` — see
[`docs/audits/claude-session-ncb8qx.md`](./audits/claude-session-ncb8qx.md).

**Owner smoke test outstanding (the real verification of #193):** on
frontierprotocol.app — (1) landing no longer auto-enters the game, (2) a real wallet
stays connected in `/game`, (3) Disconnect actually reaches the connect-gate,
(4) a land purchase with the real wallet succeeds.

**Standing mainnet-gate item:** `VITE_DEV_MODE` + `DEV_LOGIN_ENABLED` still ship
`'true'` in production fly.toml — deliberate for TestNet; must be removed before
mainnet.

### Prior push — eight units, all merged on green (#184–#191) + closeout #192

Full detail:
[`session-notes/2026-07-06-art-audio-terminal-heroku.md`](../artifacts/frontier-al/session-notes/2026-07-06-art-audio-terminal-heroku.md).
Short version:
- **#184** real faction-emblem/badge/hero art (owner-supplied images) wired into the faction
  gate, Armory badges, and landing hero.
- **#185** menu design system — `docs/design/MENU_DESIGN_RULES.md` spacing/radius/typography
  tokens applied across Armory/University/Leaderboard/Commander/WorldIntel/TradeStation;
  Orbitron adopted as `--font-display`.
- **#186** faction-gate ambient hum + hover beep + card-lift animation (WebAudio synthesis,
  no assets, untested by design — matches `battleSoundPlayer.ts` precedent).
- **#187** plot-select **Tactical AI Terminal** — cloned the existing `advisor.ts`
  Claude-Haiku pattern into `plotTerminal.ts` + a rate-limited terminal-brief endpoint +
  typewriter readout; deterministic heuristic fallback if `ANTHROPIC_API_KEY` isn't set.
- **#188** fixed a real duplicate-Claim/Attack-card bug (dead second render block).
- **#189 + #191** Heroku deploy support (owner testing a second host in parallel with Fly) —
  `engines.node` pinned, `heroku.yml` container-stack path added, then the semver range fixed
  from `">=22 <23"` (Heroku flagged the bare operators as "dangerous") to `"22.x"`. Both fields
  are inert for Fly's Docker build.
- **#190** plot-select panel redesign — draggable + pop-out-minimize chip, owner asked for
  "at least a 9.5/10," replacing the old fixed cheesy card.

**Owner action items outstanding (not this session's to close):**
1. Retry `git push heroku main` (or `heroku stack:set container` first) and report whether
   #191 actually gets a Heroku build through — untested until the owner runs it.
2. `fly secrets set ANTHROPIC_API_KEY=...` to light up the plot terminal's real LLM path
   (heuristic fallback works today without it).
3. Smoke-test #186/#190 (gate audio, draggable panel) on a real device — sandbox-verified via
   headless screenshots only.

**Not started, flagged for scoping:** Armory tactical map/radar overlay (owner wants it more
"tactical" — needs a conversation: Google Maps API cost/ToS vs. a radar built from existing
game data). Running `server/veritas/` continuously as the on-chain watchdog the owner asked
for via `/agents` (candidate: Lightning AI + Discord webhook) — the module already exists,
built and tested, just never run anywhere. `/admin` dashboard is built but unlinked.
`MENU_DESIGN_RULES.md` follow-ups: `slate-*` palette migration in Armory/University, a few
remaining sub-10px captions in Commander/WorldIntel panels.

### Prior push — headless visual-testing harness + battle/commander/menu refactor — MERGED

**BREAKTHROUGH (owner-confirmed "this is awesome"): Claude can render + screenshot the real 3D
globe headlessly in the sandbox.** Throwaway local Postgres + real server + real client +
headless Chromium with SwiftShader software WebGL. Captured the live 21k-plot globe, the
faction gate, and the `?dashboard=1` widget canvas; images delivered to the owner. Checked in
so every future session can do visual testing: `docs/HEADLESS_VISUAL_TESTING.md` (strict
recipe + traps, now also documenting the Google-Fonts-never-render-in-sandbox trap and the
stale-tsx-server dual-:5000-listener trap) · `script/visual-smoke.cjs` · `pnpm run
smoke:visual` · CLAUDE.md memory entry ("do NOT claim not-browser-verifiable before trying
this"). Merged as #180.
**Owner's standing UI vision (stated 2026-07-06):** the `?dashboard=1` snap-grid widget
dashboard IS the goal — make it the flagship experience: smooth/polished animation, toggleable
color/info layers on the globe, widget grid snapping. Still queued, not started.

### Battle/commander/menu refactor — COMPLETE (as scoped).

**Owner `/goal` (2026-07-06): refactor the battle/commander architecture and the whole menu
system, keep the NFTs, and make sure battles are actually working.** Plan doc —
[`artifacts/frontier-al/docs/BATTLE_MENU_REFACTOR_PLAN.md`](../artifacts/frontier-al/docs/BATTLE_MENU_REFACTOR_PLAN.md).
Three units, two merged as real shipped code, one closed with an honest "not needed" finding:

- **✅ #177 MERGED:** plan doc + dashboard-widget panel registry (killed a third hand-rolled
  copy of every panel's props) + CI coverage gate broadened (`replayLog`/`verify`/`tuning`/
  `random` now enforced) + `server/engine/ai/reconquest.ts` (AI faction attacks) went from
  **zero tests** to 19 real unit tests, now gated (94.54%/82.17% lines/branches aggregate).
- **✅ #178 MERGED: the actual mobile/desktop nav unification.** `GameLayout.tsx` ran
  `activeTab` (mobile) and `desktopRightTab` (desktop rail) as two fully independent `useState`
  hooks that never interacted (mobile dock is CSS-hidden on desktop and vice versa) — every
  handler needing "the current panel" had to set both. Now `activeTab` is the only state;
  `desktopRightTab` is derived via a new pure `client/src/lib/panelNav.ts`
  (`isRailTab`/`resolveRailTab`, 5 tests, no jsdom needed). Resolved the tab-vocabulary mismatch
  additively — desktop gained `economics`/`intel`, mobile gained `university`/Academy, **nothing
  removed from either platform**. Found `BottomNav.tsx`'s component is dead code (`HudShell.tsx`
  replaced it already) — left removal as a separate tiny cleanup. tsc / **226 client tests**
  (221+5 new) / build all green.
  **Honest gap:** `GameLayout.tsx` still has no *interactive* click-simulation tests (existing
  tests are static SSR renders) — **owner should smoke-test tab-switching on both a phone and a
  desktop browser** after this deploys; that's the one piece genuinely unverifiable from this
  sandbox.
- **Phase B (battle-watching UI "sprawl") — investigated, closed, NOT refactored.** The original
  recon's "11-file sprawl, no module boundary" framing didn't hold up under a real read:
  `BattleWatchModal` already composes `BattleSequenceTimeline` as a child; the four globe battle
  layers are properly separated by concern and synced through an existing, well-documented
  pub/sub (`cinematicBus.ts`) built specifically to prevent the duplication this phase was
  proposing to fix; `CommanderCombatRecord`/`TopCommandersLeaderboard` already share a tested
  formatter. Forcing a consolidation onto already-well-factored, HARD-RULE-gated cinematic code
  would have been pure risk for no benefit — closed with that finding instead of manufacturing
  a rewrite. See the plan doc's Phase B section for the full per-file evidence.

NFT mint/transfer code and combat math were explicit non-goals throughout — untouched.

**Also this session: fixed a real, month-old production bug** (separate from the /goal above) —
wallet login on frontierprotocol.app spawned ~12 popups and redirected to fly.dev (#175/#176,
merged+deployed). Owner confirmed live: **the popup storm is gone.** The "developer account
with no ALGO" report that followed is very likely just an unfunded real TestNet wallet (confirmed
`VITE_DEV_MODE` is off in the live bundle) — owner needs to fund the connected wallet via a
TestNet faucet.

### ➡️ Work queue (carried forward; "Current baton" above supersedes state claims here)
First check whether the owner's
Heroku push (item 1 above) succeeded or errored again before starting new work. Otherwise pick
from: the Armory tactical-map/radar scoping conversation, wiring up `server/veritas/` as a
continuously-running watchdog, the `?dashboard=1` flagship-dashboard vision (still queued from
the prior push, below), or [`FRONTIER_FIRST_10_PRS.md`](./FRONTIER_FIRST_10_PRS.md). Owner
smoke-tests still outstanding: (1) wallet login on frontierprotocol.app — already confirmed
fixed; (2) tab-switching on mobile + desktop after the nav-unification deploy — not yet
confirmed; (3) gate audio + draggable plot panel on a real device — not yet confirmed.

### ✅ #175 (branded-domain wallet/login fix) — MERGED + DEPLOYED, main@`7cde4a4c`

**Unit 4, owner /goal: fix the month-old frontierprotocol.app login mess** — root cause:
branded host is static Cloudflare (no API → 405s) + the #162 fly.dev hop drops localStorage →
re-connect + stale WalletConnect pairings = ~12-popup storm. Fix: runtime backend resolution
(`lib/backendOrigin.ts`, API+WS → Fly on backend-less hosts), 54 raw fetches through
`resolveApiUrl`, `/game` stays on the current origin, pre-connect stale-pairing purge +
connect() reentrancy guard, CORS allow-headers += x-admin-key. See
[`session-notes/2026-07-06-branded-domain-wallet-fix.md`](../artifacts/frontier-al/session-notes/2026-07-06-branded-domain-wallet-fix.md).
**Two independent review passes (code review + adversarial "disruptor" pass) ran before merge and
both independently caught the same two gaps** the scripted rewrite missed — `WarRoomPanel.tsx` and
`admin.tsx` still used raw same-origin `fetch()` — plus a real double-connect race in
`WalletContext.connect()`. All three fixed, tsc/tests re-verified green, pushed as a follow-up
commit on the same PR before merging.
**CI + Fly deploy both confirmed green on merge commit `7cde4a4c`** (CI run 28763239508, Fly
deploy run 28763239489, Deploy step completed 02:09:25 UTC). Cloudflare Pages redeploys the
client from `main` independently (own GitHub integration, not a gated workflow).
**Owner: do the live smoke test now** — connect wallet on frontierprotocol.app → Enter Game →
should stay on frontierprotocol.app/game with exactly ONE wallet prompt, no popup storm.

### Earlier this push — ✅ #174 (FRONTIER docs suite) merged-on-green after independent Sonnet review

**Next session: nothing to audit — start the next unit directly. Queue:
[`FRONTIER_FIRST_10_PRS.md`](./FRONTIER_FIRST_10_PRS.md) in order (PR 1 `chore/state-registry-json` →
PR 2 kill switches → PR 3 Mission Control shell…). Sonnet review notes:
[`docs/audits/feat-frontier-architecture-agent-roadmap.md`](./audits/feat-frontier-architecture-agent-roadmap.md).
Owner actions outstanding: fund session wallet `JD7CFMNMX4PO...T7IKZA` for `smoke:testnet` ·
decide api-server/lib island · prune ~140 dead remote branches (needs delete-scoped token).**

**This chat (unit 3, owner's new plan): six FRONTIER docs from a fresh read-only repo audit —
[`FRONTIER_ARCHITECTURE_TRUTH`](./FRONTIER_ARCHITECTURE_TRUTH.md) ·
[`FRONTIER_AGENT_REGISTRY`](./FRONTIER_AGENT_REGISTRY.md) ·
[`FRONTIER_MASTER_ROADMAP`](./FRONTIER_MASTER_ROADMAP.md) (25 phases) ·
[`FRONTIER_AGENT_DASHBOARD_SPEC`](./FRONTIER_AGENT_DASHBOARD_SPEC.md) ·
[`FRONTIER_FIRST_10_PRS`](./FRONTIER_FIRST_10_PRS.md) ·
[`FRONTIER_BRANCH_MACHINE`](./FRONTIER_BRANCH_MACHINE.md). Docs-only.
Merged after CI green + an independent Sonnet review pass (owner lifted the hold via /goal).
Prior units this push: #172 (repo refactor + smoke harness) and #173 (Next-Level Playbook) merged green.

**This chat, unit 2: [`NEXT_LEVEL_PLAYBOOK.md`](../artifacts/frontier-al/docs/NEXT_LEVEL_PLAYBOOK.md)** —
owner-requested architecture & development playbook (authored by Fable 5 for Sonnet-class execution):
as-is architecture map, four "next level" phases (onboarding · world liveness · on-chain depth ·
economy/scale), ~20 one-chat units with Goal/Files/Done-when/Risk, the gated mainnet path, and the
PR unit template. Docs-only — zero code changes. **Future sessions: pick units from the playbook;
this baton names the active one.**

**This chat, unit 1: repo-wide behavior-preserving refactor + TestNet NFT smoke harness — #172 MERGED
(owner-authorized, CI green on head).** See
[`session-notes/2026-07-05-repo-refactor-testnet-smoke.md`](../artifacts/frontier-al/session-notes/2026-07-05-repo-refactor-testnet-smoke.md).
- Dead code deleted (globe/v2 + its spec, MissionLoadingScreen, chain/treasury.ts, attached_assets).
- Client: CommanderPanel → `commander/*`, LandSheet → `land/*`, testnet page data → `lib/testnetMissions`,
  ATTACK_ICONS dedup. Server: limiters/wallet-predicates/admin-check → `security.ts`, `sendActionError`,
  shared NFT `chain/delivery.ts`.
- New `smoke:testnet` script mints plot/commander/weapon NFT + upgrade note on TestNet (fail-closed, no DB).
- `docs/ALGORAND_TOOLING_2026.md` — tooling snapshot (algosdk v3 current; VibeKit/AI dev tools).

**For the auditor:** green on head = tsc · server **415/14 skipped** · client **213** (222 − 9 dead-v2-only)
· build OK. All changes mechanical; check the two wallet-predicate variants and idempotency record/release
ordering survived centralization intact. **Honest gaps:** smoke script not yet run on-chain (wallet unfunded);
client extractions not browser-verified.

**Prior:** #169 (dashboard v2) + units 5–7 (attack cooldown, weapon upgradeTier, commander card, war-room
attack) merged directly by owner. Baton had gone stale; rewritten this session.

### ➡️ NEXT UNITS (owner push: on-chain NFT testing)
1. **Run `smoke:testnet` live** — owner funds session wallet `JD7CFMNMX4PO2HSJNRYBXUWR3W7YYLC5M3GMK4MEOCEWHZLAU2IKT7IKZA`
   (2–5 TestNet ALGO) → mint plot/commander/weapon NFTs + upgrade note, verify on Lora. Settles the
   `recordUpgradeOnChain` algosdk-v3 question from `docs/audit/chain-services-audit.md`.
2. **Owner decision:** delete or keep the orphaned `artifacts/api-server` + `lib/*` scaffold island
   (nothing deployed imports it).
3. Future audited splits: `routes.ts` by domain · `storage/db.ts` by domain · `schema.ts` barrel split ·
   GameLayout (overlaps the planned dnd-kit dashboard unit).
4. Carried over: branded-domain wallet prompt · cinematic taste pass · objective HUD lose-detection ·
   Weapons Units 2–3 · Aether VO (needs `ELEVENLABS_API_KEY`) · waitlist payout (🛑 GATED, LAST).

### Open risks / honest flags
- Client extractions + prior units still **not browser-verified on-device** — owner smoke-test on preview.
- Pre-deploy reminders: migrations `0000`–`0011` applied; `VITE_TEST_GLOBE` reads `false`; keep
  `SESSION_SECRET` stable across deploys.
- **Do NOT unify `mem.ts`/`db.ts` game methods** — combat/economy divergence risk (survey verdict).

### 🛑 HARD RULES / off-limits (absolute)
- No funds/ASA/transfer code toward mainnet without **`/mainnet-gate` PASS + `algo-auditor` pass**.
- **Don't merge `wip/atomic-purchase`**; nothing in `ops/kestra/` may point at mainnet.
- Don't reintroduce mock/demo data into plot/HUD surfaces (they are live, server-driven).
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- **Standing owner directive:** proceed without asking when approval is a foregone conclusion;
  still one-PR-at-a-time and HARD RULES remain absolute.
