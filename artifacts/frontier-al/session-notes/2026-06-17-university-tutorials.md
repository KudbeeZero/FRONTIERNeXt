# Session note — 2026-06-17 — FRONTIER University (interactive tutorials)

**Branch:** `feat/university-tutorials` (off `origin/main` @ `cb80a7f`)
**Unit:** add an in-game, replayable "how to play" academy — an interactive walkthrough +
knowledge check for each game system, takeable at any time. Includes the Algorand
**wallet how-to** the user specifically asked for.

## What shipped
- **`shared/university/`** (new, pure — no React/server):
  - `types.ts` — `TutorialModule` (steps + quiz), `QuizQuestion`, `GameSystem`.
  - `curriculum.ts` — 6 modules grounded in the live game: Planet/plots, Weapon Builds &
    Archetypes (incl. the new Swarm Commodore/Quartermaster→loitering payoff), Strikes &
    Defense, ASCEND economy, **Your Algorand Wallet** (connect → opt-in → claim → wait for
    finality), and the four factions.
  - `grade.ts` — pure `gradeQuiz()` (blank/out-of-range = wrong; 0.7 pass threshold) and
    `validateCurriculum()` integrity checker (unique ids, in-range `correctIndex`, ≥2
    options, non-empty steps/quiz).
  - `index.ts` — public surface + `getModule()`.
- **`client/src/components/game/university/UniversityPanel.tsx`** — self-contained,
  local-state panel: course catalog → step walkthrough → interactive quiz → graded result
  with explanations → Retake. No globe/three/server deps.
- **Access (take it any time):**
  - `client/src/pages/university.tsx` + `/university` route in `App.tsx` (no wallet
    required — it teaches mechanics, touches no chain/funds code).
  - GameLayout desktop right-panel **"Academy"** tab (GraduationCap). Did NOT add a mobile
    BottomNav tab (would touch `NavTab`/`BottomNav` — larger surface); the `/university`
    route covers mobile.

## Tests
- `shared/university/university.spec.ts` (7): curriculum integrity (well-formed + catches a
  malformed/duplicate module), every taught system present incl. wallet, and quiz grading
  (perfect → pass; blank → fail; pass-threshold boundary).
- `client/tests/university-panel.spec.tsx` (2): SSR catalog render lists every module
  (HTML-escaped title match — `&` → `&amp;`). Interactive flow is state-driven → needs a
  DOM harness; **not** claimed as covered here (logic is covered in the shared spec).

## Verification (WSL — Windows node can't run this repo)
Via `/home/kudbee/arena-checks.sh`:
- `check` (tsc) → **clean**
- `test:server` → **262/262** (incl. university 7)
- `test` (client) → **57/57** (incl. university panel 2)
- Not run in-browser: the Academy tab/route render (no headless harness) — plain
  data-driven JSX, backed by typecheck + the SSR smoke test.

## Off-limits respected
No globe/combat render core behavior change (added a side-panel tab + route only), no
chain/payment code → **no `/mainnet-gate` trigger**. The wallet module is documentation/UI
only — it explains opt-in/finality, it does not sign or transfer.
