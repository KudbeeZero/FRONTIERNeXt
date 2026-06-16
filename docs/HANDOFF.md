# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton
- **Branch:** `main` — **clean. No open PRs.** `main` @ `3a1ef2e`.
- **Audit status:** `IDLE` — nothing awaiting audit. Safe to start the next unit.
- **➡️ NEXT CHAT STARTS HERE:** scope the **globe** (the new focus). See "NEXT chat".
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

## NEXT chat — the globe
- **Direction (per user):** the story-mode prologue (voice/narrative) is in motion;
  **focus now shifts to the globe** —
  `artifacts/frontier-al/client/src/components/game/globe/**` (~2,064 LOC:
  `GlobeParcels`, `GlobeEvents`, `GlobeHUD`, `GlobeTerrain`, `GlobeAtmosphere`,
  `StarField`, `LiveWeaponLayer`, `ObserverLayer`). It is **real and server-data-driven**,
  not a placeholder.
- **Recommended first unit:** a **globe scope brief** — capture current capabilities +
  the target end-state (mission layer? interaction model? perf at parcel scale?) before
  branching, so globe work has an exit definition. Then one focused unit
  (e.g. `feat/globe-mission-layer` or a perf/instancing pass) — small targeted diffs,
  never a wholesale rewrite.
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
