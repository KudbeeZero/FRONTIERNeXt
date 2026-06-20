# 2026-06-20 — Comm Terminal (purchasable whisper widget + optional voice)

## Unit
Owner goal: a purchasable HUD widget — a "Comm Terminal" — that surfaces eerie ambient
"lost souls of the world" whispers only its owner hears, with optional voice. Build it key-optional
(no ElevenLabs key in this env → text-only + graceful fallback). Ties toward the faction
**perception-lens** vision (SD-F).

## What shipped
**Server (deterministic core, fully tested):**
- `server/engine/narrative/whispers.ts` (NEW) — pure `generateWhisper(playerId, now, {level})`: seeded by
  (playerId, ~45s window) so each player hears their *own* stream, stable within a window, higher terminal
  level → more clear/surge transmissions. Pure atmosphere (no hidden game state, fair-play). Also pure
  `commTerminalLevel(parcels, playerId)` ownership/level helper. +8 tests.
- `server/services/voice/elevenlabs.ts` (NEW) — optional `synthesizeWhisper(text)`: returns `null`
  (text-only) with **no network call** when `ELEVENLABS_API_KEY`/`COMM_TERMINAL_VOICE_ID` unset, and
  fail-open (null) on any error. Mirrors the aether pipeline; injectable fetch for tests. +6 tests.
- `shared/schema.ts` — new `comm_terminal` facility (`FacilityType` + `FACILITY_INFO` cost [150,320,540],
  maxLevel 3, prereq electricity; + `IMPROVEMENT_INFO`, `SUB_PARCEL_FACILITY_COSTS`, `buildActionSchema`
  enum). Purchases via the existing `/api/actions/build` flow (ASCEND sink) — no new build logic.
- Storage `getPlayerCommTerminal(playerId)` — interface + db (owner-indexed parcels) + mem.
- `GET /api/comm-terminal/whispers?playerId=` — gates on ownership; returns the player's current whisper
  (+ optional `audioUrl` data-URL when voice configured, else null) + `voiceConfigured`.

**Client:**
- `client/src/components/game/CommTerminal.tsx` (NEW) — self-contained floating widget: polls the
  endpoint (15s), **self-hides for non-owners**, reveals whispers with intensity styling, an animated SVG
  "signal entity" placeholder (not a stock image), mute toggle, and plays `audioUrl` when present.
- Mounted in `GameLayout.tsx` with `playerId={player?.id}` (one line; widget handles its own gating).
- `client/tests/comm-terminal.spec.tsx` — SSR smoke (renders nothing/no-crash pre-unlock). +2.

## Scope / safety
Additive. New facility = an ASCEND sink via the existing build path (no ASA/funds movement). Voice is
best-effort + key-optional (no secret committed; no network without a key). No globe/canvas/battle-math
change. **Client widget is NOT visually verified in a browser here** — typecheck + build + SSR smoke back
it; the deterministic logic is server-side + tested.

## Verification
`check` ✓ · `test:server` **332/11-skip** (+14: whispers 8, voice 6) · client `test` **78** (+2) ·
`build` ✓. Env (`ELEVENLABS_API_KEY`, `COMM_TERMINAL_VOICE_ID`) documented in `ENV_VARS.md` +
`DEPLOYMENT_ENV_CHECKLIST.md`.

## Gates (owner-requested cadence)
`/code-review` · `/security-pass` (→ `docs/audit/`; secrets handling for the voice key, whisper feed is
client-served — confirm no leak) · `/pr-gate`.

## Note (process)
The design-doc PR (#78) is still open; the owner directed this build in parallel via `/goal` (explicit
approval to proceed alongside). Flag to owner: two PRs open — merge #78 when ready.

## Follow-ups
A DOM-harness test for the unlocked widget; wire the whisper tone to faction lean (SD-F perception lens);
let surges optionally reference real regional/economic events once SD-C/SD-E land.
