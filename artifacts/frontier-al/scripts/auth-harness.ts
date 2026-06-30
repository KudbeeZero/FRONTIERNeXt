// ── auth-harness — prove the TestNet wallet → session-token handshake end-to-end ─
//
// Drives the REAL Sign-In-With-Algorand signature handshake headlessly against a
// running FRONTIER-AL server (local :5000 or a given base URL), using a FUNDED
// TestNet account loaded from a secret (mnemonic via env). No browser, no wallet
// extension. It SIGNS the auth transaction with the test key but NEVER submits a
// transaction to the chain and NEVER moves ALGO/ASA — the server verifies the
// ed25519 signature offline (see server/auth.ts: verifyAuthTxn).
//
// Steps (each prints PASS/FAIL with the actual HTTP status):
//   1. POST /api/auth/nonce  { address }            → capture nonce + message
//   2. reconstruct the exact client payload: a 0-ALGO self-payment whose note is
//      the server-issued `message` (== "FRONTIER-AUTH:v1:<nonce>"), sign it
//   3. POST /api/auth/verify { address, signedTxn, nonce } → assert 200 + token
//      and that the frontier_session cookie is set
//   4. GET  /api/auth/me  (with cookie)             → assert authenticated address
//   5. negative: replay the just-consumed nonce + submit an un-issued nonce →
//      assert BOTH are REJECTED (401), proving the single-use guard works
//
// Verdict line: "AUTH VERIFIED" | "AUTH BROKEN(step N)" | "BLOCKED: <reason>".
//
// Run:  FRONTIER_TEST_MNEMONIC="<25 words>" tsx scripts/auth-harness.ts [baseUrl]
//       (baseUrl also via BASE_URL env; defaults to http://localhost:5000)
//
// RULES (enforced below):
//   • TestNet ONLY. Never targets mainnet, never uses a mainnet account.
//   • The mnemonic comes from env and is NEVER printed, logged, or committed.
//   • Signs but NEVER submits; no algod write, no funds movement.
//   • Never reports "verified" without a real 200 + token assertion. Missing
//     server or missing secret → BLOCKED with the reason (never a silent pass).
//   • Read-only on game state.

import algosdk from "algosdk";
import { randomBytes } from "node:crypto";

// TestNet genesis — pinned so the signed txn is unambiguously a TestNet artifact.
// The harness builds suggestedParams locally and never contacts algod; the server
// verifies the signature offline, so no network round-trip to the chain is needed.
const TESTNET_GENESIS_ID = "testnet-v1.0";
// algosdk v3 requires genesisHash as raw bytes (Uint8Array), not the base64 string.
const TESTNET_GENESIS_HASH = new Uint8Array(
  Buffer.from("SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=", "base64"),
);

const BASE_URL = (process.argv[2] || process.env.BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const COOKIE_NAME = "frontier_session";

type StepResult = { ok: boolean; line: string };

function pass(step: string, detail: string): StepResult {
  return { ok: true, line: `PASS  ${step} — ${detail}` };
}
function fail(step: string, detail: string): StepResult {
  return { ok: false, line: `FAIL  ${step} — ${detail}` };
}

/** Pull the session cookie value out of a Set-Cookie header list. */
function extractSessionCookie(res: Response): string | null {
  // Node 18+/22 exposes getSetCookie(); fall back to the combined header.
  const raw: string[] =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];
  for (const c of raw) {
    const m = c.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
}

function blocked(reason: string): never {
  console.log("");
  console.log(`Verdict: BLOCKED: ${reason}`);
  console.log("(BLOCKED is not a pass — fix the prerequisite and re-run.)");
  process.exit(2);
}

async function main(): Promise<void> {
  console.log(`auth-harness → ${BASE_URL}  (TestNet, sign-only, never submits)`);

  // ── Prerequisite: the secret. Never printed. ────────────────────────────────
  const mn = process.env.FRONTIER_TEST_MNEMONIC;
  if (!mn || mn.trim().split(/\s+/).length !== 25) {
    blocked(
      "FRONTIER_TEST_MNEMONIC is unset or not a 25-word mnemonic. " +
        "Provide a FUNDED TestNet account via that env var (the value is never logged).",
    );
  }

  let address: string;
  let sk: Uint8Array;
  try {
    const acct = algosdk.mnemonicToSecretKey(mn!.trim());
    address = typeof acct.addr === "string" ? acct.addr : acct.addr.toString();
    sk = acct.sk;
  } catch {
    blocked("FRONTIER_TEST_MNEMONIC did not decode to a valid Algorand account.");
  }
  console.log(`Test account: ${address!}`);

  // ── Prerequisite: the server must answer. ───────────────────────────────────
  try {
    const ping = await fetch(`${BASE_URL}/api/auth/me`, { method: "GET" });
    // 401 (unauthenticated) is the healthy "server is up" answer here.
    if (ping.status !== 401 && ping.status !== 200) {
      blocked(`server at ${BASE_URL} answered /api/auth/me with ${ping.status} (expected 401/200).`);
    }
  } catch (e) {
    blocked(`no server reachable at ${BASE_URL} (${(e as Error).message}). Start it with: pnpm --filter @workspace/frontier-al dev:server`);
  }

  const results: StepResult[] = [];
  let brokenAt = 0;

  // ── Step 1: nonce ───────────────────────────────────────────────────────────
  let nonce = "";
  let message = "";
  {
    const res = await fetch(`${BASE_URL}/api/auth/nonce`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const body = (await res.json().catch(() => ({}))) as { nonce?: string; message?: string };
    if (res.status === 200 && body.nonce && body.message) {
      nonce = body.nonce;
      message = body.message;
      const expected = `FRONTIER-AUTH:v1:${nonce}`;
      if (message !== expected) {
        results.push(fail("step 1 nonce", `message "${message}" != expected "${expected}"`));
        brokenAt ||= 1;
      } else {
        results.push(pass("step 1 nonce", `200, nonce issued, message format ok`));
      }
    } else {
      results.push(fail("step 1 nonce", `status ${res.status} ${JSON.stringify(body)}`));
      brokenAt ||= 1;
    }
  }

  // ── Step 2: build + sign the exact auth txn the client signs ─────────────────
  let signedTxnB64 = "";
  if (!brokenAt) {
    try {
      const suggestedParams: algosdk.SuggestedParams = {
        fee: 1000,
        flatFee: true,
        firstValid: 1,
        lastValid: 1000,
        genesisID: TESTNET_GENESIS_ID,
        genesisHash: TESTNET_GENESIS_HASH,
        minFee: 1000,
      };
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: address!,
        receiver: address!,
        amount: 0,
        note: new TextEncoder().encode(message),
        suggestedParams,
      });
      const signed = txn.signTxn(sk!); // signs locally; the blob is NEVER submitted
      signedTxnB64 = Buffer.from(signed).toString("base64");
      results.push(pass("step 2 sign", `0-ALGO self-pay signed offline (${signedTxnB64.length} b64 chars), not submitted`));
    } catch (e) {
      results.push(fail("step 2 sign", (e as Error).message));
      brokenAt ||= 2;
    }
  }

  // ── Step 3: verify → token + cookie ─────────────────────────────────────────
  let token = "";
  let cookie: string | null = null;
  if (!brokenAt) {
    const res = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, signedTxn: signedTxnB64, nonce }),
    });
    const body = (await res.json().catch(() => ({}))) as { token?: string; success?: boolean };
    cookie = extractSessionCookie(res);
    if (res.status === 200 && body.token && cookie) {
      token = body.token;
      results.push(pass("step 3 verify", `200, session token issued, ${COOKIE_NAME} cookie set`));
    } else {
      results.push(
        fail(
          "step 3 verify",
          `status ${res.status}, token=${body.token ? "yes" : "no"}, cookie=${cookie ? "set" : "missing"}`,
        ),
      );
      brokenAt ||= 3;
    }
  }

  // ── Step 4: /me with the cookie → authenticated address ──────────────────────
  if (!brokenAt) {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      method: "GET",
      headers: { cookie: `${COOKIE_NAME}=${cookie}` },
    });
    const body = (await res.json().catch(() => ({}))) as { authenticated?: boolean; address?: string };
    if (res.status === 200 && body.authenticated === true && body.address === address!) {
      results.push(pass("step 4 me", `200, authenticated as the signing address`));
    } else {
      results.push(fail("step 4 me", `status ${res.status}, address=${body.address ?? "none"}`));
      brokenAt ||= 4;
    }
  }

  // ── Step 5: negative — replayed + un-issued nonce must be REJECTED ────────────
  if (!brokenAt) {
    // (a) Replay the just-consumed nonce with the same signed blob → must 401.
    const replay = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, signedTxn: signedTxnB64, nonce }),
    });
    // (b) A nonce that was never issued → must 401.
    const bogusNonce = randomBytes(24).toString("hex");
    const forged = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, signedTxn: signedTxnB64, nonce: bogusNonce }),
    });
    if (replay.status === 401 && forged.status === 401) {
      results.push(pass("step 5 guard", `replayed nonce → 401, un-issued nonce → 401 (single-use guard holds)`));
    } else {
      results.push(
        fail("step 5 guard", `replayed nonce → ${replay.status}, un-issued nonce → ${forged.status} (expected 401/401)`),
      );
      brokenAt ||= 5;
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log("");
  for (const r of results) console.log(r.line);
  console.log("");
  if (brokenAt === 0 && results.length === 5 && results.every((r) => r.ok)) {
    console.log("Verdict: AUTH VERIFIED");
    process.exit(0);
  } else {
    console.log(`Verdict: AUTH BROKEN(step ${brokenAt || "?"})`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`auth-harness crashed: ${(e as Error).message}`);
  process.exit(1);
});
