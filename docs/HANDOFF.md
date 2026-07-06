# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — ⏳ PR **#177** (battle/commander/menu refactor) · branch `feat/battle-menu-architecture-refactor` · merge-on-green

**Owner `/goal` (2026-07-06): refactor the battle/commander architecture and the whole menu
system, keep the NFTs, and make sure battles are actually working.** Plan doc —
[`artifacts/frontier-al/docs/BATTLE_MENU_REFACTOR_PLAN.md`](../artifacts/frontier-al/docs/BATTLE_MENU_REFACTOR_PLAN.md) —
from a fresh read-only audit. Key finding: server battle math (`resolve.ts`) is already clean and
well-tested — leave it alone. The real target is `GameLayout.tsx`'s **three parallel rendering
paths** for the same panel set (mobile fullscreen `activeTab`, desktop rail `desktopRightTab`,
and a flag-gated dashboard-canvas widget map — not just two as first thought).
**Shipped in this PR so far:**
- **Phase A step 1 (code):** the off-by-default dashboard-canvas widgets now derive from one
  `dashboardPanelRegistry` array instead of a third hand-rolled copy of every panel's props.
  Desktop rail + mobile fullscreen deliberately untouched — real per-context differences found
  (sizing classes, wrapper divs for Armory/University) mean a naive shared-registry reuse would
  break desktop layout; that migration needs a render-factory registry shape and is its own
  careful follow-up unit (documented in the plan doc), not rushed alongside this lower-risk step.
- **Phase C (code):** broadened the CI coverage gate — `replayLog.ts`/`verify.ts`/`tuning.ts`/
  `random.ts` had spec files but weren't enforced; now they are (94.02% lines/79.9% branches,
  still clear of 80/70). **Found `server/engine/ai/reconquest.ts` (AI faction attacks) has ZERO
  test coverage** — did not add it to the gate (would falsely dilute-pass); documented as an
  honest gap in `COVERAGE_GATE.md` needing its own test-writing unit.
- **Still open:** Phase B (consolidate the ~11-file battle-watching UI sprawl), the desktop-rail/
  mobile registry migration, and writing tests for `reconquest.ts`.
NFT mint/transfer code and combat math are explicit non-goals — see the plan doc's §0/§3.
**Also this session: fixed a real, month-old production bug** — wallet login on
frontierprotocol.app spawned ~12 popups and redirected to fly.dev (see #175/#176 below, both
merged+deployed). Owner confirmed the popup storm is gone; the "developer account with no ALGO"
report that followed is very likely just an unfunded real TestNet wallet (confirmed `VITE_DEV_MODE`
is off in the live bundle) — owner needs to fund the connected wallet via a TestNet faucet.

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
