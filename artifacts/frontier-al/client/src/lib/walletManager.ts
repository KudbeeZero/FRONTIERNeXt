import { WalletManager, WalletId, NetworkId } from "@txnlab/use-wallet";
 
const network = import.meta.env.VITE_ALGORAND_NETWORK === "mainnet"
 ? NetworkId.MAINNET
 : NetworkId.TESTNET;
 
export const walletManager = new WalletManager({
 wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.KIBISIS, WalletId.LUTE],
 defaultNetwork: network,
});
