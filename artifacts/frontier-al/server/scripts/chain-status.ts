// Chain status — quick on-chain snapshot of an account (defaults to the admin).
// Shows ALGO balance, min-balance headroom, ASAs created, and ASAs held / opted
// into. Useful before/after a purchase or when assembling the atomic group
// (confirm the admin is funded for fees and holds the plot/commander ASA).
//
// Usage:
//   tsx server/scripts/chain-status.ts                 # the admin account
//   tsx server/scripts/chain-status.ts <ALGO_ADDRESS>  # any account
//
// Requires ALGOD_URL (+ ALGORAND_ADMIN_ADDRESS or ALGORAND_ADMIN_MNEMONIC) in .env.

import "dotenv/config";
import algosdk from "algosdk";

const algod = new algosdk.Algodv2("", process.env.ALGOD_URL ?? "https://testnet-api.algonode.cloud", "");

function adminAddress(): string {
  if (process.env.ALGORAND_ADMIN_ADDRESS) return process.env.ALGORAND_ADMIN_ADDRESS;
  if (process.env.ALGORAND_ADMIN_MNEMONIC) return algosdk.mnemonicToSecretKey(process.env.ALGORAND_ADMIN_MNEMONIC).addr.toString();
  return "";
}

async function main(): Promise<void> {
  const target = process.argv[2] ?? adminAddress();
  if (!target) { console.error("No address given and no admin in .env."); process.exit(1); }
  const isAdmin = target === adminAddress();

  const info: any = await algod.accountInformation(target).do();
  const algo = Number(info.amount) / 1e6;
  const minBalance = Number(info["min-balance"] ?? info.minBalance ?? 0) / 1e6;
  const held = (info.assets ?? []).filter((a: any) => Number(a.amount) > 0);
  const optedInZero = (info.assets ?? []).filter((a: any) => Number(a.amount) === 0);
  const created = info["created-assets"] ?? info.createdAssets ?? [];

  console.log(`\nAccount: ${target}${isAdmin ? "  (ADMIN)" : ""}`);
  console.log(`  ALGO balance : ${algo}`);
  console.log(`  min-balance  : ${minBalance}  (free headroom: ${(algo - minBalance).toFixed(3)} ALGO)`);
  console.log(`  ASAs created : ${created.length}${created.length ? "  → " + created.map((c: any) => `${c.index}(${c.params?.["unit-name"] ?? c.params?.unitName ?? "?"})`).join(", ") : ""}`);
  console.log(`  ASAs held    : ${held.length}${held.length ? "  → " + held.map((a: any) => `${a["asset-id"] ?? a.assetId}×${a.amount}`).join(", ") : ""}`);
  console.log(`  opted-in (0) : ${optedInZero.length}${optedInZero.length ? "  → " + optedInZero.map((a: any) => a["asset-id"] ?? a.assetId).join(", ") : ""}`);
  // Each ASA opt-in raises the account min-balance by 0.1 ALGO.
  console.log(`  (note: holding/opting-into ${held.length + optedInZero.length} ASAs reserves ${((held.length + optedInZero.length) * 0.1).toFixed(1)} ALGO of min-balance)\n`);
  process.exit(0);
}

main().catch((e) => { console.error("chain-status error:", e); process.exit(1); });
