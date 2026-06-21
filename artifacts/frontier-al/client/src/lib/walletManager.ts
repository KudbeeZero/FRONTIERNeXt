import { WalletManager, WalletId, NetworkId } from "@txnlab/use-wallet";
 
const network = import.meta.env.VITE_ALGORAND_NETWORK === "mainnet"
 ? NetworkId.MAINNET
 : NetworkId.TESTNET;
 
export const walletManager = new WalletManager({
 // Pera = the MOBILE wallet (works in all browsers incl. Safari). Lute = a
 // desktop browser EXTENSION (the owner's funded wallet) and is NOT available
 // on mobile Safari. Offer both so phone testers use Pera and desktop uses
 // Lute. (Dropped Defly + Kibisis to keep the picker minimal.)
 wallets: [WalletId.PERA, WalletId.LUTE],
 defaultNetwork: network,
});
