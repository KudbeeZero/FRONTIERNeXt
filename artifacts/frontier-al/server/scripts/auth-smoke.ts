// Auth smoke test — exercises the wallet-signature login server-side and asserts
// the nonce-lifecycle guarantees we rely on. Signs with the funded admin key
// (no wallet UI needed) and hits the RUNNING API server.
//
// Usage (server must be up on :5000):
//   tsx server/scripts/auth-smoke.ts
//   BASE_URL=http://localhost:5000 tsx server/scripts/auth-smoke.ts
//
// Requires ALGORAND_ADMIN_MNEMONIC + ALGOD_URL in .env. Exit 0 = all pass.

import "dotenv/config";
import algosdk from "algosdk";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";
const account = algosdk.mnemonicToSecretKey(process.env.ALGORAND_ADMIN_MNEMONIC!);
const address = account.addr.toString();
const algod = new algosdk.Algodv2("", process.env.ALGOD_URL ?? "https://testnet-api.algonode.cloud", "");

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

async function getNonce(): Promise<{ nonce: string; message: string }> {
  const r = await fetch(`${BASE}/api/auth/nonce`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }),
  });
  return r.json() as Promise<{ nonce: string; message: string }>;
}

async function verify(message: string, nonce: string): Promise<number> {
  const sp = await algod.getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: address, receiver: address, amount: 0,
    note: new TextEncoder().encode(message), suggestedParams: sp,
  });
  const signedTxn = Buffer.from(txn.signTxn(account.sk)).toString("base64");
  const r = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, signedTxn, nonce }),
  });
  return r.status;
}

async function main(): Promise<void> {
  console.log(`auth-smoke → ${BASE} (signer ${address.slice(0, 10)}…)\n`);

  // 1. Happy path: a correctly-signed challenge verifies.
  const a = await getNonce();
  check("happy path: valid signature verifies", (await verify(a.message, a.nonce)) === 200, "expect 200");

  // 2. No-clobber: issuing a SECOND nonce must not invalidate the FIRST.
  const b = await getNonce();
  await getNonce(); // a third, just to be sure the store isn't single-slot
  check("no-clobber: first nonce still valid after more issued", (await verify(b.message, b.nonce)) === 200, "expect 200");

  // 3. Single-use: replaying a consumed nonce must fail.
  const c = await getNonce();
  const first = await verify(c.message, c.nonce);
  const replay = await verify(c.message, c.nonce);
  check("single-use: consumed nonce is rejected on replay", first === 200 && replay === 401, `first=${first} replay=${replay} (want 200 then 401)`);

  // 4. Wrong/garbage nonce is rejected.
  const d = await getNonce();
  check("rejects a mismatched nonce", (await verify(d.message, "deadbeef".repeat(6))) === 401, "expect 401");

  console.log(`\n${fail === 0 ? "ALL PASS" : `${fail} FAILED`} (${pass} ok)`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("auth-smoke error:", e); process.exit(1); });
