# 2026-07-06 — Deploy cleanup: drop Heroku/Railway, consolidate on Fly.io + Cloudflare Pages

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #201
merged) · **Unit:** owner request — single-operator setup, Fly.io (backend) +
Cloudflare Pages (frontend) only. Heroku and Railway configs/docs removed.

## What changed

- Deleted `heroku.yml` (root) and `artifacts/frontier-al/railway.toml` — neither
  was ever the actual deployed target; the only real deploy workflow is
  `.github/workflows/fly-deploy.yml`.
- `server/index.ts` — fixed a stale comment attributing the `trust proxy`
  setting to Railway; it's Fly's reverse proxy now (the setting itself is
  unchanged and still correct).
- `artifacts/frontier-al/DEPLOYMENT.md` — replaced with a short, accurate
  pointer to `docs/DEPLOY_FLY.md` (the real, verified backend deploy doc) and
  Cloudflare Pages notes. The old version was a stale generic Render/Vercel
  guide referencing `npm`/old paths that no longer apply to this pnpm
  workspace.
- `artifacts/frontier-al/docs/DEPLOYMENT_ENV_CHECKLIST.md` — retitled and
  re-pointed from "Railway + Vercel" to "Fly.io + Cloudflare Pages"; all the
  env-var guidance itself was accurate and kept, just the host names in
  headers/prose/the copy-paste block were swapped.
- `artifacts/frontier-al/ENV_VARS.md` — same host-name swap in the two section
  headers and a few inline mentions (`PUBLIC_BASE_URL`, `CLIENT_ORIGIN`,
  `PORT`). Most of this file was already accurate/dated 2026-07-06 (the
  VITE_API_URL/VITE_WS_URL runtime-fallback notes already correctly reference
  Fly).
- Both READMEs (root + `artifacts/frontier-al/`) — the one-line deployment
  pointer and the frontier-al README's old "Railway (Recommended) / Render /
  DigitalOcean" options section replaced with a pointer to `DEPLOYMENT.md` +
  `docs/DEPLOY_FLY.md`.

Deliberately left alone: dated session-notes (historical record, not rewritten)
and old speculative/audit "LUT" docs that mention Railway in a historical
context — those aren't deploy config, rewriting them would be revisionist.

## Verification

Docs + config only, no behavior change. tsc clean · server 446/14 skipped ·
client 278 (both unchanged from before this cleanup) · not rebuilding since no
source logic changed beyond one comment string.

## For the next session

This closes out the "Heroku/Railway, delete everything" request. Continuing
next: the owner's three other asks from the same message — (1) playtest agents
purchasing/assigning commanders to plots, (2) a specialized agent auditing the
right-side menu system (bugs + an Armory visual rework), (3) scoping the
"2.5D Google-Earth plot + cinematic globe layers (faction/economy/nature)"
vision. Research for all three was kicked off in parallel; see the next
session note(s) for findings and the resulting plan.
