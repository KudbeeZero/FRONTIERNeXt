import { WalletManager, WalletId, NetworkId } from "@txnlab/use-wallet";

const network = import.meta.env.VITE_ALGORAND_NETWORK === "mainnet"
 ? NetworkId.MAINNET
 : NetworkId.TESTNET;

/**
 * Builds the WalletManager. Exported as a factory — NOT constructed eagerly
 * at module scope — because each connector's constructor (Pera's
 * WalletConnect setup, Lute's extension-detection) touches `window`/
 * `indexedDB` immediately, and some mobile browsers/webviews (private-mode
 * Safari historically threw on IndexedDB access; some in-app/OEM webviews
 * restrict it outright) make that throw synchronously. A throw here used to
 * happen at MODULE-EVALUATION time — before `createRoot(...).render()` even
 * runs — so no React error boundary could ever catch it: one bad mobile
 * environment blanked the entire app to a permanent white screen with only a
 * console error nobody on a phone could see. The caller (`App.tsx`)
 * constructs this inside a `useMemo` during React's render phase instead, so
 * a failure here is now a normal render error an `<ErrorBoundary>` can catch
 * and show a real message for.
 */
export function createWalletManager(): WalletManager {
 return new WalletManager({
   // Pera = the MOBILE wallet (works in all browsers incl. Safari). Lute = a
   // desktop browser EXTENSION (the owner's funded wallet) and is NOT available
   // on mobile Safari. Offer both so phone testers use Pera and desktop uses
   // Lute. (Dropped Defly + Kibisis to keep the picker minimal.)
   //
   // Lute MUST be registered with `options.siteName` — use-wallet v4 passes it to
   // `new LuteConnect(siteName)` and it labels the extension's connect popup. A
   // bare `WalletId.LUTE` left the popup unnamed; brand it so the approval prompt
   // reads "FRONTIER" instead of a blank site.
   wallets: [WalletId.PERA, { id: WalletId.LUTE, options: { siteName: "FRONTIER" } }],
   defaultNetwork: network,
 });
}
