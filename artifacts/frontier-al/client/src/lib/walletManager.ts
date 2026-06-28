import { WalletManager, WalletId, NetworkId } from "@txnlab/use-wallet";
 
const network = import.meta.env.VITE_ALGORAND_NETWORK === "mainnet"
 ? NetworkId.MAINNET
 : NetworkId.TESTNET;
 
export const walletManager = new WalletManager({
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
