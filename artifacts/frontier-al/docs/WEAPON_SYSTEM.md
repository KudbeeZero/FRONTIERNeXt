# Weapon System — Architecture & Reference

Durable reference for the FRONTIER weapon system (added on
`claude/weapons-system-architecture-hl2jhs`, PR #9). Pairs with the dated
`session-notes/2026-06-10-weapon-system-phase1.md` (chronology/handoff).

## Overview

A realistic arsenal + NBA-2K-style progression, wired into the live game. Players
allocate an attribute budget (with a tradeoff curve), which derives an archetype
and badge tiers; badges gate which weapons can be unlocked, upgraded, equipped,
fired (with real ballistics), and intercepted by deployed missile-defense.

## Layout (clustered `weapons/` namespace per layer)

```
shared/weapons/          pure, imported by client + server
  types.ts               WeaponCategory, WeaponSpec, DefenseSpec, InterceptEnvelope
  scale.ts               KM_PER_GAME_UNIT, PLANET_RADIUS_KM, great-circle + slerp
  missiles.ts            12 missiles (ballistic / cruise / hypersonic)
  artillery.ts           12 artillery (towed / rocket / MLRS)
  antiAir.ts             anti-aircraft interceptors
  defense.ts             layered missile-defense batteries (+ intercept envelope)
  catalog.ts             ALL_WEAPONS registry, lookups, validateCatalog()
  attributes.ts          point budget + tradeoff curve (effectiveAttributes)
  archetypes.ts          named builds, deriveArchetype()
  badges.ts              WeaponStats, Bronze→Gold→Hall-of-Fame, computeBadges()
  unlocks.ts             resolveUnlockedWeapons / resolveUnlockedAnimations
  ballistics.ts          timeOfFlightMs, apexAltitudeKm, positionAt, inRange
  intercept.ts           solveIntercept (radar+geometry+Pk) + rollIntercept (seeded)
  profile.ts             PlayerWeaponProfile, OwnedWeapon, Zod action schemas
shared/weapon-economy.ts fire/unlock/upgrade/deploy ASCEND cost tables (TEST/PROD)

server/weapons/
  engagementStore.ts     RUNTIME layer: in-flight projectiles + batteries; layered
                         interception; active()/prune() lifecycle; process singleton
  service.ts             orchestrates storage + economy + engagement store
server/services/chain/weapon.ts   custody NFT mint (mirrors commander.ts)
server/storage/{interface,db,mem}.ts   weaponProfile get/update + spendFrontier
server/db-schema.ts      players.weaponProfile jsonb column (nullable)
server/routes.ts         /api/weapons/* + /nft/metadata/weapon/:id

client/src/components/game/
  weapons/{WeaponProjectile,WeaponScene,ImpactBurst,fxUtils,WeaponSandbox}.tsx
  globe/LiveWeaponLayer.tsx          mounted in PlanetGlobe beside GlobeEvents
  armory/ArmoryPanel.tsx             the Armory UI (TanStack Query vs live API)
client/src/pages/armory.tsx          authenticated /armory route
client/src/hooks/useGameSocket.ts    onWeaponEngagement WS bus
client/weapon-sandbox.html + src/weapon-sandbox-entry.tsx   dev FX sandbox
```

## Data model

- **PlayerWeaponProfile** (persisted as `players.weaponProfile` jsonb): raw
  `attributes`, derived `archetypeId` + `badges` + `unlockedAnimations`,
  `ownedWeapons[]` (`{id, specId, upgradeTier, nftAssetId?}`), `loadout[]`, `stats`.
  Derived fields are recomputed on every write via `recomputeDerived`.
- **WeaponSpec** carries both realism fields (rangeKm, speedMps, flightProfile,
  guidance, cepM) and game-scaled fields (damage, splashRadius, cooldownMs,
  costFrntr), plus `attributeAffinity` and `unlock:{badge,tier}`. Defensive specs
  add an `intercept` envelope.

## API (all behind `assertPlayerOwnership`; uses verified playerId)

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/weapons/catalog?playerId=` | full catalog annotated unlock/own + costs |
| POST | `/api/weapons/build` | set attribute allocation (validated vs budget) |
| POST | `/api/weapons/unlock` | acquire an unlocked weapon (spends ASCEND) |
| POST | `/api/weapons/loadout` | set equipped weapons |
| POST | `/api/weapons/upgrade` | +1 instance tier (spends ASCEND) |
| POST | `/api/weapons/fire` | launch at a target parcel → runtime engagement + WS |
| POST | `/api/weapons/deploy-defense` | place a battery on an owned parcel |
| POST | `/api/weapons/mint-nft` | mint an owned weapon as an Algorand NFT |
| GET  | `/nft/metadata/weapon/:id` | public ARC-3 metadata (spec fields only) |

WS events: `weapon_engagement` (launch/intercept/impact) and `weapon_battery`.

## Progression loop (the 2K analog)

Allocate attributes → over-investing past the soft cap taxes a tensioned attribute
(`TENSION_PAIRS`) → effective attributes derive your archetype and, combined with
combat `stats`, your badge tiers → badges unlock weapons + animation variants.
Firing bumps stats (`shotsFired`, `kills`, `longRangeHits`, `precisionHits`);
successful interception credits the defender's `intercepts`.

## Run / verify

- Dev FX sandbox: `pnpm run sandbox:weapons` → `/weapon-sandbox.html`.
- In-game: `/armory` route (authenticated); firing animates on the live globe.
- Checks: `pnpm run check`, `pnpm run test:server`, `pnpm run build`.
- One-time before live use: `pnpm run db:push` (adds nullable `weapon_profile`).

## Realism grounding

Stats scaled from real systems (see session note Sources): ATACMS/Iskander
(ballistic), Tomahawk (cruise), Kinzhal/Avangard (hypersonic), M777/HIMARS/M270
(artillery), NASAMS/Patriot/S-400/Arrow (anti-air), Iron Dome/David's Sling/THAAD/
Aegis/Arrow (defense). `KM_PER_GAME_UNIT` + `PLANET_RADIUS_KM` map km → game units.
