# 2026-06-28 — Wallet connect reliability + version 2.0.1

**Branch:** `claude/wallet-dashboard-redesign-b78nwa`
**Trigger:** owner reported "I hit connect wallet Lute and it keeps spinning," + wants the
build labelled TestNet 2.0.1. First unit of a larger wallet+dashboard push.

## What shipped (client-only, no funds/ASA/server change)

1. **Lute registered with `options.siteName: "FRONTIER"`** (`client/src/lib/walletManager.ts`).
   use-wallet v4 passes `siteName` to `new LuteConnect(siteName)` and uses it to label the
   extension's approval popup. The bare `WalletId.LUTE` registration left it undefined.
2. **Wallet-aware connect timeout** (`client/src/contexts/WalletContext.tsx`):
   - New `connectTimeoutFor(walletId)` → extension wallets (Lute, Kibisis) get
     `EXTENSION_CONNECT_TIMEOUT_MS = 30_000`; QR/mobile wallets keep `CONNECT_TIMEOUT_MS = 90_000`.
   - Rationale: an extension popup surfaces *instantly* — there's no phone-grab/QR-scan latency
     to wait out — so a 90s budget turned a wedged Lute handshake into the "spins forever" the
     owner saw. 30s makes a stuck connect a fast, recoverable "Try Again" instead.
   - Lute/Kibisis now get an **extension-specific timeout message** ("make sure it's unlocked
     and the approval popup isn't blocked") instead of the generic one.
3. **Single-source version → "TESTNET V2.0.1"** (`client/src/lib/version.ts`, used by
   `TopBar.tsx`). The badge previously hard-coded "V1.1" while `package.json` had drifted to
   `2.0.0`. Bumped `package.json` to `2.0.1` and pointed the badge at the constant so they
   can't drift again.

## Tests (fail-before / pass-after)
- New `client/tests/walletConnect.spec.ts` (6 cases): `connectTimeoutFor` picks the right
  budget per wallet; extension budget < QR budget; `friendlyErrorMessage` gives Lute/Kibisis
  extension guidance on timeout and never echoes the internal `CONNECT_TIMEOUT` sentinel.
- Exported `connectTimeoutFor`, `EXTENSION_CONNECT_TIMEOUT_MS`, and `friendlyErrorMessage`
  from `WalletContext` for the test.

## Green on head
- `check` (tsc) — clean
- `test` (client) — **195 passed** (was 189 + 6 new)
- `test:server` — **411 passed / 14 skipped**
- `build` — Vite + esbuild OK

## Honest limitation (read this)
The deep Lute hang **could not be reproduced or root-caused on-device** — the sandbox proxy
blocks a real browser from the wallet/extension handshake (same limitation noted in the
2026-06-27 diagnosis). Static analysis confirmed the connect path is otherwise correct:
use-wallet v4's default TESTNET config bakes in `genesisId: "testnet-v1.0"`, so `getGenesisId()`
returns without a network call, and the picker routes Lute correctly. **These changes fix the
*symptom* (infinite-feeling spin → fast, branded, recoverable failure) and the config hygiene;
they are NOT confirmed to make a wedged extension handshake complete.** Owner on-device check
still needed: open Connect → Lute on `frontiernext.fly.dev` and confirm the popup appears and
approves.

## Next units (not in this PR)
- **Branded-domain wallet prompt** — the documented option-A redirect `frontierprotocol.app`
  → `frontiernext.fly.dev` (from the 2026-06-27 diagnosis).
- **Desktop dashboard widget system** — custom dnd-kit snap-grid replacing the bunched fixed
  rails/corners in `GameLayout.tsx`.
