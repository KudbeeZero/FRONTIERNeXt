# Final Plan — Weapon System (PR #9) Remediation Backlog

**Author**: Jordan (Final Auditor), 2026-06-10. Closes findings from `audit-report.md` (W-xx ids). Ordered by player-facing value risk x likelihood. Ratings per `docs/protocols/OVERNIGHT_HANDOFF_PROTOCOL.md` tiers. All branches `claude/night/*`; verify with `pnpm run check && pnpm run test:server && pnpm run build`.

## 1. Prioritized Backlog

### WPN-1 — Fix funds-loss and double-charge seams in weapon service
- **Severity**: High | **Effort**: M | **Branch**: `claude/night/weapons-economy-integrity` | **Rating**: Highly Recommended
- Pre-check battery cap before `spendFrontier` in `deployDefense`; per-player in-process mutex around unlock/upgrade/fire read-spend-write; return `interceptedByOwnerId` on the engagement so magazine-emptying intercepts still credit the defender; atomic stat-increment patch API.
- **AC**: 13th deploy → 400 with unchanged balance; `Promise.all([unlock,unlock])` → single charge, single entry; magazine=1 intercept credits defender; parallel fires → shotsFired==2. Suite green.
- **Closes**: W-02, W-07, W-13, W-14.

### WPN-2 — Rate-limit weapon routes + fix metadata DoS + trim WS broadcast
- **Severity**: High | **Effort**: S | **Branch**: `claude/night/weapons-route-hardening` | **Rating**: Highly Recommended
- Mount `actionsLimiter` on `/api/weapons`; add `/nft/metadata/weapon/*` to enumerationLimiter; replace full-table scan with JSONB containment query (or owned-weapon index); broadcast trimmed DTO (drop pk/attackerId/batteryId/damage).
- **AC**: 61st fire/min → 429; metadata GET = single bounded query (explain plan); WS payload contains only the client-declared subset.
- **Closes**: W-04, W-05, W-18.

### WPN-3 — Migration 0005 + weapon test suite expansion
- **Severity**: High | **Effort**: M | **Branch**: `claude/night/weapons-tests-migration` | **Rating**: Highly Recommended
- Write `migrations/0005_weapon_profile.sql` (`ADD COLUMN IF NOT EXISTS` — write only, never run against shared envs per guardrails). Add: service.fire.spec (success path, stats, intercept credit), routes integration spec (auth seam, mint race), intercept.edge.spec, layered-defense cases, storage parity + economy cost specs.
- **AC**: clean-PG-from-migrations boots weapon routes; new specs pin W-02/03/07/13/14 behavior (expected-fail where fix pending); 160 → ~200+ tests green.
- **Closes**: W-10, W-12; pins WPN-1/WPN-4 regressions.

### WPN-4 — Combat integrity: stat farming, cooldowns, damage scope
- **Severity**: High | **Effort**: M | **Branch**: `claude/night/weapons-combat-integrity` | **Rating**: Recommended (one design decision: damage settlement is Phase-2 or now — pre-frame as morning multiple-choice)
- Exclude self-owned/self-target parcels from kill/precision/longRange credit; enforce `cooldownMs` per spec per player; fix the lying engagementStore header comment + WEAPON_SYSTEM.md to state damage is FX-only this phase (or implement settlement if decided).
- **AC**: 50x self-fire → badges unchanged; rapid re-fire inside cooldown → 429/400; doc and comment match behavior.
- **Closes**: W-03 (+ I4 doc divergence).

### WPN-5 — Mint pipeline hardening (idempotency, cost, delivery retry)
- **Severity**: High | **Effort**: L | **Branch**: `claude/night/weapons-mint-idempotency` | **Rating**: Recommended (chain-adjacent; all chain calls mocked in tests, no prod infra)
- `weapon_mint_idempotency` table (commander pattern); persist record BEFORE delivery; charge FRNTR mint cost (wire or delete `WEAPON_NFT_ALGO_NETWORK_FEE`); `algosdk.isValidAddress` on receiver (or use DB-stored address like commander); `POST /api/nft/deliver-weapon/:id` retry route; assetURL ≤96-byte assert; `fireBurn` on weapon spends; move `markDirty` out of try.
- **AC**: forced post-mint record failure → retry returns original assetId, no second ASA; bad address → 400 pre-mint; stranded NFT deliverable after opt-in.
- **Closes**: W-06, W-15, W-16, W-17, parts of W-28 (B7/B9).

### WPN-6 — Battery persistence + engagement resync
- **Severity**: High | **Effort**: M | **Branch**: `claude/night/weapons-battery-persistence` | **Rating**: Recommended
- Persist batteries (`defense_batteries` table or parcel jsonb), rehydrate on boot; add `GET /api/weapons/engagements` (scoped) for reconnect resync; index batteries by owner + range pre-filter (keeps fire O(nearby)).
- **AC**: deploy → simulated restart → fire → intercept still possible; late-connecting client fetches in-flight engagements.
- **Closes**: W-09, W-27, W-28 (D7/F7).

### WPN-7 — Client reliability: WS zombie + silent errors + equip races
- **Severity**: High | **Effort**: M | **Branch**: `claude/night/weapons-client-reliability` | **Rating**: Recommended (client-side but deterministic, RTL-testable)
- `disposed` flag + `onclose=null` in useGameSocket cleanup; shared `onError` toast on all 4 Armory mutations; per-card pending state; optimistic loadout update with rollback; `key={playerId}` on ArmoryInner; loading skeleton before connect-wallet prompt.
- **AC**: authTrigger flip → exactly 1 live socket; mocked 400 unlock → destructive toast; double equip-click persists both; loading shows skeleton not false prompt.
- **Closes**: W-08, W-11, W-21, W-24 (E3), W-28 (A4-A6).

### WPN-8 — Docs sync: tokenomics sinks, WS contract, project memory
- **Severity**: Med | **Effort**: S | **Branch**: `claude/night/weapons-docs-sync` | **Rating**: Highly Recommended
- Remove `weapon_battery` from WEAPON_SYSTEM.md; add weapon sink rows to TOKENOMICS/ECONOMICS; Bronze→Silver→Gold→HoF fix; PROJECT MEMORY §3/§7 update; annotate session-note §4.
- **AC**: doc WS events == `broadcastRaw` call sites; sink tables cover every `spendFrontier` site.
- **Closes**: W-19, W-20, W-28 (G3-G8).

### WPN-9 — Un-dark-launch the Armory (nav + fire/deploy UI)
- **Severity**: Critical value, gated | **Effort**: L | **Branch**: `claude/night/weapons-armory-launch` | **Rating**: Experimental (UX/design-heavy, needs author intent + Figma pass; not suitable for autonomous night build beyond scaffolding)
- BottomNav + GameLayout tab; fire/deploy wired into AttackModal/LandSheet; mint UI; a11y + design-system rebuild (shadcn, testids, currency labels, 44px targets).
- **AC**: tap-path from /game to Armory on both surfaces; select enemy parcel → Fire → shot renders on globe; axe-core pass.
- **Closes**: W-01, W-22, W-23, W-24 (E10). **MUST NOT land before WPN-1, 2, 4, 5 (see §2).**

### WPN-10 — FX performance polish
- **Severity**: Med | **Effort**: M | **Branch**: `claude/night/weapons-fx-perf` | **Rating**: Recommended (deterministic code changes; profiling validation best done by day shift)
- Shared module-scope geometries/materials; scratch Vector3/Color; memoized distanceKm; ImpactBurst settle gate; position needsUpdate only in-flight; shot cap (newest 24) + React.memo; fix pre-launch settle (F3).
- **AC**: 30-shot salvo: draw calls bounded, heap sawtooth flattened; shot with future launchTs renders at T.
- **Closes**: W-26, W-28 (F3/A7/A8/F6).

## 2. Quantum Layer

**Simulated downstream impact (top 3):**
1. **WPN-9 (un-dark-launch) is the detonator**: today every server-side hole is reachable only by curl. The moment fire/deploy/mint get UI, W-03 (badge farming), W-04 (no throttle), W-02 (deploy funds loss), W-06 (ALGO drain via free mint), and W-09 (batteries vanish on restart) all become live at player scale simultaneously — with W-11 (silent errors) ensuring players can't even tell what failed. **Dependency order: WPN-1 → WPN-2 → WPN-4 → WPN-5 → (WPN-6 strongly advised) → WPN-9.** WPN-3 tests land in parallel as the regression net.
2. **WPN-5 (mint cost)** ripples into economy docs (WPN-8 must follow it, not precede), economy tests (WPN-3), and the commander-mint pattern — converging weapon mint on the commander scaffolding reduces three idempotency dialects to one.
3. **WPN-6 (persist batteries)** makes the global battery population grow unbounded across restarts → the O(all batteries) fire scan (W-28) graduates from Low to real; the range pre-filter inside WPN-6 is therefore mandatory, not optional. Stable battery ids also interact with WPN-1's defender-credit fix — land WPN-1 first.

**Predicted future risks:**
- **P1**: Any future salvo/scheduled-launch or engagement-status-update feature trips the latent client FX bugs (F3 pre-launch settle, A8 same-id rebase) — both currently unreachable; fix inside WPN-10 before that feature, or shots will silently not render.
- **P2**: When `WALLET_AUTH_REQUIRED` flips on (mainnet gate), body-supplied `playerId`/`receiverAddress` patterns break or become redundant; WPN-5's move to DB-stored addresses future-proofs this.
- **P3**: Phase-2 damage settlement turns weapons into real value destruction — target-side economy (parcel HP, compensation) and the intel-leak surface (W-18, fixed in WPN-2) become competitive-fairness issues; revisit broadcast scoping then.

## 3. Rating Summary

| Item | Rating | Why |
|---|---|---|
| WPN-1, WPN-2, WPN-3, WPN-8 | Highly Recommended | Server-only/docs-only, deterministic, fully specced, clear AC |
| WPN-4 | Recommended | One pre-framed design decision (damage scope) |
| WPN-5 | Recommended | Chain-adjacent; mock-tested, follows commander precedent |
| WPN-6, WPN-7, WPN-10 | Recommended | Solid spec, minor ambiguity (schema shape / UX copy / perf validation) |
| WPN-9 | Experimental | UX-heavy, intent confirmation + design pass needed; hard gate on WPN-1/2/4/5 |
