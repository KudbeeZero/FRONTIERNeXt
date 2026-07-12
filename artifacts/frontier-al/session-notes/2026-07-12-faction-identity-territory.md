# 2026-07-12 — Faction-identity / territory foundation (PR #256)

**Unit:** Phase 1 of the faction-membership / economy foundation — make an authenticated
human player's persisted faction correctly affect owned-plot attribution, faction
territory totals, globe coloring, and ally/enemy/neutral classification.

**PR:** [#256](https://github.com/KudbeeZero/FRONTIERNeXt/pull/256) — `feat/frontier-faction-identity-territory`
**Merge commit:** `5f0989a` (squash-merged 2026-07-12T16:34:02Z)
**Deploy:** Fly `Deploy to Fly` run #29200366134 — green (flyctl deploy 3m17s)
**CI:** Typecheck & server tests ✅ · Cloudflare Pages ✅

## What changed

- **`shared/factionIdentity.ts`** (new, pure): canonical server-authoritative helpers:
  - `resolvePlayerFaction(player)` — no owner→neutral; AI canonical faction account
    (name===faction id)→that faction; human with `playerFactionId`→that faction; human
    w/o→neutral. **Human faction is NEVER inferred from a display name.**
  - `resolveParcelFaction(parcel, ownerPlayer)` — neutral when unowned; otherwise the
    owner's effective faction.
  - `classifyRelationship(viewer, other)` — `ally` | `enemy` | `neutral` (future Battle
    Planner targeting). Pure + deterministic.
  - `computeFactionTerritory(parcels, playersById)` — aggregates owned parcels to their
    effective faction (DB-free, unit-tested directly).
- **`server/routes.ts` `/api/factions`** — territory totals now use
  `computeFactionTerritory` over **all** players, so human members' parcels count
  (defects #1/#5). AI territory still counted. `memberCount` unchanged (humans only).
- **`server/storage/db.ts` + `server/storage/mem.ts` `getGameState()`** — attach
  `LandParcel.effectiveFaction` (nullable) to every parcel. Computed at serialization;
  **not stored** (no migration).
- **`shared/schema.ts`** — `LandParcel.effectiveFaction?: PlayerFactionId | null`.
- **`client/src/lib/globe/globeUtils.ts` + `GlobeParcels.tsx`** — `getPlotColor` now takes
  the server-derived `effectiveFaction` and colors owned plots via `factionColor`
  (defect #2). Unaligned owners keep the legacy enemy tint; the viewer's own plot keeps
  the player color. Fingerprint updated so a faction switch repaints.

## Verification

- `pnpm run check` (tsc) clean; `pnpm run build` clean.
- Tests: `shared/factionIdentity.spec.ts` (16), `server/storage/factionTerritory.mem.spec.ts`
  (2), `client/tests/globe-faction-color.spec.ts` (5); mem `gameplay-loop` (8) still green.
- Production (post-deploy):
  - `/health` 200 · `/readiness` 200.
  - `/api/factions` 200, 4 factions; KRONOS/VANGUARD include human members (territory
    >0 where the member owns land; 0 where they own none — no false counting).
  - `/api/game/state` payloads carry `effectiveFaction` (live: 759 attributed —
    NEXUS-7 360 / KRONOS 54 / SPECTRE 338 / VANGUARD 7; 20,241 neutral).

## Safety

- **No migrations.** No wallet / funds / ASA / chain / mainnet code touched.
- **No battle resolver, no AI-behavior, no faction-treasury changes.**
- Faction attribution is server-derived only; the client never supplies it.

## Out of scope (future work)

- Faction treasury / equity / contribution ledger / leadership / full faction economy.
- Battle Planner + Battle Target Selector.
- Human mining / building / combat / finance faction-aggregation.

## Next lane

**Battle Target Selector** (Battle Planner pre-cursor) is the next permitted feature
lane, after owner verifies the faction-identity UI (persisted faction, human-owned
parcel faction color, territory reflecting human land).
