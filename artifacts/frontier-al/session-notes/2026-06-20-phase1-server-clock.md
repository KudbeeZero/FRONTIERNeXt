# 2026-06-20 — Phase 1 (battle clock) PR1: server-authoritative time sync

## Unit
v2.0.0 buildout **Phase 1** (`phase/01-battle-clock`), first PR. Goal: drift-free, trackable
battle timing.

## Audit correction (important)
The pre-plan audits claimed "the battle auto-resolver isn't wired into startup." **That is
wrong** — reading the code, `resolveBattles()` already runs on a hardcoded `setInterval(…,
15000)` (`server/routes.ts:2895`) that broadcasts `battle:resolved` + `markDirty()` (alongside
AI-turn 20s and orbital 5min intervals). So wiring a resolver would have been a **redundant fix
for a non-problem** — not built.

The **real** gap: there is no server time on the wire, and the client computes the battle
countdown from its own `Date.now()` (`BattlesPanel.tsx:31`) vs the server's `resolveTs` — so a
skewed device clock makes every battle timer wrong. This PR fixes that (the genuine "battle
clock").

## What shipped (server-only routes/ws + a contained HUD fix)
- **`client/src/lib/serverClock.ts`** (NEW, pure) — `computeOffsetMs` / `setServerTime` /
  `serverNow` / `getOffsetMs`: keep the server↔client offset, expose `serverNow()`.
- **`server/wsServer.ts`** — send `{type:"time_sync", serverTime}` on connect + every 25s in the
  ping loop.
- **`server/routes.ts`** — `GET /api/time` → `{ serverTime }` (HTTP fallback; no auth/state).
- **`client/src/hooks/useGameSocket.ts`** — on `time_sync`, `setServerTime(msg.serverTime)`.
- **`client/src/components/game/BattlesPanel.tsx`** — countdown `now` uses `serverNow()` instead
  of `Date.now()`. (HUD number only — no globe/canvas/combat-resolution change.)
- **`client/tests/serverClock.spec.ts`** (NEW) — +5 pure tests (offset sign, non-finite fallback,
  applied offset, no-skew identity, latest-sample-wins).

## Scope / safety
Additive: a new pure util + a tiny GET route + two WS sends + one client message handler + a HUD
countdown using corrected time. **No** combat-resolution logic change, **no** globe/canvas render
change, **no** schema/funds/deps. The battle resolver + atomicity are untouched.

## Verification
`check` ✓ · client `test` **76 pass** (was 71; +5) · `test:server` **288 / 11 skipped**
(unchanged) · `build` ✓.

## Follow-ups (still Phase 1)
- Apply `serverNow()` to commander/morale/attack cooldown availability checks (same drift class).
- Make the battle/AI/orbital background cadences env-configurable ("easy to toggle").
- Optional `battle_tick` broadcast for sub-flush-interval smooth countdowns.
