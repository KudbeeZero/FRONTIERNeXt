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

### 5. Phase 2 — upgrades, NFT minting, Armory UI (shipped)
- **Upgrade**: `POST /api/weapons/upgrade` + `service.upgradeWeapon` (per-instance
  tier to `MAX_WEAPON_UPGRADE_TIER`, spends FRNTR).
- **NFT mint**: `server/services/chain/weapon.ts` (custody mint, mirrors
  commander.ts) + `POST /api/weapons/mint-nft` + `GET /nft/metadata/weapon/:id`
  (ARC-3). `nftAssetId` recorded on the owned weapon.
- **Armory UI**: `client/src/components/game/armory/ArmoryPanel.tsx` (TanStack
  Query vs live API): attribute allocation with live tradeoff/effective preview,
  derived archetype + badge wall, catalog with unlock/upgrade/equip. Authenticated
  `/armory` route (`pages/armory.tsx`) wired into `App.tsx`.

### 6. Security pass (done)
- Independent agent review of the full branch diff (routes/service/storage/chain):
  **no high-confidence vulnerabilities.** Auth/ownership enforced on every mutating
  route via `assertPlayerOwnership` (uses verified playerId, not body); drizzle
  `eq()` params (no SQLi); spend paths clamped positive; custody-safe NFT mint; no
  PII/secret exposure. Cleanup applied: owned-weapon id now `randomUUID()` (was a
  collidable timestamp).

## HANDOFF — for the next chat
- **State**: weapon system feature-complete through Phase 2 on
  `claude/weapons-system-architecture-hl2jhs`. 7 commits, all individually green
  (tsc + 158 server tests + production build). PR opened (see branch).
- **One-time op before live use**: `pnpm run db:push` to apply the `weapon_profile`
  column on the real DB (nullable; no backfill).
- **Try it**: `pnpm run sandbox:weapons` (FX), or `/armory` route in-game
  (authenticated); fire from the game animates on the live globe via WS.
- **Next ideas**: surface an in-game nav link to `/armory` (GameLayout header);
  wire "fire from selected plot" into the map UI; AI factions firing weapons;
  weapon images for NFT metadata (`/images/weapons/<category>.png`); optional
  `tsx` HTTP integration test for `/api/weapons/fire`; refund FRNTR if a future
  `store.launch` can throw (currently non-throwing post-validation).

## Verify
`pnpm run check` · `pnpm run test:server` · `pnpm run build` (all green) ·
`pnpm run sandbox:weapons`.
