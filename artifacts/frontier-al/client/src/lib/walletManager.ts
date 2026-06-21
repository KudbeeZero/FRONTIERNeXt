import { WalletManager, WalletId, NetworkId } from "@txnlab/use-wallet";
 
const network = import.meta.env.VITE_ALGORAND_NETWORK === "mainnet"
 ? NetworkId.MAINNET
 : NetworkId.TESTNET;
 
export const walletManager = new WalletManager({
 // Single wallet = no picker and no app-deep-link tab storm. Lute is a WEB
 // wallet (lute.app) — it signs in-browser, never tries to "open another
 // application," and testers don't need to install anything. (Pera/Defly/
 // Kibisis deep-link to phone apps, which spawned the dozen Safari tabs.)
 wallets: [WalletId.LUTE],
 defaultNetwork: network,
});
