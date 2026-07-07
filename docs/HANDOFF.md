# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

### ✅ Definition of done — EVERY session ends in this state (owner directive 2026-07-07)
A session is NOT finished until all of these hold — check them, don't assume:
1. **`main` is green** — CI passed on the actual head commit of `origin/main` (not a stale or
   `[skip ci]` run). If your merge broke main, fixing it IS your session, whatever else you planned.
2. **The loop is closed** — this chat's unit is committed → pushed → PR'd → baton rewritten.
   No half-open state: no unpushed commits, no PR-less pushed branch, no baton describing work
   that isn't on GitHub.
3. **Local == GitHub (the website is the truth the owner sees).** The container is ephemeral —
   anything not pushed is lost. Verify mechanically before ending:
   `git status` clean · `git fetch origin && git log origin/<branch>..HEAD` empty (nothing
   local-only) · every open PR's head on GitHub matches what you tested locally.
4. **You have the tools — use them.** `/closeout` or `/end-session` runs this checklist;
   `/pr-gate` gives the mechanical go/no-go; CI status comes from the GitHub MCP tools
   (`pull_request_read` get_check_runs / `actions_*`) — never claim green without reading it.
   If a push or PR call fails, retry with backoff; do not end the session with work only local.

## Current baton — 🟢 CLEAN HANDOFF: nothing in flight · main green at `008b615`

**#207 (roadmap/baton rewrite) merged** as `9782ee0` — audited CONCERNS first (two of the
roadmap's own new findings, U4 and U1, had defects), owner chose "fix the two doc issues, then
merge"; correction pushed, CI re-ran green, merged. Full audit trail:
[`docs/audits/docs-roadmap-full-scope-audit.md`](./audits/docs-roadmap-full-scope-audit.md).

**#208 (M1-1, funds) merged** as `7f6a9e3` — merged directly by the owner (KudbeeZero), not via
a fresh chat's `/handoff-audit` (a session can't independently audit its own PR; the owner
merging it directly is a valid alternate path through the same gate, not a bypass).
`DbStorage.grantWelcomeBonus` (`db.ts:1099`) ran in a transaction but the player SELECT had no
row lock and the mark-received UPDATE was unconditional — two concurrent logins both saw
`welcomeBonusReceived: false` and both enqueued the on-chain 500-ASCEND transfer (real
double-spend). Found and fixed a second identical-bug call site
(`POST /api/actions/connect-wallet`). Also bundled (owner request, separate commit): two
backlog items from an external-repo review (`ammaarreshi/Generals-Mac-iOS-iPad`) — see below.
Session note:
[`2026-07-07-fix-welcome-bonus-double-enqueue.md`](../artifacts/frontier-al/session-notes/2026-07-07-fix-welcome-bonus-double-enqueue.md).

**#209 (M1-2) merged** as `008b615` — **independently audited PASS** this time (unlike #208,
this chat wasn't the same session that opened #209, so a real independent audit ran). Auditor
went beyond a read-only diff review: built a schema-compatible buggy variant of `placeBet` in
an isolated worktree and reproduced the fail-before/pass-after story itself, then independently
re-ran `check`/`test:server`/`test`/`coverage:server`/`test:server:db`/`build` rather than
trusting the PR body. Full audit trail:
[`docs/audits/claude-handoff-audit-f5w0qn.md`](./audits/claude-handoff-audit-f5w0qn.md).
`DbStorage.placeBet` (`db.ts:3252`) ran bare statements with no transaction — the player balance
debit and the market pool credit were both read-then-write, so two concurrent bets (same player
racing themselves, or two players on the same market/outcome) could lose an update: a player
could place two bets while only paying for one, and a market's pool could drift out of sync
with the sum of its positions (corrupting `claimWinnings`' payout math). Fix mirrors
#204/#205/#208: `FOR UPDATE` on **both** the market and player rows taken **before any
mutation**, narrowed selects, conditional relative updates as a belt to the lock. New
`placebet.db.spec.ts` — deterministic fail-before/pass-after proven (independently reproduced
by the auditor too). tsc clean · server 446/24 skipped (+3 gated) · coverage:server 94.54%
lines · client 285 · build green · `test:server:db` 21/21 together. CI + Fly deploy both
confirmed green on `008b615`. Session note:
[`2026-07-07-fix-placebet-atomicity.md`](../artifacts/frontier-al/session-notes/2026-07-07-fix-placebet-atomicity.md).

**Working branch has been reset to a clean `origin/main` (`008b615`) — no uncommitted changes,
no open PR.** Next session starts fresh from here: `/handoff-audit` finds nothing to audit
(state above is not `AWAITING_AUDIT`), proceed straight to M1-3.

### ➡️ THE QUEUE — 3-month buildout (Phase 25 of the master roadmap is the authoritative copy)

Execute in order, one unit per chat. Every claim has file:line evidence in the roadmap phase
cited. Funds lanes take full gates (`/security-pass`, TestNet click-test, owner approval);
no fix without a failing-first test.

**Month 1 — funds safety + wallet truth**
1. **M1-1 — DONE, merged #208** `fix/welcome-bonus-double-enqueue` — see baton summary above
   for full detail.
2. **M1-2 — DONE, merged #209** `fix/placebet-atomicity` — see baton summary above for full
   detail.
3. **M1-3 (NEXT UP)** `fix/wallet-single-provider` — residual wallet-popup vectors (the #175/#176
   popup-storm fix holds; these are what's left, roadmap Phase 6c): P1 per-route
   `WalletProvider` remount re-arms auto-auth (`App.tsx:40` + per-instance refs
   `WalletContext.tsx:252,355-361`) → ONE app-level provider + module-level auth guard;
   P3 purge-on-connect aborts in-flight session resume (`WalletContext.tsx:405`);
   P2 (landing↔game cross-origin second connect) is an ADR + owner decision, not code here.
   Read `WalletContext.tsx` + `WalletConnect.tsx` fully first; don't regress #175's fixes.
4. **M1-4 (read)** `fix/pin-ascend-asa` — pin ASCEND ASA via `ASCEND_ASA_ID` env + startup
   assert; today it's name-lookup only (`services/chain/asa.ts:117,128`) with no env-pinned
   ID — `755818217` appears only as free-text in source/docs (`shared/university/curriculum.ts`
   + several markdown docs), never as a config value. Update `ENV_VARS.md` + deployment checklist.
5. **M1-5 (funds)** `feat/mint-retry-delivery` — no atomic delivery/rollback: paid purchase
   whose background mint fails = ALGO consumed, no NFT, no refund, manual recovery
   (`routes.ts:2091-2098`); `attemptDelivery` one-shot (`routes.ts:2084`). Build mint-retry
   worker + refund-or-retry policy + surface custody/claim state in HUD. Full gates.
6. **M1-6** `chore/db-indexes-ratelimit` — indexes (migration 0013:
   `players.address`/`player_faction_id`), extend strict action rate-limiter to
   `/api/trade|markets|weapons|sub-parcels|factions`, middleware-binding coverage test.

**Month 2 — combat convergence + on-chain completeness**
7. **M2-1 (write)** `feat/weapon-damage-settlement` — W1, the biggest gameplay gap: weapon
   fire never damages plots; damage computed (`server/weapons/engagementStore.ts:156`) but
   never settled, `"impacted"` never set, no tick (roadmap Phase 8). 🚫 resolution math.
8. **M2-2 (write)** `feat/combat-convergence` — W3+W4: settled damage feeds plot state;
   badges credit on impact only (`service.ts:202-206`).
9. **M2-3** `feat/armory-loadout-polish` — W2 loadout wiring (persisted but never consulted,
   `service.ts:103` vs `:155`) + Armory UX ("FR"→"ASCEND" `ArmoryPanel.tsx:253`, hidden
   upgrade price, inverted radius, rail grid squeeze) + delete dead `BottomNav.tsx` +
   `/university` WalletProvider wrapper — **caveat (audit correction):** `university.tsx`'s own
   doc-comment says the missing wallet wrapper is deliberate (no wallet needed there, no
   chain/funds touched); confirm an actual failure mode exists before adding it.
10. **M2-4 (write)** `feat/subparcel-onchain-arc69` — ADR + impl: sub-parcels/upgrades are
    DB-only today; upgrade "anchor" is a detached admin self-transfer note (`upgrades.ts:28`)
    not tied to the plot ASA, and likely broken under algosdk v3 (Address-vs-string,
    `chain-services-audit.md`). Record via ARC-69 config notes on the parent plot ASA
    (roadmap Phase 26 has the full approach + rejected alternatives).
11. **M2-5 (write)** `feat/weapon-nft-claim` — W5: weapon-NFT mint completion, custody+claim
    parity with land NFTs (503 without `PUBLIC_BASE_URL`, `routes.ts:2644`).
12. **M2-6** `fix/ui-consistency-pass` — **audit correction:** the real clock-drift risk is
    `WarRoomPanel.tsx:29,154` using `Date.now()` against server-relative timestamps —
    `BattlesPanel.tsx` already correctly uses `serverNow()` (its lone `Date.now()` at line 194
    is an unrelated local-freshness check, leave it). Fix `WarRoomPanel` → `serverNow()`, link
    `/admin` in nav, `index.html` inline loading state.

**Month 3 — AAA security posture + launch path**
13. **M3-1** `docs/security-pass-ascend-claims` — `/security-pass` over the post-fix surface.
14. **M3-2** `test/browser-smoke-pack` — `/test-matrix` refresh + Playwright smokes.
15. **M3-3 (write)** `feat/nft-metadata-immutability` — ARC-19 + IPFS pinning (metadata/images
    are mutable + centrally hosted, `routes.ts:929`); mainnet ASA role ADR (admin keeps
    `manager`/`reserve` on mainnet, `land.ts:57-60`).
16. **M3-4** `chore/central-flag-module` — `shared/flags.ts` + CI guard that dev flags never
    coexist with mainnet (the `VITE_DEV_MODE`/`DEV_LOGIN_ENABLED` fly.toml exit path).
17. **M3-5** `docs/ui-master-design` — design-language consolidation + menus audit.
18. **M3-6** `docs/mainnet-gate-dryrun` — `/mainnet-gate` dry run; expected-FAIL list = final
    punch list; MVP definition signed.

Also still live (slot in where capacity allows): Mission Control v1 + kill switches
([`FRONTIER_FIRST_10_PRS.md`](./FRONTIER_FIRST_10_PRS.md)), `smoke:testnet` live run (needs
owner-funded wallet — also settles the `upgrades.ts` algosdk-v3 question), onboarding quest
chain, `?dashboard=1` flagship-dashboard vision, veritas watchdog deployment.

### Owner action items outstanding
- Fund session wallet `JD7CFMNMX4PO2HSJNRYBXUWR3W7YYLC5M3GMK4MEOCEWHZLAU2IKT7IKZA` (2–5 TestNet
  ALGO) for `smoke:testnet`.
- Decide P2: keep landing+game on separate origins (accept the second wallet connect) or unify
  origin / add session handoff (M1-3 writes the ADR options).
- Smoke tests still unconfirmed: tab-switching post-#178 on phone+desktop; gate audio +
  draggable plot panel on a real device.
- Decide the orphaned `artifacts/api-server` + `lib/*` island; prune ~140 dead remote branches.

### Open risks / honest flags
- The 2026-07-07 audit findings are **read-only exploration, not yet fix-verified**; each queued
  unit must re-confirm its file:line claims before coding (lines drift).
- Client changes still not browser-verified on-device — owner smoke-test on preview; sandbox has
  headless visual testing (`docs/HEADLESS_VISUAL_TESTING.md`).
- Pre-deploy reminders: migrations `0000`–`0012` applied; `VITE_TEST_GLOBE` reads `false`; keep
  `SESSION_SECRET` stable across deploys.
- **Do NOT unify `mem.ts`/`db.ts` game methods** — combat/economy divergence risk.
- Standing mainnet-gate item: `VITE_DEV_MODE` + `DEV_LOGIN_ENABLED` ship `'true'` in prod
  fly.toml — deliberate for TestNet; M3-4 is the exit path.
- **New backlog (2026-07-07, not queue-jumping M1-2):** owner asked about
  `ammaarreshi/Generals-Mac-iOS-iPad` (native C&C Generals iOS/macOS port) for reusable ideas.
  Nothing ports directly (different stack), but two real gaps found by grep, recorded in the
  master roadmap's backlog paragraph: **(G1)** no drag-box/long-press touch-select vocabulary on
  the globe (only single tap); **(G2)** zero `webglcontextlost`/`visibilitychange` handling
  anywhere in the client — the three.js globe likely goes black/frozen after a mobile tab
  backgrounds and never recovers (unconfirmed, owner should smoke-test). Both slot in "where
  capacity allows," same as the rest of the backlog — not started, not next-up.

### 🛑 HARD RULES / off-limits (absolute)
- No funds/ASA/transfer code toward mainnet without **`/mainnet-gate` PASS + `algo-auditor` pass**.
- **Don't merge `wip/atomic-purchase`**; nothing in `ops/kestra/` may point at mainnet.
- Don't reintroduce mock/demo data into plot/HUD surfaces (they are live, server-driven).
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- **Standing owner directive:** proceed without asking when approval is a foregone conclusion;
  still one-PR-at-a-time and HARD RULES remain absolute.
