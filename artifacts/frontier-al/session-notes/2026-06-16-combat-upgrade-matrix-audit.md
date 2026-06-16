# 2026-06-16 — Combat + Upgrade Matrix Audit (read-only)

**Branch:** `claude/combat-upgrade-matrix-2a3gl2`
**Type:** READ-ONLY audit — docs only, no game code changed, no PR opened.

## What this session did

Audited the battle engine, weapons, land/parcel upgrades, parcel unlocks, and combat UI,
then produced the requested truth tables + audits under
`artifacts/frontier-al/docs/design/`:

- `battle-weapons-matrix.csv` (38 weapons), `battle-weapons-audit.md`
- `land-upgrades-combat-matrix.csv`, `land-upgrades-combat-audit.md`
- `battle-engine-audit.md`, `combat-ui-audit.md`, `tactical-window-research.md`
- `frontier-combat-upgrade-master-matrix.csv` + `.md`
- `first-playable-combat-loop.md` (proposed scope, NOT approved)
- `COMBAT_AUDIT_REPORT.md` (consolidated final report + baton)

## Headline finding

Two parallel combat systems that are **not connected**:
1. Invasion engine (`server/engine/battle/resolve.ts`) — fed by troops/resources/
   commander vs defenseLevel/improvements/biome. Land upgrades + commanders feed THIS.
2. Weapon engine (`shared/weapons/**`) — 38 specs + ballistics + interception + globe FX,
   driven by `/armory` and `/api/weapons/fire`.

Weapon `damage` is **not** an input to the invasion engine, and the weapon→parcel impact
path is **NOT VERIFIED** — so firing is currently FX + an ASCEND sink.

## Other verified findings

- `WeaponSpec` has **no `description` field** (only name + realWorldRef) → all 38 weapons
  read as MISSING description.
- Weapon prices are NOT missing (fire cost per spec; unlock ×6, upgrade ×3×tier, deploy ×4).
- `data_centre` (yield) and `ai_lab` (cooldown) facilities are **not wired** into runtime.
- No in-game fire button (route exists), no deploy-defense UI, no 2D tactical window.

## Verification

- Re-read and confirmed `resolve.ts`, `tuning.ts`, `weapon-economy.ts`, `catalog.ts`,
  and all 4 weapon spec files directly. CSV numbers come from those files.
- Did NOT run the test suite this session (no code changed).

## Process notes / flags

- A separate PR (`claude/multi-agent-dev-plan-rdpbfi`) is AWAITING_AUDIT. This unit is
  doc-only and intentionally opens **no** PR to respect one-open-PR-at-a-time. The user
  also asked for read-only audit first, approval before implementation.
- Next unit (when approved): `feat/first-playable-combat-loop` per the design doc.
