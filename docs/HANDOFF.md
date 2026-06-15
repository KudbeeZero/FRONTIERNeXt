# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — NEW, LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- One agent takes a unit **end-to-end** and opens the PR; that PR goes through audit.
- The next unit **does not start** until the current PR's audit PASSes **and** it is
  merged/closed.
- ❌ **Retired:** the old "push straight to `main` / merge with no PR" style (early
  GrowPod work). No more multiple PRs open at once — too confusing.

**Orchestration (per the user, this session):**
- `AGENT_ORCHESTRATION_LEDGER.md` (**REC-004**) is **live and a PROTECTED surface** —
  treat it as authoritative.
- The **pre-work checklist is mandatory**, and you must **claim the surface(s) you
  will touch in the ledger BEFORE starting** work.
- Hand work off using the **5-field Work Order** format.
- ⚠️ **HONEST FLAG:** I could **not locate `AGENT_ORCHESTRATION_LEDGER.md`** in this
  branch, on `origin/main`, or in any git ref this session (no `REC-004` / "Work
  Order" references are tracked). Next agent: **confirm where the ledger lives /
  restore it** before relying on it — do not assume its contents.

## Current baton
- **Branch:** `claude/aether-phase1-verify-harden` (pushed) → **PR
  [#37](https://github.com/KudbeeZero/FRONTIERNeXt/pull/37)** into `main`
  (**draft**). **This is the one active PR.**
- **Audit status:** `AWAITING_AUDIT` — but **playtested PASS** this chat.
- **➡️ NEXT CHAT STARTS HERE:** `/handoff-audit` on **PR #37** and gate it
  (PASS → merge; CONCERNS → ask; FAIL → don't merge).
- **Playtest (this chat — headless Chromium, real software WebGL):** boots clean,
  **zero page errors**; 3D scene renders (hologram + cockpit + Mars + HUD); pause
  menu (☰ / Esc) shows all 5 settings; **volume slider** drives + persists
  (`"volume":0.4`); **subtitles** toggle persists + clean caption renders on
  screen; **Esc closes** the menu. One cosmetic nit: the subtitle caption overlaps
  the main dialogue box (you see the line twice) — small fix queued, not yet done.
- **PR housekeeping (this chat):**
  - **#36** (aether Phase-1 base, `claude/aether-journey-phase-1-lvgr0b`) —
    **MERGED** to `main` (`a06bbcc`, 16:52Z). The previous baton wrongly showed it
    `AWAITING_AUDIT`; it was already merged. **#37 builds on it.**
  - **#35** (docs: REC-004 ledger recovery + #34 retro-audit) — **CLOSED**
    (deferred, *not* merged) to keep a single active PR. Branch
    `claude/pr34-audit-ledger-recovery-m3xpvm` preserved → revivable.
  - **#33 / #34** — merged previously; `main` is clean (no `FloatingPlotWidget` /
    `AttackModal` / `right-reports/`).
- **⚠️ Out-of-band:** another agent is working on **audio** separately. #37 also
  edits `apps/aether-journey/src/lib/audioEngine.ts` (volume / voice-gate /
  suspend-resume) — **watch for a merge conflict there** when the audio work lands.
- **⚠️ REC-004 ledger still absent on `main`:** #35 (which recreated
  `docs/AGENT_ORCHESTRATION_LEDGER.md`) is closed, so the file does **not** exist
  on `main`. Restore from #35's branch before relying on it.

## What this chat did (for the auditor)
**Unit: new app `apps/aether-journey/` — FRONTIER: Aether's Journey, Phase 1.**
A high-polish, **client-only** cinematic prologue (Vite + React 18 + TS + R3F).
Fully self-contained; does **not** touch `frontier-al`, the globe, combat,
server, or any funds/ASA/mainnet code.
- **Wake-up:** fade-from-black + bloom/vignette/film-grain post; a battered
  cockpit (flickering damaged panel, drifting god-ray dust), Mars in the
  forward viewport (`three/SceneCanvas.tsx`, `Cockpit.tsx`, `ForwardViewport.tsx`,
  `DustMotes.tsx`).
- **Aether:** elegant glitching hologram whose color/jitter/dropout are
  **data-driven by `aetherStability`** — she steadies as she heals
  (`three/AetherHologram.tsx`). Live text corruption (`ui/GlitchText.tsx`,
  `lib/glitch.ts`) + modulated Web Speech (`lib/audioEngine.ts`).
- **Interaction:** constrained orbit look, in-world clickable diagnostic control
  (`three/DiagnosticConsole.tsx`), and a **press-&-hold neural-node realignment**
  repair (`three/NeuralRepair.tsx`) with payoff.
- **State foundation:** Zustand store (`store/gameStore.ts`) with an
  on-chain-ready `OnchainEvent` ledger (`seq + ts + kind + payload`,
  `store/types.ts`) shaped to flush to Algorand boxes/ASAs later; visible Ledger
  panel (`ui/OnchainLedger.tsx`).
- **Wiring:** `apps/*` added to `pnpm-workspace.yaml` (+1 line); lockfile +1 pkg.
  All audio synthesized at runtime — **no binary assets**.

## Audit checklist (for the next /handoff-audit)
| Claim | How to verify |
|---|---|
| Net-new + isolated | Diff touches only `apps/aether-journey/**`, `pnpm-workspace.yaml` (+`apps/*`), `pnpm-lock.yaml`. No `artifacts/frontier-al/**`, `globe/`, `server/`, ASA/mainnet/secret changes |
| CI unaffected | `.github/workflows/ci.yml` filters to `@workspace/frontier-al`; `pnpm install --frozen-lockfile` succeeds with committed lockfile |
| App typechecks | `pnpm --filter @workspace/aether-journey check` → 0 errors |
| App builds | `pnpm --filter @workspace/aether-journey build` → vite bundle produced |
| On-chain-ready state | `store/types.ts` `OnchainEvent`; every meaningful action calls `logOnchain` in `store/gameStore.ts` |
| No binary assets | No audio/image files added; Web Audio (`lib/audioEngine.ts`) + Web Speech only |
| Honesty: not browser-verified | tsc + vite build + dev HTTP 200 only; on-screen look, post-FX, hologram, speech, hold-to-align repair are **NOT** screenshot-confirmed |

## NEXT chat
- **Recommended next unit:** Aether's Journey **Phase 1 polish pass** — first
  playtest then targeted refinement of lighting/materials, Aether's
  glitch/personality, and repair-interaction feel (per the iterative-dev rules:
  small, targeted diffs only — do NOT rewrite files wholesale).
- **Also queued (one unit each):**
  - Aether's Journey: code-split the ~1.1 MB three.js chunk; add a browser/visual
    verification harness (currently unbooted).
  - (frontier-al, carried) `feat/hud-desktop-nav` — adopt the HUD `Dock` on
    desktop, reconciling dock-vs-rail nav redundancy.
  - (frontier-al, carried) port v11 **glass info panels** onto real data via
    `GlassPanel` (real props only — the #32 FAIL lesson); HUD runtime/visual
    verification; `feat/capsule-nav-drawers`; **step 3** duplicate plot feed;
    `feat/rate-limit-actions`; `chore/registerRoutes-testable`; idempotency for
    `/api/sub-parcels/:id/build`; algod-first finality in `verifyAlgoPayment`
    (**funds → `algo-auditor` + `/security-pass`**).
- **Open risks:**
  - ⚠️ Aether's Journey is **NOT browser/visually booted** — typecheck + build +
    dev HTTP 200 only; on-screen behavior/appearance unverified.
  - ⚠️ Single ~1.1 MB JS chunk (three.js); not code-split.
  - ⚠️ Fonts load via Google Fonts `<link>`; offline/CSP falls back to
    system-ui/monospace. Web Speech voice availability varies; degrades silently.
  - (Carried, frontier-al) HUD shell SSR-tested only; replay protection lasts the
    TTL; no rate limit on `/api/actions/*`; no HTTP route-mount test; migrations
    `0005`–`0008` before deploy; `verifyAlgoPayment` finality indexer-only;
    confirm `VITE_TEST_GLOBE` reads `false` before deploy.
- **Off-limits:** do not touch the 3D globe (`components/game/globe/**`) or combat/
  canvas code; no funds/ASA/transfer code to mainnet without `/mainnet-gate` **and**
  `algo-auditor`; do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` may
  point at mainnet. **Do not reintroduce mock/demo data into plot/HUD surfaces.**
