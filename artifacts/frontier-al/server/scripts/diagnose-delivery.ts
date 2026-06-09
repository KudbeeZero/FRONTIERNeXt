// Delivery diagnostic — given a confirmed payment txid, report whether the NFT
// was actually delivered, or pinpoint the paid-but-no-NFT seam. Works for plot
// purchases (note maps to plotId on-chain) and surfaces commander payments too.
//
// Usage (API server up on :5000 for the NFT-status oracle):
//   tsx server/scripts/diagnose-delivery.ts <PAYMENT_TXID>
//   BASE_URL=http://localhost:5000 tsx server/scripts/diagnose-delivery.ts <txid>
//
// Requires ALGOD_URL + INDEXER_URL in .env. Read-only — changes nothing on-chain.

import "dotenv/config";
import algosdk from "algosdk";

const algod = new algosdk.Algodv2("", process.env.ALGOD_URL ?? "https://testnet-api.algonode.cloud", "");
const indexer = new algosdk.Indexer("", process.env.INDEXER_URL ?? "https://testnet-idx.algonode.cloud", "");
const API = process.env.BASE_URL ?? "http://localhost:5000";

const k = (o: any, ...keys: string[]) => { for (const key of keys) if (o?.[key] != null) return o[key]; return undefined; };

async function holding(addr: string, assetId: number): Promise<{ optedIn: boolean; amount: number }> {
  const info: any = await algod.accountInformation(addr).do();
  const a = (info.assets ?? []).find((x: any) => Number(k(x, "asset-id", "assetId")) === Number(assetId));
  return a ? { optedIn: true, amount: Number(a.amount) } : { optedIn: false, amount: 0 };
}

async function main(): Promise<void> {
  const txid = process.argv[2];
  if (!txid) { console.error("Usage: tsx server/scripts/diagnose-delivery.ts <PAYMENT_TXID>"); process.exit(1); }

  let txn: any;
  try { txn = k(await indexer.lookupTransactionByID(txid).do(), "transaction"); }
  catch (e) { console.error("Payment not found on indexer:", (e as Error).message); process.exit(1); }

  const ptxn = k(txn, "payment-transaction", "paymentTransaction") ?? {};
  const buyer: string = txn.sender;
  const receiver: string = k(ptxn, "receiver");
  const amount = Number(k(ptxn, "amount") ?? 0) / 1e6;
  const confirmed = Number(k(txn, "confirmed-round", "confirmedRound") ?? 0) > 0;
  let note: any = null;
  try { note = JSON.parse(Buffer.from(txn.note ?? "", "base64").toString("utf8").replace(/^FRNTR:/, "")); } catch { /* non-JSON note */ }

  console.log(`\nPayment ${txid.slice(0, 14)}…`);
  console.log(`  confirmed : ${confirmed}   amount: ${amount} ALGO`);
  console.log(`  buyer     : ${buyer}`);
  console.log(`  receiver  : ${receiver}`);
  console.log(`  note      : ${note ? JSON.stringify(note) : "(unparseable / not a FRNTR action)"}`);

  if (note?.action === "purchase" && note.plotId != null) {
    const r = await fetch(`${API}/api/nft/plot/${note.plotId}`).catch(() => null);
    const status: any = r && r.ok ? await r.json() : null;
    const statusLabel = status ? JSON.stringify(status)
      : r ? `(no NFT record — server returned HTTP ${r.status})`
      : `(could not reach ${API})`;
    console.log(`  plot ${note.plotId} status (server): ${statusLabel}`);
    const assetId = k(status, "assetId", "asset_id");
    if (!assetId) {
      console.log(`  VERDICT   : ⚠️  PAID, NO NFT MINTED (no assetId — mint failed or pending). Plot has no retry route; needs reconcile.`);
    } else {
      const h = await holding(buyer, Number(assetId));
      console.log(`  on-chain  : buyer opted into asset ${assetId}? ${h.optedIn} | holds: ${h.amount}`);
      console.log(`  VERDICT   : ${
        h.amount >= 1 ? "✅ DELIVERED" :
        !h.optedIn   ? "⚠️  PAID, NOT DELIVERED — buyer not opted in (pay-then-opt-in seam). Needs player opt-in, then admin transfer." :
                       "⚠️  PAID, opted-in but holds 0 — the delivery transfer never fired. Re-call /api/nft/deliver/:plotId."
      }`);
    }
  } else if (note?.action === "mint_commander") {
    console.log(`  commander : tier ${note.tier}. On-chain payment carries tier+player but NOT a commanderId, so map via commander_nfts.algoPaymentTxId / the in-app /api/nft/commander/:id status. Same delivery seam as plots.`);
  } else {
    console.log(`  (note has no purchase/mint action — nothing to map)`);
  }
  console.log("");
  process.exit(0);
}

main().catch((e) => { console.error("diagnose-delivery error:", e); process.exit(1); });
