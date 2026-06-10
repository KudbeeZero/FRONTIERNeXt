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

## NOT yet done (next units)
1. **API routes** `/api/weapons/*` (build/catalog/unlock/fire/deploy-defense) in
   `server/routes.ts` behind `assertPlayerOwnership`, with a `server/weapons/service.ts`
   (FRNTR deduction via economy, stat bumps, calls engagementStore) + `markDirty()`/
   WS broadcast of launch/intercept/impact. Add a `tsx` HTTP integration test.
2. **Live globe FX**: mount `<WeaponScene>` inside `PlanetGlobe` alongside
   `<GlobeEvents/>`, fed by server engagements over WS.
3. **Phase 2**: weapon-NFT mint (`server/services/chain/weapon.ts`, mirrors
   commander.ts), Armory UI (Radix/Tailwind), badge-earning from real combat,
   AI factions firing.
4. Run `pnpm run db:push` against a dev DB to apply the `weapon_profile` column.

## Verify
`pnpm run check` · `pnpm run test:server` · `pnpm run build` (all green) ·
`pnpm run sandbox:weapons`.
