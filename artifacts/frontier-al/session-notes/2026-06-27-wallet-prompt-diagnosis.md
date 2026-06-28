# 2026-06-27 — Wallet-prompt on the branded domain: diagnosis (no code fix yet)

**Branch:** `claude/closeout-wallet-diagnosis` (docs/baton only)
**Trigger:** owner reported "trying to play and it's still asking for an ALGO wallet."

## Symptom
Player clicks **Enter Game** and gets the ALGO-wallet connect prompt instead of the
no-wallet `DEV-TEST-COMMANDER` entry.

## Root cause (evidence-backed, live probes)
The game runs as **two separately-built front-ends**, and the no-wallet playtest mode
only exists on one of them:

| Check (live) | `frontiernext.fly.dev` (Fly) | `frontierprotocol.app` (Cloudflare Pages) |
|---|---|---|
| `POST /api/dev/quick-auth` | **200** ✓ returns `DEV-TEST-COMMANDER` session | **405** ✗ (no working dev-login backend) |
| JS bundle `Dev / Test Mode` / `quick-auth` strings | **present** (flags baked) | **absent** — DCE'd out (flags false) |

- `VITE_DEV_MODE` / `VITE_DEV_AUTOLOGIN` are **Fly Docker build args** (`fly.toml [build.args]`
  → `Dockerfile` ARG/ENV). The **Cloudflare Pages** build does **not** receive them, so the
  branded bundle is compiled with `DEV_MODE=false` → no auto-login, no dev button.
- Even with the flags set on Cloudflare, the branded origin **can't complete** the dev login:
  `POST /api/dev/quick-auth` returns **405** there (only Fly serves it at 200). Plus the dev
  session is stored in **origin-scoped localStorage**, lost on the Cloudflare→Fly hop
  (`gameUrl.ts:goToGame()` does a cross-origin `window.location.href`).
- Server side is fine: `DEV_LOGIN_ENABLED=true` on Fly, confirmed by the 200 above.

So: **playing via the branded `frontierprotocol.app` link → wallet prompt, by build.**
Playing via **`frontiernext.fly.dev` directly → works** (flags + backend co-located, same origin).

## Honest limitation
Could **not** browser-verify on-device: the agent proxy blocks headless Chromium from
reaching Fly (`ERR_CONNECTION_CLOSED`), though `curl` works. Diagnosis is from server
responses + the shipped JS bundles, not a click-through.

## Recommended fix (NEXT UNIT — option A)
Make `frontierprotocol.app` **redirect to `frontiernext.fly.dev`** at load (single origin
where flags + backend live), instead of trying to run the entry flow on the branded
static host. Small, code-only, no dashboard access needed.
- Rejected **option B** (set `VITE_DEV_*` in the Cloudflare build): insufficient — the
  branded origin still 405s on `/api/dev/quick-auth`, so auto-login can't complete there.
- Likely touch points: `client/src/lib/gameUrl.ts` (already centralizes host routing) and/or
  the landing entry (`pages/landing.tsx`). Keep it `DEV_MODE`-gated / reversible.

## Also this session
- **PR #164 merged** — `LOCAL_DEV.md` developer quickstart landed on `main`.
- **PR #163 closed unmerged** — Unreal Engine direction dropped (owner's call).
