# Security pass — Living Map PR1 (live world-event telemetry boxes)

- **Date:** 2026-06-20
- **Branch / PR:** `feat/living-map-events` → `main`
- **Scope reviewed:** `client/src/lib/globe/liveEventDisplay.ts`,
  `client/src/components/game/globe/GlobeLiveEvents.tsx`, and the one-line mount in `PlanetGlobe.tsx`.
- **Verdict:** **PASS** — no findings.

## Checklist (client-only, read-only display)

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Auth boundaries | ✅ n/a | Client overlay; no routes/mutations added. |
| 2 | Wallet / signature | ✅ n/a | Untouched. |
| 3 | Input validation | ✅ ok | Consumes `WorldEvent`s already received on the WS bus (same as ActivityFeed). `liveEventDisplay` guards missing `metadata.outcome`/`plotId`; renders only a label string. |
| 4 | Rate limits / DoS | ✅ ok | No new network. The overlay caps to 8 concurrent boxes (`MAX_BOXES`) with a 6s TTL; subscription `unsub` + `clearTimeout` on unmount — bounded work. |
| 5 | Secrets handling | ✅ ok | None; no env. |
| 6 | CORS + headers | ✅ n/a | Unchanged. |
| 7 | Transaction / finality | ✅ n/a | No chain/economy code. |
| 8 | Replay / idempotency | ✅ n/a | Display-only; dedups boxes by event id. |
| 9 | Admin endpoints | ✅ n/a | None. |
| 10 | Logs leaking secrets | ✅ ok | Boxes display only already-public data — `plotId` + battle outcome (same as the ActivityFeed + `GlobeEventOverlays`). The raw `event.id` is used as a React key only, never rendered; no wallet addresses or player UUIDs shown. |
| 11 | Dependency risk | ✅ ok | No new deps (`three`, `@react-three/drei`, `@shared/worldEvents` already used). |

## Notes
- **Fairness:** only events the player already receives on the world-event bus are drawn — this adds no
  information the ActivityFeed didn't already show; it just places it spatially.
- **HARD RULE (globe/canvas):** additive overlay layer, no change to existing globe/combat render
  behavior; `VITE_TEST_GLOBE` untouched. Visual appearance is **owner-verified** (not browser-tested in CI).
