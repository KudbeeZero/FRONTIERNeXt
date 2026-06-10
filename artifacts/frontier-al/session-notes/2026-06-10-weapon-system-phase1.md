# 2026-06-10 — Weapon System (Phase 1 foundation)

Branch: `claude/weapons-system-architecture-hl2jhs`

## Goal
Stand up a realistic, 2K-style weapon system (a dozen missiles, a dozen artillery,
anti-aircraft + missile-defense), wired toward the live model, with **both** memory
layers (persisted progression + runtime combat state) and a particle-FX render
layer. Built to grow every "season."

## Shipped (3 commits, all green: tsc + 147 server tests + production build)

### 1. Shared core — `shared/weapons/*`, `shared/weapon-economy.ts`
- Catalog: **12 missiles** (ballistic/cruise/hypersonic), **12 artillery**
  (towed/rocket/MLRS), 8 anti-air interceptors, 6 layered missile-defense
  batteries. Stats grounded in real systems (ATACMS/Iskander/Tomahawk/HIMARS/
  M270/Patriot/S-400/Iron Dome/THAAD…), scaled via `scale.ts` (`KM_PER_GAME_UNIT`,
  `PLANET_RADIUS_KM`, great-circle helpers).
- Progression: attribute point-budget + tradeoff curve (`attributes.ts`), derived
  archetypes (`archetypes.ts`), Bronze→Silver→Gold→Hall-of-Fame badges
  (`badges.ts`), weapon + animation unlocks (`unlocks.ts`).
- Sim: deterministic ballistics (`ballistics.ts`: time-of-flight, apex, position-at-t)
  + radar-detection/interception solver with seeded Pk (`intercept.ts`).
- `profile.ts`: `PlayerWeaponProfile` + Zod action schemas. `weapon-economy.ts`:
  TEST/PROD/ACTIVE cost tables (mirrors economy-config.ts).
- 23 unit tests (catalog/progression/sim).

### 2. Memory layers
- **Persisted**: `weaponProfile` jsonb column on `players`; `getWeaponProfile` /
  `updateWeaponProfile` on `IStorage`, implemented in DbStorage (transactional) +
  MemStorage (Map). Derived fields recomputed on every write. Round-trip test.
- **Runtime**: `server/weapons/engagementStore.ts` — in-flight projectiles +
  deployed batteries, layered interception (magazine depletion, seeded rolls),
  fade/prune lifecycle. 7 tests.

### 3. Render layer + sandbox — `client/src/components/game/weapons/*`
- `WeaponProjectile` (arc + additive particle fire/smoke trail), `ImpactBurst`
  (impact + kinetic-kill flash), `WeaponScene`, `fxUtils`. Reuses
  `latLngToVec3`/`GLOBE_RADIUS`; zero new deps.
- Dev-only standalone sandbox: `client/weapon-sandbox.html` +
  `weapon-sandbox-entry.tsx`, run `pnpm run sandbox:weapons` → `/weapon-sandbox.html`.
  Pick weapon/defense, Fire, watch arc + trail + interception. Bundles cleanly
  (646 modules); isolated from live app routing.

### 4. Live API + globe wiring (added same session)
- `server/weapons/service.ts`: orchestrates storage + economy + engagement store
  (build / catalog / unlock / loadout / fire / deploy-defense). FRNTR spend via a
  new `IStorage.spendFrontier` (mirrors each backend: DbStorage burns
  `frntrBalanceMicro`, MemStorage burns `player.frontier`). Fire bumps combat
  stats (feeds badges) and credits intercepting defenders. 9 service tests.
- `server/routes.ts`: `GET /api/weapons/catalog` + `POST /api/weapons/{build,
  unlock,loadout,fire,deploy-defense}`, behind `assertPlayerOwnership`, Zod-
  validated, `markDirty()` + `broadcastRaw({type:"weapon_engagement"|"weapon_battery"})`.
- Client: `useGameSocket` gains an `onWeaponEngagement` bus + `weapon_engagement`
  handler; `globe/LiveWeaponLayer.tsx` maps engagements → WeaponShots and is
  mounted in `PlanetGlobe` alongside `<GlobeEvents/>`. Fire from anywhere now
  animates on the live globe.
- All green: tsc, 156 server tests, production build.

## NOT yet done (next units)
1. **Phase 2**: weapon-NFT mint (`server/services/chain/weapon.ts`, mirrors
   commander.ts), Armory UI (Radix/Tailwind: attribute allocation, archetype
   picker, badge wall, catalog/fire controls), badge-earning surfaced in UI,
   AI factions firing weapons, upgrade route.
2. Run `pnpm run db:push` against a dev DB to apply the `weapon_profile` column.
3. Optional: a `tsx` HTTP integration test mounting the real `/api/weapons/fire`
   handler end-to-end (suite is single-process).

## Verify
`pnpm run check` · `pnpm run test:server` · `pnpm run build` (all green) ·
`pnpm run sandbox:weapons`.
