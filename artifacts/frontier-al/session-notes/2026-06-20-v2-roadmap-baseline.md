# 2026-06-20 — v2.0.0 baseline + 10-phase buildout roadmap

## Unit
Owner set the official version line: bump to **v2.0.0** now, **v2.1.0 = gold/mainnet**, with
**10 buildout phases** between. This PR is the v2.0.0 baseline: the one-line version bump + the
roadmap doc, consolidated onto the existing open PR ("keep all this on this PR"). Then all 10
`phase/0X-…` branches are created off `main` (markers — one PR still opens at a time).

## Owner decisions (AskUserQuestion, 2026-06-20)
1. **Map = geo-reference REAL Earth** (real lat/long + licensed imagery + snapshot/authenticate
   pipeline). Big epic, sequenced late, **licensing + legal/IP gated**.
2. **"Telepathy" = an in-game INTEL mechanic** (fog-of-war/scouting), gameplay not metrics.
3. **Create all 10 phase branches now.**
4. **Phase-1 opener = battle clock + auto-resolver.**

## What shipped (this PR)
- `artifacts/frontier-al/package.json` `1.0.0` → **`2.0.0`**.
- `docs/V2_ROADMAP.md` (NEW) — the 10-phase plan + gates + grounding facts.
- Removed `docs/NEXT_WORK_OPTIONS.md` (superseded; backlog folded into the roadmap).
- Baton rewrite + this note.

## Grounding (three read-only audits)
- **Battle:** deterministic + atomic core (`server/engine/battle/resolve.ts`, ~93% covered), **but
  the auto-resolver isn't wired into startup** and timing is **wallclock-only (no server clock)** →
  client cooldown drift. → Phase 1.
- **Realtime/telemetry:** solid WS (dirty-flag flush, ping-pong, auth, per-viewer redaction); gaps:
  no backoff, silent failures untelemetered, hardcoded timings (no runtime toggle). → Phases 3–4.
- **Globe/mapping:** fictional planet — parcels' lat/long are Fibonacci math, **not Earth**; no
  geo deps; NFT images static; 2D map + deep-zoom greenfield. Geo-referencing = a real re-anchoring
  epic (Phases 6–9), **licensing + legal/IP gated** (minting NFTs of real locations).

## Phases (→ v2.1.0)
1 battle clock · 2 battle depth · 3 realtime hardening · 4 config+telemetry · 5 intel mechanic ·
6 Earth geo-ref foundation (gated) · 7 Earth imagery pipeline (gated) · 8 2D/2.5D map viewer ·
9 NFT imagery gen · 10 mainnet gold (funds-gated) → tag v2.1.0.

## Verification
`check` ✓ · `test:server`/`test` unchanged (version bump is inert) · CI green. Branches created via
GitHub `create_branch` off `main` `2d55d8a`. No phase code in this PR.

## Next
After this merges: start **`phase/01-battle-clock`** (first Phase-1 PR). One PR at a time; gates per
`docs/V2_ROADMAP.md`.
