/**
 * script/testnet-nft-smoke.ts — end-to-end TestNet NFT smoke test.
 *
 * Mints one of each NFT type through the real chain service (plot, commander,
 * weapon) and records a sub-parcel upgrade note, then prints explorer links.
 * Pure chain smoke — NO database writes, no game state.
 *
 * Requires env: ALGORAND_ADMIN_MNEMONIC, ALGORAND_ADMIN_ADDRESS,
 * ALGORAND_NETWORK=testnet (refuses to run on mainnet). The admin account
 * needs ~1 ALGO to cover minimum balance increases (0.1 per ASA) + fees.
 *
 * Run: pnpm --filter @workspace/frontier-al exec tsx script/testnet-nft-smoke.ts
 */

import { getAlgodClient, getAdminAccount, getNetwork } from "../server/services/chain/client";
import { mintLandNft } from "../server/services/chain/land";
import { mintCommanderNft } from "../server/services/chain/commander";
import { mintWeaponNft } from "../server/services/chain/weapon";
import { recordUpgradeOnChain } from "../server/services/chain/upgrades";

const SMOKE_PLOT_ID = 20999; // top of the 21,000-plot range — not a live sale plot
const BASE_URL = process.env.PUBLIC_BASE_URL ?? "https://frontiernext.fly.dev";

function explorer(assetId: bigint | number): string {
  return `https://lora.algokit.io/testnet/asset/${assetId}  ·  https://allo.info/asset/${assetId}`;
}

async function main() {
  const network = getNetwork();
  if (network === "mainnet") {
    throw new Error("SMOKE TEST REFUSED: ALGORAND_NETWORK=mainnet. This script is TestNet-only.");
  }

  const admin = getAdminAccount();
  const addr = admin.addr.toString();
  const algod = getAlgodClient();
  const info = await algod.accountInformation(addr).do();
  const balanceAlgo = Number(info.amount) / 1e6;
  console.log(`network=${network} admin=${addr} balance=${balanceAlgo} ALGO`);
  if (balanceAlgo < 1) {
    throw new Error(`Balance ${balanceAlgo} ALGO is too low — fund ${addr} with ≥1 TestNet ALGO first.`);
  }

  console.log(`\n[1/4] Minting plot NFT (plot #${SMOKE_PLOT_ID})...`);
  const plot = await mintLandNft({ plotId: SMOKE_PLOT_ID, receiverAddress: addr, metadataBaseUrl: BASE_URL });
  console.log(`  ✅ assetId=${plot.assetId} tx=${plot.createTxId}\n  ${explorer(plot.assetId)}`);

  console.log("\n[2/4] Minting commander NFT (tier=sentinel)...");
  const commander = await mintCommanderNft({
    commanderId: `smoke-${Date.now()}`,
    tier: "sentinel",
    receiverAddress: addr,
    metadataBaseUrl: BASE_URL,
  });
  console.log(`  ✅ assetId=${commander.assetId} tx=${commander.createTxId}\n  ${explorer(commander.assetId)}`);

  console.log("\n[3/4] Minting weapon NFT (spec=msl_ballistic_2)...");
  const weapon = await mintWeaponNft({
    ownedWeaponId: `smoke-${Date.now()}`,
    specId: "msl_ballistic_2",
    receiverAddress: addr,
    metadataBaseUrl: BASE_URL,
  });
  console.log(`  ✅ assetId=${weapon.assetId} tx=${weapon.createTxId}\n  ${explorer(weapon.assetId)}`);

  console.log("\n[4/4] Recording sub-parcel upgrade note (0-ALGO self-transfer)...");
  const txid = await recordUpgradeOnChain({
    plotId: SMOKE_PLOT_ID,
    subIndex: 4,
    biome: "highlands",
    improvementType: "mining_rig",
    level: 1,
    playerId: "smoke-test",
  });
  console.log(`  ✅ tx=${txid}\n  https://lora.algokit.io/testnet/transaction/${txid}`);

  console.log("\nAll four chain flows succeeded on TestNet. 🎉");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("❌ smoke test failed:", err);
    process.exit(1);
  },
);
