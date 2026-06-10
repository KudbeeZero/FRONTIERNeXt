# NIGHT QUEUE

Rated backlog for the autonomous night shift. Written by `/handoff`, consumed by
`/night-shift` top-tier-first. Protocol: `docs/protocols/OVERNIGHT_HANDOFF_PROTOCOL.md`
(repo root). Ratings: **HR** = Highly Recommended, **R** = Recommended,
**EXP** = Experimental.

**Handoff date:** 2026-06-10 · **Source state:** PROJECT MEMORY §4 (working queue)

| # | Item | Rating | Status | Description | Source | Branch |
|---|------|--------|--------|-------------|--------|--------|
| 1 | Pera wallet 1.4.2 → 1.5.2 | HR | ✅ done (`claude/night/wallet-update`) | Bump `@perawallet/connect` in package.json; `pnpm check` verifies. Mechanical, supply-chain age gate already passed. | MASTER LUT P1 · PM §4 Pri 3 | `claude/night/wallet-update` |
| 2 | gameConfig.ts tunables module | HR | ✅ done (`claude/night/game-config`) | Create `server/config/gameConfig.ts` exporting typed `GAME_CONFIG` (parcel/sub-parcel costs, scan, fees, archetype build costs). Additive only — wire new consumers, no refactor, no DB. | DORMANT §7 + MASTER A3 · PM §4 Pri 9 | `claude/night/game-config` |
| 3 | Prediction markets nav wire-up | HR | ✅ verified already shipped (no code) | Verify `PredictionMarkets.tsx` is reachable from the game menu (add nav entry if missing) and that `resolveExpiredMarkets()` runs on a timer. Plumbing only; backend is 100% done. | DORMANT §1.2 | `claude/night/markets-nav` |
| 4 | Season HUD banner | R | unstarted | `client/src/components/game/SeasonBanner.tsx`: season name, time remaining, prize pool, top-3 — consuming existing `getCurrentSeason()` via TanStack Query. UI only. | DORMANT §1.3 | `claude/night/seasons-hud` |
| 5 | Chat backend (global + faction) | R | unstarted | WS chat channels on existing `wsServer.ts`: Redis ring buffers, sanitization, rate-limit stubs. Backend only. Soft dependency on wallet auth — use `req.session?.playerId` with graceful null-fail. | LIVING WORLD §1 | `claude/night/chat-backend` |
| 6 | Globe color fix + lighting pass 1 | EXP | unstarted | Three fixes from GLOBE LUT §5–6 (fingerprint dep, three-point lighting, emissive fill). **Verify first:** commit `b48f6f6` (fingerprint hardening) may have already fixed item 1 of 3 — re-scope before building. Three.js judgment required; visual result not machine-verifiable. | GLOBE §5–6 · PM §4 Pri 8 | `claude/night/globe-visual` |

## Not queued (and why)

- **Railway deploy, Neon/SESSION_SECRET rotation** (PM §4 Pri 1–2): infra + secrets — guardrail-excluded, day shift only.
- **Wallet signature auth / session identity refactor** (Pri 5–6): MAINNET GATE, architectural — needs human review.
- **Split routes.ts** (Pri 4): large refactor with high day-shift conflict risk.
- **Sub-parcel UI** (Pri 7): highest ROI but big and design-heavy — flagged as a morning decision (do as day-shift pairing, or queue a night slice?).
