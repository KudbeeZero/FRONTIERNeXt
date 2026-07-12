# 2026-07-12 — Gamertag auth + recovery (PR #242) and background-loop cost control (PR #243)

## Gamertag auth fix + recovery — PR #242 (merged)

### Root cause (recap, from prior session)
`GamerTagModal.handleSubmit` issued a bare `fetch` to
`POST /api/actions/set-name` with no `credentials` and no
`Authorization: Bearer` header. The `/api/actions/*` routes sit behind
the server's global mutation ownership guard
(`server/routes.ts:623` → `evaluateOwnership`,
`server/routeOwnership.ts:37`). On the production split-host deploy
(Cloudflare `frontierprotocol.app` → Fly backend) the unauthenticated
request failed with HTTP 401 and the player could never save a tag.

### Recovery: re-prompt any human player whose earlier save failed
The tag modal previously opened only on the welcome-bonus path
(`GameLayout` connect effect). A player whose first save failed kept
the server-generated default name (`<first6>...<last4>` of the wallet
address) and was never prompted again.

Added a small pure helper `client/src/lib/gamertag.ts`:

- `isDefaultUnnamedName(name, address)` — treats null / empty / the
  server default pattern as unnamed.
- `needsGamertag(player)` — false for AI factions and service
  accounts.
- `shouldRecoverGamerTag({player, dismissed, showGamerTag})` — the
  exact decision the `GameLayout` recovery effect uses.

Wired a `gamerTagDismissed` state and a new recovery effect in
`GameLayout.tsx` that opens the modal whenever the canonical player
record is loaded with an unnamed name, gated by the dismissal flag so
a skip does not loop. On save, the game-state query is invalidated and
`gamerTagDismissed` is set, so a refresh preserves the saved tag and
does not re-prompt.

### Files
- `artifacts/frontier-al/client/src/lib/gamertag.ts` (new, 64 lines)
- `artifacts/frontier-al/client/tests/gamertag-recovery.spec.ts`
  (new, 15 tests covering all required behaviors)
- `artifacts/frontier-al/client/src/components/game/GameLayout.tsx`
  (+22 lines: import, state, effect, onComplete/onSkip dismiss)
- `artifacts/frontier-al/client/src/components/game/GamerTagModal.tsx`
  + `gamertag-authenticated-submit.spec.tsx` (carried from prior
  session — apiRequest fix + 3 regression tests)

### PR #242
- Branch: `fix/frontier-gamertag-onboarding`
- Commits: `7ef1443` (apiRequest fix) + `089d242` (recovery)
- **Merged: `fa5b125`** into `main` (squash)
- CI: Cloudflare Pages + Typecheck & server tests **pass**
- Fly health: `https://frontiernext.fly.dev/health` → **200**

## Background-loop cost control — PR #243 (open)

### What changed
- `AI_TURN_INTERVAL_MS` (default 120s, floor 30s) replaces the
  hardcoded 20s AI loop. Executions: 4,320 → 720/day (**−83.3%**).
- `DEBUFF_CLEANUP_INTERVAL_MS` (default 60s, floor 10s) moves the
  two unconditional parcel UPDATEs out of the 5s resolver into a
  single bounded UPDATE on its own cadence. Debuff queries:
  ~34,560 → 1,440/day (**−95.8%**).
- `SELECT * FROM parcels` → bounded 17-field projection matching the
  fields the four-faction strategies actually read.
- `gameMeta.currentTurn` / `lastUpdateTs` **kept unconditional** —
  traced every consumer and `currentTurn` is only written by
  `runAITurn` and consumed by claim/bet resolvable logic. An
  idle-tick skip is not provably safe; the 120s cadence already
  reduces the write rate by 83.3%. Documented in the memory doc.

### Files
- `artifacts/frontier-al/server/util/backgroundIntervals.ts` (new)
- `artifacts/frontier-al/server/util/backgroundIntervals.spec.ts`
  (new, 7 tests)
- `artifacts/frontier-al/server/util/debuffCleanup.ts` (new,
  combined UPDATE with `buildDebuffCleanupWhere` /
  `buildDebuffCleanupSet` exported for testing)
- `artifacts/frontier-al/server/util/debuffCleanup.spec.ts` (new,
  3 tests)
- `artifacts/frontier-al/server/storage/ai-engine.ts` (projection
  + `AiParcelRow` type, drop `rowToParcel` for owned-parcels
  mapping)
- `artifacts/frontier-al/server/storage/ai-engine.spec.ts` (2 new
  tests: projection + `gameMeta` preserved)
- `artifacts/frontier-al/server/routes.ts` (intervals, split
  debuff cleanup)
- `docs/memory/FRONTIER_BACKGROUND_LOOP_COST_CONTROL.md` (new)

### Loops left untouched
Battle resolver (5s), `battle_tick` (1s), orbital (5min), plot-mint
retry (60s), ASCEND transfer retry (30s) — all already idle-gated.
Wallets, gamertags, land, NFTs, auth, prices, funds, VANGUARD
bootstrap, AI token claiming — **not touched**. No migration, no
`db:push`.

### PR #243
- Branch: `fix/frontier-background-loop-cost-control`
- Commit: `98e3d1a`
- **Open, CI green, mergeStateStatus CLEAN, NOT MERGED**
- URL: https://github.com/KudbeeZero/FRONTIERNeXt/pull/243

## Verification

- TypeScript: `pnpm run check` — clean.
- Client tests: 67 files / 389 tests — all green.
- Server tests (no-DB): 63 files / 516 passed / 24 skipped — all green.
- Build: `pnpm run build` — clean.
- Fly health: 200.

## Recommended Fly values (after PR #243 merge)
- `AI_ENABLED=true`
- `AI_TURN_INTERVAL_MS=120000`
- `DEBUFF_CLEANUP_INTERVAL_MS=60000`
- `AI_MAX_ACTIVE_BATTLES=12`
