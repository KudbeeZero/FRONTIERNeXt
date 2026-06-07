# 2026-06-07 — Site accuracy pass + globe visual upgrades

## Scope
Audit of helpers/instructions, safety/compliance, URLs/sitemaps, the public
landing pages, and the 3D globe color system (per the ASCENDANCY Globe
Engineering LUT). Two merged units.

## Unit 1 — Site accuracy + SEO + links + cleanup (merged)
- **Tokenomics**: corrected to the authoritative model — **10,000,000,000
  $ASCEND** total (5B liquidity-backed + 5B land-minted). Replaced old "21M"
  on the site; added an allocation breakdown; reconciled README with a Token
  Model table (TestNet ASA `755818217` still notes its 1B test mint).
- Kept the **$ASCEND brand** + `@ascendancyalgox` (per owner decision).
- Reframed token-acquisition steps to the real flow (wallet → 500 $ASCEND
  welcome bonus → earn by owning land; DEX = MainNet roadmap).
- Biomes **5 → 8**; replaced fabricated build-% bars with honest
  Live/In-Progress/Planned status; fixed "91% complete" ticker.
- **SEO**: og:image/og:url/twitter cards + canonical + theme-color in
  `index.html`; added `robots.txt` + `sitemap.xml` (canonical
  `https://ascendancyalgo.xyz`).
- **Links**: footer GitHub → real repo; testnet bug link → correct repo; Pera
  link; socials made data-driven so dead Discord/Telegram icons hide until URLs
  are added.
- **Cleanup**: removed dead `enableAutoConnect` prop (WalletContext + App.tsx);
  gated `algorand.ts` debug logging behind `import.meta.env.DEV` / `VITE_DEBUG`.

## Unit 2 — Globe visual pass (merged)
- **Finding**: the color palettes already render correctly. Tiles use
  `meshBasicMaterial` + `toneMapped={false}` (unlit, full-saturation), so all 8
  biome + player/enemy/selected colors glow regardless of lighting. The LUT's
  "switch to emissive" was based on a lit-material assumption that doesn't hold;
  switching would make colors lighting-dependent and **regress** what works —
  intentionally NOT done.
- **E1**: `plotVisualFingerprint` now prefixed with `currentPlayerId` so the
  base-color pass re-runs the instant the session resolves (own plots flip from
  enemy-red to player-green reliably).
- **E3**: own plots now render a **breathing border-glow** (pulsing
  `COLOR_PLAYER` in `useFrame`) so ownership reads as motion, not just color.
- Removed always-on globe debug logs incl. an orphan `console.timeEnd`.

## Deferred (remaining LUT passes — full-stack, larger)
- E2 emissive — skipped by design (would regress unlit palettes).
- E4 color-customization sliders (client + optional `players.territory_color`).
- E5 sub-parcel archetype colors — needs sub-parcel archetype data plumbed to
  the client `LandParcel` (currently only `subParcelOwnerIds` is available;
  `SubParcelOverlay` is also disabled at the scene level).
- E6 archetype assignment, E7 building system, E8 fog-of-war + scan, E9 observer
  mechanic — full-stack systems; to be built in dependency order
  (schema → server → shared → client → render), additive only, battle engine
  stays pure (effects feed `BattleInput`, never `tuning.ts`).

## Verification
`tsc` clean · `vitest --config vitest.server.config.ts` 98/98 · `build` OK.
