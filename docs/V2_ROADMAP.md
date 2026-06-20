# FRONTIER v2.0.0 → v2.1.0 Buildout Roadmap

> **v2.0.0** is the current baseline (this doc + the version bump). **v2.1.0 = the GOLD /
> mainnet release.** Between them are **10 buildout phases**, worked **one small audited PR at a
> time** (the locked serial-PR rule still holds — creating the phase branches up front does NOT
> mean multiple open PRs). Grounded by three read-only audits (version+battle, globe/mapping,
> telemetry/realtime/clocks); see the dated session note.
>
> **Versioning:** app version lives in `artifacts/frontier-al/package.json` (now `2.0.0`).
> Phases increment toward `2.1.0`; the final mainnet cut tags `2.1.0`.

## Owner decisions locked (2026-06-20)
1. **Map = geo-reference REAL Earth** — parcels re-anchored to real lat/long + licensed
   satellite/3D-tile imagery + a snapshot→authenticate→prepare pipeline. Big epic, sequenced
   late, **licensing + legal/IP gated** (see Gates).
2. **"Telepathy" = an in-game INTEL mechanic** (fog-of-war / sensing / scouting) — gameplay, not
   metrics. Spec-first (its own phase).
3. **All 10 phase branches created up front.**
4. **Phase-1 opener = battle clock + auto-resolver.**

## Grounding facts (from the audits)
- Battle core is deterministic + atomic (`server/engine/battle/resolve.ts`, ~93% covered) **but
  the auto-resolver is not wired into startup** and timing is **wallclock-only (no server
  clock)** → client cooldown drift. UI exists (`BattlesPanel`, `ObserverLayer`); no replay/stats.
- WS layer is solid (dirty-flag flush, ping-pong, auth, per-viewer redaction) but lacks
  **exponential backoff, silent-failure telemetry, runtime toggles**.
- The globe is a **fictional planet** — parcels' lat/long are Fibonacci distribution math, **not
  Earth**; no map/geo deps; NFT images are static. Geo-referencing is a real re-anchoring epic.

---

## The 10 phases

| # | Phase / branch | Scope | Gate |
|---|---|---|---|
| 1 | **Battle timing core** · `phase/01-battle-clock` | Wire `resolveBattles()` into a startup interval (`initBattleResolver`) + a server-authoritative game-clock/tick; `battle_tick` countdown broadcast; server-checked cooldowns (kills client drift). Engine/realtime only — **no globe/canvas**. | PR-gate |
| 2 | **Battle depth** · `phase/02-battle-depth` | Deterministic battle **replay log** + stats + commander performance tracking (reuse pure `resolve.ts`). No canvas. | PR-gate |
| 3 | **Realtime hardening** · `phase/03-realtime-hardening` | WS exponential backoff + jitter, reconnect circuit-breaker, surface silent parse/callback failures as telemetry. ("no connection issues") | PR-gate |
| 4 | **Config + telemetry** · `phase/04-config-and-telemetry` | `/api/admin/config` runtime toggles + env-driven timings ("easy to toggle"); connection-health + battle-timing telemetry into the admin dashboard ("trackable, accurate, no leaks"). | PR-gate |
| 5 | **In-game intel ("telepathy")** · `phase/05-intel-mechanic` | Design-doc → build fog-of-war / scouting / faction-intel. New gameplay; **spec first** (strike-system-design precedent). | PR-gate (spec) → build |
| 6 | **Earth geo-ref foundation** · `phase/06-earth-georef-foundation` | DESIGN + data model to anchor parcels to real Earth lat/long; provider selection (Cesium/Mapbox/OSM/Sentinel); **licensing + legal/IP review**. No imagery yet. | **GATED** (legal/licensing) |
| 7 | **Earth imagery pipeline** · `phase/07-earth-imagery-pipeline` | snapshot → "authenticate"/provenance → prepare-for-environment processor; server-side image processing under the chosen license. | **GATED** (legal/licensing) |
| 8 | **2D/2.5D parcel map viewer** · `phase/08-parcel-map-viewer` | Google-maps-like parcel tracker + deep-zoom urban detail (three.js; reuse 3×3 sub-parcel LOD + camera fly-to); toggle globe↔map; FE/BE tie-in. | PR-gate + **scoped canvas audits** |
| 9 | **NFT imagery generation** · `phase/09-nft-imagery-gen` | Per-parcel NFT art from processed imagery + overlays (extend `/nft/metadata` image pipeline). | PR-gate |
| 10 | **Mainnet gold (v2.1.0)** · `phase/10-mainnet-gold` | Faction treasuries/wallets (from the #69 design doc) + deploy checklist → tag **v2.1.0**. | **`/mainnet-gate` + `algo-auditor` + `/security-pass`** |

Each phase is a milestone of **one or more small PRs**; the next phase's PR opens only after the
prior is merged.

## Phase 1 — first PR (after this v2.0.0 baseline merges)
`phase/01-battle-clock`: `initBattleResolver()` (startup `setInterval` → `storage.resolveBattles()`,
env-configurable cadence, `.unref()`, never throws — mirrors `ACTION_NONCE_PRUNE`); a server
clock/tick module; optional `battle_tick` WS broadcast for smooth countdown; cooldown/lock
availability checked server-side (not client `Date.now()`). Tests: interval wiring (fake timers),
clock determinism, no double-resolve (reuse the concurrency spec). **No globe/combat/canvas
change.** A tiny version-surfacing add (footer + `/api/version`) can ride along here.

## Gates / honest flags
- **Geo-reference Earth (Phases 6–9):** real-world imagery has commercial ToS
  (Google/Mapbox/Cesium), and minting NFTs of **real locations** raises legal / IP / privacy
  questions. **Phase 7 imagery work does not start until a licensing + legal review passes** —
  same discipline as the funds gate.
- **Funds (Phase 10):** `/mainnet-gate` + `algo-auditor` + `/security-pass`; testnet-only first.
- **HARD RULE:** globe/combat/canvas changes (Phase 8, parts of Phase 1) require scoped, audited
  units — no off-hand recolor/animation.
- **One PR open at a time** is preserved throughout.

## Parked / cross-cutting backlog (slots into phases, not separate tracks)
- **Commander-mint telemetry** (server-only, mirror land route `recordPurchaseTransition` onto
  `POST /api/actions/mint-avatar` `server/routes.ts:2109`) — small; slots into Phase 4.
- **jsdom / Testing-Library harness** — test-infra PR (adds devDeps); supports Phases 2/8.
- **Security/hardening:** rate-limit `/api/actions/*` (`/security-pass`); idempotency for
  `POST /api/sub-parcels/:id/build` (reuse `idempotencyGuard`); algod-first finality in
  `verifyAlgoPayment` (⚠️funds-gated) — fold into Phases 3/10.
- **Faction economy & commander progression** (`docs/design/faction-economy-and-commander-progression-design.md`):
  WS-A onboarding, WS-B/C commander progression+art, WS-D off-chain treasury, WS-E on-chain
  wallets (gated) — WS-E lands in Phase 10; the rest can slot into Phases 4–5.
- **Globe §6 `globeProjection.ts` seam** — lands with Phase 8 (the map viewer consumes it).
- **Story mode (Aether) Ch.1 dialogue + VO** — independent track; schedule between phases.
- **Hygiene:** remove the stale root `HANDOFF.md` duplicate; verify REC-004 ledger; the carried
  **#65 globe visual click-test** (owner-side).
