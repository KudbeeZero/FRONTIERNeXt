# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- One agent takes a unit **end-to-end** and opens the PR; that PR goes through audit.
- The next unit **does not start** until the current PR's audit PASSes **and** it is
  merged/closed.

## Current baton
- **Branch:** `claude/aether-voice-pipeline-handoff-b92ai1` (pushed) → **PR
  [#38](https://github.com/KudbeeZero/FRONTIERNeXt/pull/38)** into `main`
  (**draft**). **This is the one active PR.**
- **Audit status:** `AWAITING_AUDIT`.
- **➡️ NEXT CHAT STARTS HERE:** `/handoff-audit` on **PR #38** and gate it
  (PASS → merge; CONCERNS → ask; FAIL → don't merge).
- **PR housekeeping:** **#37** (aether Phase-1 verify/harden) — **MERGED** to `main`
  (`16570f9`). The previous baton still showed it `AWAITING_AUDIT`; it was already
  merged. #38 builds on that merged base. The out-of-band "audio work" the #37 baton
  warned about **is this PR** — it touches `audioEngine.ts` but only **adds**
  `speakLine` + a VO path; the #37 volume/voice-gate/suspend code is untouched, so
  the anticipated conflict did not materialize.

## What this chat did (for the auditor)
**Unit: Chapter 1 voice pipeline + 15 generated VO lines, in `apps/aether-journey/`.**
Client-only; does **not** touch `frontier-al`, globe, server, funds/ASA/mainnet.
- **Corrected the handoff to the real stack.** `AETHER_VOICE_PIPELINE_HANDOFF.md`
  assumed `apps/mobile` (Expo/Metro, `require()` maps, voice "Matilda"). The real app
  is **Vite + React + R3F**. Adapted: `?url` imports (committed
  `src/lib/voice/index.generated.ts`), output to `src/assets/voice/ch1/`, voice =
  **Sarah `EXAVITQu4vr4xnSDxMaL` / `eleven_v3`** per `AETHER_STORY_PASS_1.md` §7, and
  all **15** Ch.1 lines authored from §11 (the handoff shipped only 2).
- **Pipeline** (`scripts/voice/`): native `fetch`, retry/backoff/timeout, key
  redaction, 50k-char/run cost cap, atomic writes, content-hash idempotency,
  auto-archiving regen. `pnpm voice:dry|generate|one`.
- **Audio generated this session** with the user-supplied key (env only — **not in
  the diff**; `.env` gitignored; tree scanned clean). 15 MP3 + sidecars; `failed=0`;
  idempotent re-run all-skipped.
- **Integration:** `audioEngine.speakLine()` = ElevenLabs clip when present, Web
  Speech fallback otherwise (mute/volume/voice-toggle/pause all apply). Driver routed
  through it; **one** real line (`ch1_s13_aether_01`, the diagnostic request) wired
  end-to-end with matching subtitle as proof.

## Audit checklist (for the next /handoff-audit)
| Claim | How to verify |
|---|---|
| Scope app-only | diff touches `apps/aether-journey/**`, `.gitignore`, `pnpm-lock.yaml` only |
| No secret committed | `grep -rn "sk_" --exclude-dir=node_modules` empty; `.env` gitignored |
| App typechecks/builds | `pnpm --filter @workspace/aether-journey check`/`build` → 0 errors; 15 clips in `dist/assets` |
| Pipeline idempotent + capped | dry-run `failed=0`; re-run all-skipped; `MAX_CHARS_PER_RUN` guard |
| VO + fallback works | `audioEngine.speakLine` plays clip else `speak`; proof line `ch1_s13_aether_01` |
| Subtitles from script | proof line `text` == manifest `text`; manifest text never used for captions |
| Honesty: not audibly verified | check + build + dry-run only; on-screen/audible playback **NOT** browser-confirmed |

## NEXT chat
- **Recommended next unit:** reconcile `apps/aether-journey/src/data/dialogue.ts` to
  the canonical Ch.1 §11 script and assign `voiceId` to the remaining 14 lines, so all
  of Chapter 1 plays the cast VO (currently only the one proof line does). Keep each
  line's subtitle `text` == manifest `text`.
- **Also queued (one unit each):**
  - Voice CI: auto-regen-on-manifest-change workflow (needs repo secrets
    `ELEVENLABS_API_KEY` + a bot token); intentionally left out of #38.
  - (carried) code-split note now moot for clips; the three.js chunk split landed in #37.
  - (frontier-al, carried) `feat/hud-desktop-nav`; v11 glass info panels on real data;
    `feat/rate-limit-actions`; idempotency for `/api/sub-parcels/:id/build`; algod-first
    finality in `verifyAlgoPayment` (**funds → `algo-auditor` + `/security-pass`**).
- **Open risks:**
  - ⚠️ #38 is **NOT** audibly/browser-verified — `check` + `build` + generator only.
  - ⚠️ `eleven_v3` is alpha; the generated takes are first-pass. Spot-listen
    `ch1_s13_aether_die_01` before relying on the performance; recasting Sarah would
    invalidate all 15 clips.
  - The full story bible `AETHER_STORY_PASS_1.md` is **not committed** — the manifest's
    `text`/`notes`/`beat` carry the provenance for the VO. Commit the bible separately
    if it needs to live in-repo.
- **Off-limits:** do not touch the 3D globe (`components/game/globe/**`) or combat/
  canvas code; no funds/ASA/transfer code to mainnet without `/mainnet-gate` **and**
  `algo-auditor`; nothing in `ops/kestra/` may point at mainnet. Do not reintroduce
  mock/demo data into plot/HUD surfaces.
