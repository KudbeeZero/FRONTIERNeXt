# Night Ivy — Integration & Data Flow

## Ivy — Night Shift Report
**Focus**: Weapon system PR #9 end-to-end data flow (client action → /api/weapons/* → service.ts → engagementStore → WS → useGameSocket → LiveWeaponLayer → resolution → storage), storage parity, schema, WS contract, cache invalidation, restart semantics. NOTE: weapon files live on `origin/pr-9` (== `origin/main` for server/client/shared; merged), NOT on the current checkout branch — all citations are pr-9 paths. The working tree mutated mid-review (parallel agents switching branches), so every claim was re-verified against the immutable `origin/pr-9` ref. `docs/handoff/agent-memory.md` did not exist when I started (could not obey its lessons — flagging, not guessing).

**Findings Table**
| ID | Severity | Category | File(s) | Description | Impact | Suggested Fix | Test Idea |
|----|----------|----------|---------|-------------|--------|---------------|-----------|
| I1 | High | Data flow gap | client/src/components/game/armory/ArmoryPanel.tsx:99-117; client (git grep, no hits for `weapons/fire`) | No client code calls `POST /api/weapons/fire` or `/deploy-defense`. ArmoryPanel only does build/unlock/upgrade/loadout. LiveWeaponLayer renders engagements no UI can create. | The headline fire→globe loop is unplayable from the UI; works only via curl/tests. Docs claim "fire from the game animates on the live globe" (session-notes phase1, HANDOFF). | Add fire/deploy mutations to LandSheet/AttackModal (target = selected parcel; source = owned parcel in range), invalidating `weapons-catalog` + relying on WS for balance. | Cypress/RTL: select enemy parcel → Fire → assert POST /api/weapons/fire and a shot appears in WeaponScene. |
| I2 | High | Funds-loss ordering | server/weapons/service.ts:239-240; server/weapons/engagementStore.ts:96-99 | `deployDefense` burns FRNTR (`spendFrontier`) BEFORE `store.deployDefense`, which throws `Battery limit reached` at `MAX_BATTERIES_PER_PLAYER` (12). | Player at battery cap pays full deploy cost, gets a 400, receives nothing; FRNTR is burned (db.ts:863-882 deducts + bumps totalFrontierBurned). | Check the cap (count batteries for ownerId) before `spendFrontier`, or move the spend after a `canDeploy` precheck. | Unit: deploy 12 batteries, record balance, attempt #13 → expect throw AND unchanged balance. |
| I3 | High | Restart durability | server/weapons/engagementStore.ts:85-87,228 (process singleton); server/routes.ts (no GET engagements/batteries route, only POSTs 2056-2178) | EngagementStore is in-memory only. Server restart silently destroys all deployed defense batteries (paid with FRNTR) and remaining magazine state. In-flight engagements are resolved synchronously at launch, so shots lose only fade FX — but clients connecting after launch never see active engagements (no replay/GET). | Players lose paid defenses on every deploy/restart with zero notice; defense layer quietly evaporates. | Persist batteries (jsonb on parcel or a `defense_batteries` table) and rehydrate on boot; optionally add `GET /api/weapons/engagements` replaying `engagementStore.active()` on WS connect. | Integration: deploy battery → restart server (or `new EngagementStore()`) → fire at parcel → assert intercept still possible. |
| I4 | Med | Missing resolution write | server/weapons/engagementStore.ts:11 (comment claims routes "settle damage"), :149; server/routes.ts:2115-2137; service.ts:190-217 | `engagement.damage` is never applied to the target parcel/owner — no storage write exists for impact damage. Only attacker/defender stats are persisted. The store's own header comment promises damage settlement that doesn't exist. | Weapons cost real FRNTR but impacts have zero gameplay effect on the target; doc/comment vs behavior divergence will mislead the next implementer. | Either implement impact settlement (target parcel HP/resources) or fix the comment + WEAPON_SYSTEM.md to state damage is FX-only in this phase. | Unit: fire un-intercepted shot → assert target parcel state changed (or assert documented no-op explicitly). |
| I5 | Med | Stale WS contract doc | docs/WEAPON_SYSTEM.md:77 vs server/routes.ts:2150-2153 | Doc lists WS event `weapon_battery`; the audit commit (33e4dd6) removed that broadcast as a fog-of-war leak. Only `weapon_engagement` exists. | Anyone building a client/bot from the doc waits on an event that never fires. | Delete `weapon_battery` from the doc; note batteries are concealed until they intercept. | Doc lint: grep docs for WS event names vs `broadcastRaw(` call sites. |
| I6 | Med | Schema deploy path | server/db-schema.ts:132; migrations/ (0000-0004, no weapon_profile); session-notes phase1 HANDOFF ("one-time `pnpm run db:push`") | `weapon_profile` jsonb column has no SQL migration — prior features shipped numbered migrations (0001-0004). Fresh/migration-driven deploys lack the column; db.ts:834-837 SELECTs it and will error at runtime. | Any environment provisioned from migrations breaks every /api/weapons/* call until someone remembers a manual push. | Add `migrations/0005_weapon_profile.sql` (`ALTER TABLE players ADD COLUMN IF NOT EXISTS weapon_profile jsonb;`). | Spin up clean PG, run migrations only, hit GET /api/weapons/catalog → expect 200. |
| I7 | Low | Unscoped broadcast | server/routes.ts:2130; server/wsServer.ts:304-306 vs scoped _broadcastGameState:290-298 | `weapon_engagement` uses `broadcastRaw` (all clients, unscoped) with the FULL Engagement: attackerId, source/targetParcelId, damage, pk, interceptedByBatteryId. Client type (useGameSocket.ts pr-9:82-92) only declares the FX subset. | Reveals attacker identity/source parcel and intercept pk to everyone — partially intended (launch is visible), but `pk` + battery id leak defense quality intel. | Strip to the client's declared subset before broadcast (id, weaponSpecId, from, to, launchTs, tof, status, interceptAt, interceptTs). | WS test: connect 2 clients, fire, assert payload has no `pk`/`attackerId`. |
| I8 | Low | Stats lost-update | server/weapons/service.ts:165,193-203 | Fire stats are read-modify-write from a pre-spend profile snapshot; concurrent fires drop increments. Known/accepted in session-notes ("last-write-wins... only ever a player loss"). | Badge progression slightly undercounts under rapid fire. | Atomic jsonb increment or per-player queue (low priority; documented). | Parallel 10x fire in test, assert shotsFired==10 (currently flaky). |
| I9 | Low | Cache invalidation scope | client/src/components/game/armory/ArmoryPanel.tsx:74,79 | After unlock/upgrade (FRNTR spends) only `["weapons-catalog", playerId]` is invalidated; the balance shown elsewhere lives under `["/api/game/state"]`, refreshed only via WS `game_state_update` (server `markDirty()`, routes.ts:2091/2170) or the 30s poll fallback. | With WS down, header balance is stale up to 30s after a spend. Acceptable; flagging the implicit coupling. | Also `invalidateQueries({queryKey:["/api/game/state"]})` in onSuccess. | Kill WS in test, unlock weapon, assert balance refreshes < poll interval. |

**Verified-OK (no findings)**
- Storage parity: all 3 interface methods (interface.ts:187-201) implemented for real in BOTH backends — getWeaponProfile (db.ts:832-840 / mem.ts:448-453), updateWeaponProfile (db.ts:842-861, transactional / mem.ts:455-465), spendFrontier (db.ts:863-882 / mem.ts:467-477). No silent mem no-ops. mem's extra `frontierCirculating -=` is consistent: db computes circulating by summing balances (db.ts:495).
- WS contract: name `weapon_engagement` matches exactly (routes.ts:2130 ↔ useGameSocket.ts pr-9:167); payload superset is shape-compatible; GeoPoint `{lat,lng}` (shared/weapons/scale.ts:44-47) matches client type. LiveWeaponLayer rebases server timestamps to client clock (clock-skew safe).
- Fire route flow: ArmoryPanel does NOT fire (answer to "which API route": none from ArmoryPanel — fire is `POST /api/weapons/fire`, currently uncalled by any client code, see I1).
- fireWeapon spend ordering is safe (unlike deploy): all throwing validations precede `spendFrontier`; `store.launch` cannot throw post-spend (spec pre-validated).

**Key Insights**
- The persisted (player profile, jsonb) vs runtime (engagementStore) split is clean and well-tested server-side; the broken links are at the edges: no fire UI (I1), no damage settlement (I4), no battery durability (I3).
- Engagements are resolved synchronously AT LAUNCH (interception decided before the HTTP response); "in_flight" is purely cosmetic. Restart risk is therefore concentrated in batteries, not shots.
- Repo pattern alert: schema changed via `db:push` instead of the established numbered-migration pattern (I6) — silent environment divergence risk.
- Review hygiene: weapon code is absent from the current branch; reviewers must pin to `origin/pr-9`/`origin/main` or they will (as I briefly did) see files appear and vanish.

**Code Suggestions**
I2 — reorder cap check before burn (server/weapons/service.ts):
```ts
  const { parcel, geo } = await parcelGeo(storage, parcelId);
  if (parcel.ownerId !== playerId) throw new Error("You can only deploy on a parcel you own.");
+ const owned = store.listBatteries().filter((b) => b.ownerId === playerId).length;
+ if (owned >= MAX_BATTERIES_PER_PLAYER)
+   throw new Error(`Battery limit reached (${MAX_BATTERIES_PER_PLAYER}). Decommission one first.`);
  await storage.spendFrontier(playerId, deployCostFrntr(spec));
  return store.deployDefense({ specId, ownerId: playerId, parcelId, at: geo });
```
I6 — migrations/0005_weapon_profile.sql:
```sql
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "weapon_profile" jsonb;
```
I7 — scope the broadcast (server/routes.ts:2130):
```ts
const { id, weaponSpecId, from, to, launchTs, tof, status, interceptAt, interceptTs } = engagement;
broadcastRaw({ type: "weapon_engagement", payload: { id, weaponSpecId, from, to, launchTs, tof, status, interceptAt, interceptTs } });
```

**Confidence Score**: 8/10 (all claims re-verified against pinned `origin/pr-9`; residual uncertainty: whether damage-less impacts (I4) are deliberate phase scope, and whether prod deploys actually run migrations vs db:push)
