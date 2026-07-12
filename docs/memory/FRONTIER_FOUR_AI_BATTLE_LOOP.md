# FRONTIER — Four AI Battle Loop

**Branch:** `fix/frontier-four-ai-battle-loop`
**Scope:** Make all four AI factions (NEXUS-7, KRONOS, VANGUARD, SPECTRE) actively
participate in the war with distinct strategies, behind the existing `AI_ENABLED`
opt-in gate. No wallet / NFT / price / funds / auth behavior changed.

---

## Root cause (pre-fix)

1. **`AI_ENABLED` was never set `true` in Fly production.** `fly.toml [env]` and the
   `set-fly-secrets.example.sh` template omit it; `.env.example` defaults to `false`;
   `docs/DEPLOYMENT_ENV_CHECKLIST.md` / `ENV_VARS.md` say keep it `false` at launch.
   The 20 s AI loop in `server/routes.ts` is registered at boot but short-circuits
   because `runAITurn` returns `[]` when `process.env.AI_ENABLED !== "true"`.
2. **Only two behaviors could attack.** `server/storage/ai-engine.ts` gated attacks on
   `aiBehavior === "expansionist" || "raider"` (lines ~188). The seeder
   (`server/storage/seeder.ts:231`) assigns: NEXUS-7→`expansionist`, KRONOS→`defensive`,
   VANGUARD→`raider`, SPECTRE→`economic`. So **KRONOS (defensive) and SPECTRE (economic)
   never launched battles.** KRONOS's "suppression toward NEXUS-7" block was also dead
   code — it only expanded, never entered the attack branch.
3. **Mission banner ≠ activity.** `ObjectiveHud` shows `missionBriefing` (static
   rivalry label) + `evaluateObjective` (live but frozen rival parcel count). It proves
   nothing about the AI loop.

---

## Behavior matrix (post-fix)

| Faction | Behavior | In-tick action | Targeting |
|---|---|---|---|
| **NEXUS-7** | `expansionist` | Attack + expand | Weakest enemy territory in range (`AI_ATTACK_RANGE` = 0.11) |
| **KRONOS** | `defensive` | Counterattack + fortify | Attacks NEXUS-7 plots within `KRONOS_THREAT_RANGE` (0.12); else upgrades weakest defense |
| **VANGUARD** | `raider` | Attack + raid/withdraw | Richest / least-defended enemy in range (×1.4); prefers NEXUS-7 plots |
| **SPECTRE** | `economic` | Build → attack + expand | Only attacks once `iron + fuel >= SPECTRE_ATTACK_RESOURCE_MIN` (120); targets richest enemy plot |

All four also mine/collect passively and run the shared **Reconquest** path when a human
holds a plot they previously owned.

---

## Files changed

- `artifacts/frontier-al/server/storage/ai-engine.ts` — rewrote `runAITurn` with a
  behavior switch; added `launchAttack` helper + per-faction action functions
  (`actExpansionist` / `actRaider` / `actDefensive` / `actEconomic` / `tryExpand`);
  exported constants `AI_ATTACK_COOLDOWN_MS`, `AI_MAX_ACTIVE_BATTLES`,
  `SPECTRE_ATTACK_RESOURCE_MIN`, `AI_ATTACK_RANGE`, `KRONOS_THREAT_RANGE`; added
  `getActiveBattles` to the `AiOps` interface (optional).
- `artifacts/frontier-al/server/storage/db.ts` — `DbStorage.runAITurn` now supplies
  `getActiveBattles` to the loop.
- `artifacts/frontier-al/server/routes.ts` — `GET /api/admin/ai-activity` now reports
  `activeBattleCount` (total pending battles) alongside `aiEnabled` and per-faction
  `lastAction`.
- `artifacts/frontier-al/server/storage/ai-engine.spec.ts` — new focused test (15 cases).
- `docs/memory/FRONTIER_FOUR_AI_BATTLE_LOOP.md` — this file.

---

## Safeguards

- **One action per faction per turn** — `acted` flag; a faction performs at most one
  major action (attack / reconquest / expand / fortify) per tick. Mining/collecting are
  passive upkeep.
- **No self-attacks** — `launchAttack` rejects `target.ownerId === ai.id`; the DB layer
  (`deployAttack`) also throws on self-target and on a target already under attack.
- **No duplicate battle against the same target** — in-tick `battleTargetIds` set plus
  the DB `activeBattleId` guard.
- **No attack when an existing battle covers the target** — same `battleTargetIds` set,
  seeded from `getActiveBattles()`.
- **Reasonable cooldown** — `AI_ATTACK_COOLDOWN_MS` (60 s) applied to the attacker after
  each attack.
- **Maximum active AI battles** — `AI_MAX_ACTIVE_BATTLES` (12) cap enforced via a running
  count seeded from currently-active AI battles.
- **`AI_ENABLED=false` remains a hard stop** — `runAITurn` returns `[]` before any work.

---

## Tests

`server/storage/ai-engine.spec.ts` (15 passing) proves:

- `AI_ENABLED=false` is a hard stop (no battles, no events).
- All four factions launch a battle under valid conditions.
- NEXUS-7 attacks the weakest enemy; VANGUARD prefers a NEXUS-7 plot; KRONOS
  counterattacks NEXUS-7 in range (and fortifies instead when not threatened); SPECTRE
  only attacks once stockpiled and targets the richest plot.
- One action per faction per turn; no attack on a target already in an active battle;
  no self-attacks; global max-active-AI-battles cap respected; cooldown applied + skips
  a cooldowned faction; `ai_action` event records faction/action/target/reason/timestamp.

`pnpm run test:server` (full): **504 passed / 24 skipped**, no regressions.
`pnpm run check` (tsc) and `pnpm run build` both green.

---

## Production activation (owner step — NOT done in this PR)

This PR only changes code. To make the four AI factions actually battle in production,
set the Fly secret and redeploy (do **not** bake it into the image):

```bash
fly secrets set -a frontiernext AI_ENABLED=true
# optional tuning (all have safe defaults):
# fly secrets set -a frontiernext AI_MAX_ACTIVE_BATTLES=12
```

The 20 s scheduler (`server/routes.ts`) already calls `storage.runAITurn()` every tick;
the secret flip is the only thing that unblocks it. Verify after deploy:

1. `curl -H "x-admin-key: $ADMIN_KEY" https://api.frontierprotocol.app/api/admin/ai-activity`
   → expect `"aiEnabled": true` and a non-zero `activeBattleCount` after a few minutes.
2. Watch `factions` for NEXUS-7 / KRONOS / VANGUARD / SPECTRE territory counts changing.
3. Confirm `ai_action` events appear (HUD feed / `GET /api/admin/ai-activity` `lastAction`).
4. The Objective HUD banner is **not** proof — confirm via the API above.

---

## Rollback

`fly secrets unset -a frontiernext AI_ENABLED` (loop returns to no-op; no code change
needed). The behavior code stays inert until re-enabled.
