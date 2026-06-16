# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton
- **Branch:** `claude/multi-agent-dev-plan-rdpbfi` — **PR open, AWAITING AUDIT.**
- **Audit status:** `AWAITING_AUDIT` — globe **scope brief** unit. Doc-only.
- **What this chat did (for the auditor):** added
  `artifacts/frontier-al/docs/globe/SCOPE_BRIEF.md` (the baton's globe-scope unit) +
  a dated session note. **No code touched** — `client/`/`server/`/`shared/` unchanged.
  The brief inventories the globe, the server→globe WS data flow, the as-is interaction
  model (**coverage-sphere + O(n) nearest-neighbor snap, NOT a per-tile raycaster**),
  the **Fibonacci parity invariant**, perf cost drivers at 21k tiles, a **pluggable
  globe interface spec** (`worldToScreen`/`surfaceHit`) for the future combat package,
  and an audit-checkable exit definition for the next unit. Built by a 4-agent squad
  (safety/frontend/backend/finalizer); internal safety review = PASS.
  ⚠️ **Honest flag:** §4.1 reconciles an apparent conflict — the HARD RULE says
  "positions computed, never stored," but the **server seeds + persists** positions
  (`seeder.ts:191` → `parcels` table → `rowToParcel`) while the **client regenerates**
  them at runtime (`GlobeParcels.tsx:59`). Both true; that's *why* client≡server parity
  is load-bearing. **There is no parity test yet** — top item for the next unit.
- **Auditor TODO:** confirm diff is doc-only/additive; spot-check the parity-constants
  table (`server/sphereUtils.ts` vs `client/src/lib/globe/globeUtils.ts`+`globeConstants.ts`);
  confirm `worldToScreen`/`surfaceHit` truly absent in `client/src`; re-run the 3 checks.
- **Recent merges (newest first):**
  - **#38** — Aether's Journey Ch.1 **voice + music pipeline** (15 ElevenLabs VO lines,
    Sarah `eleven_v3`; 15s `title_intro` music on BEGIN; `audioEngine.speakLine`/`playMusic`
    with Web-Speech fallback). **MERGED** `3a1ef2e`. Includes a code-review pass
    (`69301fd`) fixing 4 audio bugs (VO race, double-voice overlap, finished-music
    replay, orphaned downloads) + centralized key redaction. ⚠️ **not audibly/browser
    verified** — spot-listen the clips.
  - **#39** — license-metadata + workspace-typecheck **hygiene**. **MERGED** `24e339b`.
    root→`UNLICENSED`, frontier-al→`"SEE LICENSE IN LICENSE"` + `private:true`;
    `mockup-sandbox` excluded from the aggregate typecheck so root is green.
  - **#37** Aether Phase-1 verify/harden — **MERGED**. **#36** Phase-1 base — **MERGED**.
- **Other origin branches (untouched, FYI):** `test/gamelayout-entry-state` (another
  agent's experiment — unknown), `wip/atomic-purchase` (**OFF-LIMITS — do not merge**).

## Repo state (verified this chat)
- `pnpm run typecheck` (root) → **green** (mockup-sandbox excluded).
- `pnpm --filter @workspace/aether-journey check` + `build` → **green**.
- `pnpm --filter @workspace/frontier-al check` → green; `test:server` → **244/244 pass**.
- three.js is **code-split** (three ~687 kB + r3f ~369 kB chunks) — the old
  "single ~1.1 MB chunk" risk is **resolved**.

## NEXT chat — the globe (build unit; scope brief now DONE)
- **Read first:** `artifacts/frontier-al/docs/globe/SCOPE_BRIEF.md` (this chat's unit).
  It is the exit-definition + invariant guard for all globe work. The globe lives at
  `artifacts/frontier-al/client/src/components/game/globe/**` and is real, server-driven.
- **Recommended next unit (one PR, additive):** `perf/globe-pick-index` — replace the
  O(n) `nearestPlot` scan (`GlobeParcels.tsx:100–109`) with a spatial index behind the
  **same signature**; land `client/src/lib/globe/globeProjection.ts` (the brief's §6
  `worldToScreen`/`surfaceHit` seam) as its first real caller; **add the missing
  client≡server Fibonacci parity test** (§4.1/§7). No render-output change.
- **Alternative next unit:** `feat/globe-mission-layer` — additive overlay mounted by
  `PlanetGlobe`, render core untouched, any new schema columns additive+nullable.
- **Later track (per user):** the master-prompt **wave-combat game** lands in a NEW
  isolated package `@workspace/frontier-combat`, phase-by-phase (cold-open → 5 enemy
  archetypes → new turrets → parallax + super-combo), integrating the real globe ONLY
  through the §6 interface. Never edit the globe render core off-hand.
- **Queued — story mode (one unit each):** reconcile
  `apps/aether-journey/src/data/dialogue.ts` to the §11 Ch.1 script + assign `voiceId`
  to the remaining 14 VO lines (only proof line `ch1_s13_aether_01` is wired today);
  voice-regen CI workflow (needs repo secrets `ELEVENLABS_API_KEY` + a bot token).
- **Queued — frontier-al (carried):** `feat/hud-desktop-nav`; v11 glass info panels on
  real data; `feat/rate-limit-actions`; idempotency for `/api/sub-parcels/:id/build`;
  algod-first finality in `verifyAlgoPayment` (**funds → `algo-auditor` + `/security-pass`**).

## Open risks / honest flags
- ⚠️ **Aether's Journey NOT audibly/browser-verified** — typecheck/build/generator only.
  Spot-listen the VO (esp. `ch1_s13_aether_die_01`); `eleven_v3` is alpha and the takes
  are first-pass (recasting Sarah invalidates all 15 clips).
- ⚠️ **REC-004 `AGENT_ORCHESTRATION_LEDGER.md` still ABSENT on `main`** (PR #35 that
  recreated it was closed). Confirm/restore before relying on it.
- ⚠️ **Duplicate baton:** a stale root `HANDOFF.md` (#37-era) still sits beside this
  canonical `docs/HANDOFF.md`. Treat **`docs/HANDOFF.md` as authoritative**; clean up the
  root copy in a later unit.
- (Carried, frontier-al) replay protection lasts the TTL; no rate limit on
  `/api/actions/*`; migrations `0000`–`0006` before deploy; `verifyAlgoPayment` finality
  is indexer-only; confirm `VITE_TEST_GLOBE` reads `false` before deploy.

## Off-limits
- The globe is now an **active focus**, but only via a **scoped unit** — do not change
  globe/combat/canvas behavior off-hand. No funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; do not merge `wip/atomic-purchase`; nothing in
  `ops/kestra/` may point at mainnet. Do not reintroduce mock/demo data into plot/HUD
  surfaces.
