# Audit: PR #211 — feat(weapons): wire loadout gate into fireWeapon + eligibleStrikes (W2), fix Armory UX bugs

## Verdict: **PASS**

## PR / branch / commit
- PR #211, branch `claude/handoff-audit-f5w0qn`, head `cc621f37ef57ab81e3a962b0b0326f70f98c8884`
- Base: `main` @ `d9f5ff694fc3e4b907e7007eae39fb60f67ae301`
- PR is currently **marked draft** on GitHub (`"draft": true`) — administrative only, not a
  code concern; flagged under "What could NOT be verified" below.
- CI on head commit: both checks **success** — "Typecheck & server tests"
  (`run 28846257844` / job `85550806859`) and "Cloudflare Pages"
  (`85550999814`). `mergeable_state: clean`.

## Method
Read the full PR-range diff (`git diff d9f5ff6..cc621f3`, 15 files, +409/-168, matches the
PR API's file list exactly) and the single-commit diff (`git show cc621f3`, 13 files,
+254/-142 — the actual code+test+session-note unit; the other 2 files in the wider range,
`docs/FRONTIER_MASTER_ROADMAP.md` and the new `WEAPONS_SYSTEM_UX_PLAN.md`, were added in the
two earlier commits on this same branch/PR). Read `server/weapons/service.ts` in full around
`fireWeapon`/`setLoadout`/`upgradeWeapon`, `client/src/lib/weaponStrike.ts`,
`StrikePanel.tsx`, `ArmoryPanel.tsx`, `panelNav.ts` in full, and grepped the entire repo
(not just the claimed touched files) for `BottomNav` to check for an incomplete-deletion
regression. Independently re-ran `pnpm install --frozen-lockfile`, `check`, `test:server`,
`coverage:server`, `test`, and `build` from a clean shell rather than trusting the PR body's
numbers. Cross-checked the PR body and session note against the diff line-by-line.

## Scope
Full PR range (`d9f5ff6..cc621f3`): `BottomNav.tsx` (deleted, -111), `GameLayout.tsx` (import
path, ±1), `ArmoryPanel.tsx` (+14/-6), `StrikePanel.tsx` (+10/-3), `HudShell.tsx` (import
path, ±1), `panelNav.ts` (+2/-1), `weaponStrike.ts` (+22/-1), `hud-shell.spec.tsx` (import
path, ±1), `weaponStrike.spec.ts` (+37 new), `service.spec.ts` (+32 new), `service.ts`
(+8), session note (+78 new), `docs/HANDOFF.md` (+77/-43), `docs/FRONTIER_MASTER_ROADMAP.md`
(+19), `WEAPONS_SYSTEM_UX_PLAN.md` (+107 new). No funds/ASA/chain-service file
(`server/services/chain/*`, `priceOracle.ts`), no `ops/kestra/*`, no `wip/atomic-purchase`
branch, and no `GlobeBattleSequence.tsx`/`battle-sequence.ts` (the hard-gated cinematics
files) touched anywhere in the range — confirmed by `git diff --stat` scoped to those paths
(empty) and by full-repo grep.

**Minor scope-claim gap (not a functional issue):** the PR body's "Scope" section lists the
touched files explicitly and ends with "plus docs (`docs/HANDOFF.md`, new session note)" — it
does not name `docs/FRONTIER_MASTER_ROADMAP.md` or the new `WEAPONS_SYSTEM_UX_PLAN.md` (a
107-line new doc), both of which are part of this PR's actual commit range. Both are pure
documentation (the plan doc this very unit was picked from, and the roadmap section it
updates) — no code/behavior impact — so this is an incompleteness in the stated file list,
not scope creep into anything sensitive.

## Claims vs. evidence

| Claim | Verdict | Evidence |
|---|---|---|
| `fireWeapon()` loadout gate runs before the parcel lookup | ✅ verified | `service.ts:165-177` (get profile → ownedOfSpec check → loadout gate) runs strictly before `parcelGeo()` calls at `service.ts:181-184` |
| Empty loadout = unrestricted; non-empty = must be equipped | ✅ verified | `service.ts:175`: `if (profile.loadout.length > 0 && !profile.loadout.includes(specId))` — exactly this semantics, matches the documented design call |
| Loadout can't reference an unowned/unknown spec (edge case) | ✅ verified, pre-existing guard | `setLoadout()` (`service.ts:103-114`) already rejects any id not in `ownedIds` before persisting — `profile.loadout` can never contain a spec the player doesn't own, so the new gate can't be defeated or bypassed by a stale/bogus id |
| Case sensitivity / whitespace edge case | ✅ not applicable | `specId` values are fixed catalog constants (`shared/weapons/catalog.ts`), never free-text user input; `getWeapon(specId)` already 404s on anything not in the catalog before the gate is reached |
| `eligibleStrikes()` takes the same gate, same semantics, defaults to `[]` when omitted | ✅ verified | `weaponStrike.ts:90` (`loadout: string[] = []`), filter at `:93`: `(loadout.length === 0 || loadout.includes(e.spec.id))` — identical logic to the server gate |
| `StrikePanel.tsx` passes `profile.loadout` (not owned-weapon ids) | ✅ verified | `StrikePanel.tsx:50`: `catalog.data.profile.loadout` passed as the 4th arg to `eligibleStrikes(...)` — the actual equipped-spec-id array, not `ownedWeapons` |
| Empty-state message distinguishes "own none" vs. "none equipped" | ✅ verified | `StrikePanel.tsx:108-111` branches on new `hasOwnedOffensiveWeapons(catalog.data.entries)` |
| ArmoryPanel "FR"→"ASCEND" fix | ✅ verified | `ArmoryPanel.tsx`: `Unlock · {e.unlockCost} FR` → `Unlock · {e.unlockCost} ASCEND` |
| Upgrade button shows cost, gains max-tier disabled state, no off-by-one | ✅ verified | `ArmoryPanel.tsx:260-270`: `owned.upgradeTier < MAX_WEAPON_UPGRADE_TIER` shows `Upgrade · {upgradeCostAscend(...)} ASCEND`, else a disabled "Max tier" pill; server's own guard in `upgradeWeapon()` (`service.ts:126`) blocks at `owned.upgradeTier >= MAX_WEAPON_UPGRADE_TIER` — the two conditions are logical complements, no off-by-one between client display and server enforcement (`MAX_WEAPON_UPGRADE_TIER = 5`, `shared/weapons/profile.ts:132`) |
| `BottomNav.tsx` deletion is safe — nothing else imports it | ✅ verified | Full-repo grep for `BottomNav` after the diff: zero remaining `import`/`from` references anywhere in code; all remaining hits are prose in docs/session-notes/comments (historical/descriptive only). Confirmed independently by clean `tsc` and clean production `build` |
| `panelNav.ts` `NavTab` relocation — no circular import / duplication | ✅ verified | `panelNav.ts` now *defines* `NavTab` itself (no import); `GameLayout.tsx`, `HudShell.tsx`, `hud-shell.spec.tsx` all updated to `import ... from "@/lib/panelNav"`; no second `NavTab` declaration survives anywhere (grep confirms) |
| New server test's isolation claim (bogus parcel ids rely on gate running before parcel lookup) | ✅ verified | Read `fireWeapon()` in full: gate at lines 165-177 precedes `parcelGeo()` at 181; `parcelGeo` throws the literal string `"Parcel not found"` (`service.ts:37`), matching the tests' `/parcel not found/i` expectation exactly for the two gate-passing cases |
| `tsc` clean | ✅ verified | Reproduced: `pnpm --filter @workspace/frontier-al run check` — no output, exit clean |
| `test:server` 449 passed / 24 skipped | ✅ verified | Reproduced exactly: "Test Files 55 passed \| 7 skipped (62)", "Tests 449 passed \| 24 skipped (473)" |
| `coverage:server` 94.54% lines | ✅ verified | Reproduced exactly: "Lines : 94.54% ( 416/440 )", gate is ≥80% |
| client `test` 303 passed | ✅ verified | Reproduced exactly: "Test Files 53 passed (53)", "Tests 303 passed (303)" |
| `build` clean | ✅ verified | `pnpm --filter @workspace/frontier-al run build` completed, client + server bundles produced; only pre-existing, unrelated warnings (chunk-size advice, a PostCSS `from`-option notice, an `eval` notice from the third-party `lottie-web` dependency) — none touch this PR's files |
| No funds/ASA/mainnet/`wip/atomic-purchase`/globe-cinematics code touched | ✅ verified | See Scope section — confirmed empty diff against those paths and the off-limits cinematics files |

## Scope creep
None beyond the minor scope-claim omission noted above (two docs files not individually named
in the PR body's file list, but present in the same commit range, both pure documentation).
No functional scope creep — no file outside the stated weapons/Armory/nav-cleanup surface was
touched.

## Untested assertions
None found. Every behavioral claim (gate order, empty-vs-non-empty semantics, max-tier
button state, BottomNav safe-to-delete) is backed either by a new unit test or by a
grep/read verification independently reproduced in this audit. The "no headless visual
verification" gap is explicitly disclosed by the PR itself (honest gap, not an
over-claim) — reasonable given the change is a pure logic gate plus label/cost text, with
no new layout.

## Security
- No funds, ASA, wallet, or auth code touched. The loadout gate is a game-logic
  authorization check (which owned item may be used), not a funds-movement or
  signature-verification path.
- The new gate is fail-closed in the correct direction for a game-balance rule: an
  attempt to fire an unequipped-but-owned weapon is rejected with a clear error, and the
  gate cannot be bypassed by an unowned/unknown spec id because `setLoadout` already
  validates ownership before persisting a loadout entry.
- No new input surface: `specId`/`loadout` were already validated server-side
  (`getWeapon`, `setLoadout`'s ownership check, and the existing `setLoadoutActionSchema`
  zod schema in `shared/weapons/profile.ts` capping loadout length at 8) before this PR;
  this PR only adds a read of already-validated state.

## What could NOT be verified
- Real end-to-end/browser confirmation that the Strike panel UI actually reflects the
  gate in a live session (the PR's own disclosed gap — no headless visual pass this
  unit, reasonable given the change is logic + copy only).
- The PR is currently marked **draft** on GitHub. This doesn't affect the code audit, but
  it must be converted to "ready for review" before a normal merge action will succeed —
  worth flagging as an administrative step, not a code gap.

## Recommendation
Merge. All claimed test numbers were independently reproduced exactly (tsc clean, server
449/24 skipped, coverage 94.54% lines, client 303 passed, clean build), CI is green on the
actual head commit, the loadout-gate semantics (server and client) are correct, consistent
with each other, and correctly ordered relative to the parcel lookup, the Armory UX fixes are
correct and off-by-one-free, and the `BottomNav.tsx` deletion is verified safe by a full-repo
grep, not just the files the PR claims to touch. Only action item before/at merge: convert
the PR out of draft status, and optionally amend the PR body's file list to include the two
docs files it omitted (cosmetic).
