# 2026-07-07 — Wallet-popup-storm recovery (8+ Pera/WalletConnect popups on load)

Owner report: opening the web app triggers 8+ Pera/WalletConnect popups back-to-back on
page load — locked out of the homepage. Traced to root cause and shipped a targeted
recovery mechanism; did not (and could not, without live device access) attempt to alter
the third-party SDK internals where the storm actually originates.

## Root cause, traced by reading the actual SDK code (not guessed)

`@txnlab/use-wallet-react`'s `WalletProvider` calls `manager.resumeSessions()` exactly
**once** per app mount:

```js
const resumedRef = React.useRef(false);
React.useEffect(() => {
  if (!resumedRef.current) {
    manager.resumeSessions();
    resumedRef.current = true;
  }
}, [manager]);
```

Confirmed via the installed package's `dist/index.cjs` — this is **not** a React
re-render bug in this app's own code (no missing dependency array, no effect re-firing).
`WalletManager.resumeSessions()` then runs every configured wallet's `resumeSession()` in
parallel (`Promise.all`). Pera's `resumeSession()` has an early guard:

```js
if (!walletState) {
  this.logger.info("No session to resume");
  return;
}
...
const accounts = await client.reconnectSession();
```

`walletState` comes from `@txnlab/use-wallet`'s own persisted store
(`localStorage["@txnlab/use-wallet:v4"]`) — only proceeds to call
`PeraWalletConnect.reconnectSession()` if this app previously recorded a session. **That
one call** is where the storm actually happens: if a browser has accumulated multiple
stale/abandoned WalletConnect pairing topics underneath (crashed connects, cross-origin
hops, abandoned tabs — exactly the same class of bug `shouldPurgeBeforeConnect`/
`purgeStaleSession` already guard against on the *manual* connect path, added in an
earlier session), Pera's own `reconnectSession()` (inside the third-party
`@perawallet/connect` package, not this app's code) resurfaces every stale pairing as its
own popup. This fires on **every page load**, before the player can click anything, and
with **zero signal in this app's own UI** — `resumeSessions()` runs entirely inside the
SDK's own provider effect, invisible to `WalletContext`'s `error` state.

There is no public API on `WalletManager` to selectively forget a stuck session —
`disconnect()` only acts on wallets already `isConnected`, which a hung resume may never
reach.

## The fix

Since the storm mechanism lives inside a third-party dependency we don't control, the
correct, safe, deliverable fix is a **recovery escape hatch**, not a patch to SDK
internals:

- **`client/src/lib/walletReset.ts`** (new) — `WALLET_RESET_STORAGE_KEYS` (the app's own
  wallet-identity keys plus use-wallet's own persisted key) and `clearWalletStorage()` /
  `resetWalletConnection()`. Clearing `@txnlab/use-wallet:v4` alone is sufficient to stop
  `resumeSession()` from ever calling `reconnectSession()` again — confirmed by reading the
  guard above — without needing to reach into WalletConnect's own low-level pairing
  storage (fragile, version-coupled, undocumented). The player just reconnects normally
  afterward through the existing `connect()` flow, which already purges stale pairings for
  whichever wallet they pick.
- **`client/src/components/game/WalletConnect.tsx`** — a small, low-key "Trouble
  connecting? Reset wallet connection" link, wired into both the **"restoring"** state
  (the state actually visible while a storm is firing — the popups are separate browser
  windows, this page's own DOM stays interactive underneath) and the plain not-connected
  connect-gate. Not shown once genuinely connected.
- **`WalletContext.tsx`** — small refactor, named the two inline `"frontier_wallet_type"`/
  `"frontier_wallet_address"` string literals as exported constants
  (`WALLET_TYPE_KEY`/`WALLET_ADDRESS_KEY`) so `walletReset.ts` doesn't duplicate raw
  strings.

## Honest gap — the SDK-internal-key coupling

`"@txnlab/use-wallet:v4"` is an internal storage key of the installed package version
(4.6.0), not a documented public API. If `@txnlab/use-wallet` is ever upgraded, this key
should be re-verified (search the new `dist/index.cjs` for `LOCAL_STORAGE_KEY =`) —
flagged in `walletReset.ts`'s own doc comment so it isn't missed.

## Honest gap — not reproduced live

This sandbox has no real Pera wallet/WalletConnect session to reproduce the actual storm
against, so the recovery flow (click link → storage cleared → reload → clean reconnect)
has **not** been exercised end-to-end on a real device. What IS verified: the exact
mechanism read directly from the installed SDK's own source (not assumed), the precise
key that gates it, and that clearing that key is a `return` away from where the
problematic third-party call is made. The owner should confirm on the device that was
actually stuck.

## Tests

- `client/tests/walletReset.spec.ts` (new, 6 cases) — pins `WALLET_RESET_STORAGE_KEYS`'
  exact contents (the part most likely to silently drift), confirms `clearWalletStorage`
  calls `removeItem` for every key via dependency injection (no jsdom needed), confirms
  it's best-effort (doesn't throw if a key removal fails, still attempts every key), is a
  no-op for undefined storage (SSR-safe), and confirms it also clears the session auth
  token via `clearAuthToken()`.
- `client/tests/walletConnectResetLink.spec.tsx` (new, 3 cases) — guards the actual UI
  wiring: the reset link renders in "restoring" and plain not-connected states, and does
  NOT render once genuinely connected.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 320 passed (was 311; +9 new)
- `pnpm run test:server` — 449 passed, 24 skipped (unchanged — no server files touched)
- `pnpm run build` — clean production build
