import { WalletManager, WalletId, NetworkId } from "@txnlab/use-wallet";
 
const network = import.meta.env.VITE_ALGORAND_NETWORK === "mainnet"
 ? NetworkId.MAINNET
 : NetworkId.TESTNET;
 
export const walletManager = new WalletManager({
 // Only the two wallets the owner uses — fewer options means no multi-window
 // connect storm on mobile (dropped Defly + Kibisis). Lute first (primary).
 wallets: [WalletId.LUTE, WalletId.PERA],
 defaultNetwork: network,
});
