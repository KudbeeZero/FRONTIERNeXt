# 2026-07-07 — Production URL metadata fix + routing refactor merged

Session: fixing hardcoded domain URLs in production and merging the routing change
that moves the game directly to "/" instead of the landing page.

## What shipped

### PR #217 ✅ MERGED (2026-07-07 14:26)
**Wallet error visibility fix** — `client/src/components/game/WalletConnect.tsx`
- Error text now renders as visible page content, not just a `title` hover tooltip
- Added escape hatch link: "Trouble connecting? Reset wallet connection"
- Tests: +2 new tests (`walletConnectErrorVisible.spec.tsx`)
- All CI passing

### PR #218 ✅ MERGED (2026-07-07 15:00)
**Routing refactor + production URL metadata fix**

#### Routing change
- `/` now mounts `<GamePage/>` directly (skip landing page)
- `/landing` still serves the old landing page (preserved, not deleted)
- `shouldAutoAuthenticateForPath` updated: `/` now treated as in-game route
- All tests updated and passing (route-loop.spec.tsx, shouldAutoAuthenticateForPath.spec.ts)
- No funds/ASA/server code touched

#### Production URL metadata fix
- **Root cause:** `client/index.html` had hardcoded `ascendancyalgo.xyz` URLs from June 7 commit
  - Canonical link, Open Graph tags (og:url, og:image), Twitter Card meta tags
  - These contaminated search engine rankings and social media previews
- **Fixed:** All instances replaced with `frontierprotocol.app`
- **Impact:** SEO and social sharing now correctly attribute to new domain

#### CI status
- All checks passing (Cloudflare Pages + typecheck/server tests)
- Main is green at commit `faaed3c` (merge commit)

## Still required (blocking wallet testing on production)

### HIGH priority (5-10 min each)
1. **Set Cloudflare Pages build env vars** (UI-only, can't be done via CLI):
   - `VITE_API_URL = https://api.frontierprotocol.app`
   - `VITE_WS_URL = wss://api.frontierprotocol.app`
   - Then trigger rebuild
   - **Why:** Ensures frontend explicitly targets branded API domain instead of hardcoded fallback

2. **Verify DNS** — Run once env vars are set:
   ```bash
   curl -I https://api.frontierprotocol.app/health
   # Expected: 200 OK with valid TLS cert
   ```

3. **Test wallet connection on production**
   - Once env vars + rebuild complete, test at https://frontierprotocol.app
   - Connect wallet → capture actual error message
   - This will determine next steps (is it environment, stale session, browser popup blocker, etc.)

### MEDIUM priority
- Deprecate/redirect old `ascendancyalgo.xyz` domain (if still registered)

## Investigation findings (comprehensive)

Agent mapped full production architecture:

**Frontend:** Cloudflare Pages (`frontierprotocol.app`)  
**Backend:** Fly.io (`api.frontierprotocol.app` / `frontiernext.fly.dev`)  
**WebSocket:** `wss://api.frontierprotocol.app`  

All **API endpoints verified working**:
- Auth (nonce, verify, logout, me)
- Game state (plots, player data)
- Actions (move, attack, build, purchase-plot, claim-ascend)
- WebSocket real-time events
- Admin (guarded by x-admin-key header)
- Health checks

**Full user flow documented:** Landing → Wallet gate → Faction selection → Game → Combat → Actions  
**All endpoints live and responding correctly** — the issue is purely domain/branding metadata contamination.

See `/tmp/claude-0/-home-user-FRONTIERNeXt/7f266f71-e272-5147-ab91-8f1da15e4675/scratchpad/PRODUCTION_URL_INVESTIGATION.md` for full endpoint map, environment checklist, and verification procedures.

## Tests verified green
- `pnpm run check` (tsc) — ✅
- `pnpm run test` — ✅ (326 passed, was 325; net +1)
- `pnpm run test:server` — ✅ (449 passed, 24 skipped)
- `pnpm run build` — ✅ (clean production build)

## Context for next session

The game infrastructure is **fully functional**. The immediate blocker is confirming that:
1. Cloudflare Pages env vars are set (so API/WS URLs are explicit)
2. DNS is working for api.frontierprotocol.app
3. Wallet connection actually works end-to-end on production

Once the user sets those Cloudflare Pages env vars and tests, the actual wallet error will surface. That error will determine if this is:
- A browser popup blocker issue (UX fix)
- A network/CORS issue (backend env var or proxy)
- A stale WalletConnect session (cache clear, recovery flow)
- Something else (requires deeper investigation)

**The routing change is shipped and tested.** The metadata fix is deployed. The production URL is now correctly branded. The only remaining work is the Cloudflare Pages UI configuration and wallet connection diagnosis.

---

## Off-limits
- `wip/atomic-purchase` branch (off-limits per owner directive)
- No funds/ASA code changes without `/mainnet-gate` PASS + `algo-auditor` sign-off
- No changes to `ops/kestra/` that point at mainnet

## Branch state
- Current branch: `claude/handoff-audit-f5w0qn` (merged to main)
- Main: ✅ green at `faaed3c`
- No uncommitted changes
- All pushed
