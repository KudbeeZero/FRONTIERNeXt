# 2026-07-06 — Faction single-source-of-truth (persist to the ALGO account)

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #202
merged) · **Unit:** owner /goal — "claiming a faction / the faction button + the
Factions menu don't link together and don't stay globally with the user; it needs
to stay in their ALGO account." A dispatched research agent traced the whole
faction flow; this fixes the confirmed divergence.

## What the research found (verdict: owner substantially correct)

The faction DOES persist durably: `players.playerFactionId` + `factionJoinedAt`,
keyed by wallet `address` (`db-schema.ts:191/229/231`), written by
`POST /api/factions/:name/join`, read back via `/api/game/state` scoping. The
**top-of-menu badge** (`TopBar.tsx`) and the **Factions panel**
(`FactionPanel.tsx`) both read this authoritative server value correctly.

**But two surfaces read a separate, unsynchronised localStorage key** and never
reconcile with the account record:
- **The faction-select entry gate** (`FactionSelectGate.tsx:41`) decided
  visibility purely from `chosenFaction()` (localStorage). On a new device with
  empty localStorage it **re-prompted a player who had already claimed a faction**
  on their wallet record — the exact "doesn't stay with the user" symptom.
- **`ObjectiveHud.tsx:40`** reads `chosenFaction()` for the rival readout.
- `FactionPanel` switch/leave wrote the DB but **never updated localStorage**;
  `clearFaction()` was **dead code (zero callers)**, so leaving a faction left the
  gate permanently dismissed and the HUD showing the old rival.

(Security note: the research initially flagged the join/leave endpoints as an
IDOR, but a closer read — corroborated by the parallel DB-health audit — confirmed
the global mutation middleware (`routes.ts:599-619` + `evaluateOwnership`) already
binds the body `playerId` to the session when `WALLET_AUTH_REQUIRED` is on (the
production default). So this unit is **persistence/UX only**, not a live security
fix. A separate defense-in-depth item — route faction join/leave through
`assertPlayerOwnership` like every other mutating endpoint — is noted for later.)

## The fix — localStorage becomes a faithful cache of the authoritative server record

- `client/src/lib/factions.ts` — three new pure, tested helpers:
  - `asPlayerFactionId()` — sanitise an arbitrary server string to a known faction.
  - `resolveEffectiveFaction(server, local)` — **the server record always wins**;
    local is only a pre-auth fallback.
  - `shouldShowFactionGate({server, local})` — never gate when the account already
    has a faction (even on a fresh device); only fall back to local memory when the
    server has none.
- `FactionSelectGate.tsx` — on mount, best-effort `GET /api/auth/me`; if the
  authenticated account already has a faction, seed the localStorage cache and skip
  the gate. A returning wallet on a new device now sees the faction stored in their
  ALGO account instead of being re-prompted. Falls through silently (401) for a
  not-yet-connected visitor, preserving the pre-auth behaviour.
- `FactionPanel.tsx` — join `onSuccess` now calls `chooseFaction(factionName)` and
  leave `onSuccess` calls `clearFaction()` (wiring up the previously-dead helper),
  so the cache the gate + HUD read never diverges from the account after a
  switch/leave. `ObjectiveHud` needs no change: with the cache kept faithful, its
  localStorage read now tracks the server value.

## Tests

`client/tests/factions.spec.ts` — 8 new cases (13 total in the file): the
server-wins resolution, the "never re-prompt an already-claimed account on a new
device" gate rule, and the sanitiser. All green.

**Verification:** tsc clean · client **285** (278 + 7 new) · production build green.
Server suite untouched (446/14 skipped).

**Honest gap:** the gate's `useEffect` rehydration and the panel `onSuccess`
localStorage writes are typecheck/build-verified only — the client suite is
SSR-only (no jsdom, no real fetch), so the wiring isn't exercised by a test, same
as every other client fetch-effect in this codebase. The pure decision logic that
determines correctness IS fully tested. Owner should confirm on a real second
device: claim a faction on device A, open the game on device B with the same
wallet — device B should drop straight in without the faction gate.

## For the next session (HIGH PRIORITY — from the parallel DB-health audit)

The database-health research agent found **real concurrent double-spend bugs** that
match the owner's "nothing gets lost or repeats itself" concern — these jump the
queue ahead of the remaining feature work:
1. **`fillTradeOrder`** (`db.ts:2281`) — concurrent double-fill transfers resources
   twice (no `FOR UPDATE`, mark-filled keys only on `id`). CRITICAL.
2. **`claimWinnings`** (`db.ts:3278`) — not in a transaction at all; concurrent
   double-claim pays out twice. CRITICAL.
3. **`grantWelcomeBonus` + login** (`routes.ts:444`) — concurrent logins can enqueue
   the on-chain 500-ASCEND transfer twice (real funds). BUG.
4. **`placeBet`** (`db.ts:3216`) — non-atomic, concurrent double-credit. BUG.
The fix pattern already exists in the repo: `openLootBox`'s txn + `FOR UPDATE` +
conditional `UPDATE … WHERE &lt;not-done&gt; RETURNING` + rowCount bail. Each wants a
fail-before/pass-after concurrency test mirroring `lootbox.db.spec.ts`.
Quick wins also queued: `players.address`/`player_faction_id` indexes (migration
0013); extend the strict action rate-limiter to `/api/trade|markets|weapons|
sub-parcels|factions`. Plus the still-pending feature research (commander garrison,
Armory rework, plot-satellite view + globe color layers).
