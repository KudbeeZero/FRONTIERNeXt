// ── Wallet-signature login (Sign-In With Algorand) ───────────────────────────
//
// Proves control of the connected wallet to the server, then stores the
// returned session token. Works with any use-wallet provider (LUTE, Pera,
// Defly, Kibisis) because it signs the same 0-ALGO self-payment transaction the
// game already uses for every action — no provider-specific arbitrary-byte
// signing required. The auth transaction is never submitted to the chain.

import algosdk from "algosdk";
import { apiRequest } from "./queryClient";
import { getTransactionParams, signTransactionWithActiveWallet } from "./algorand";
import { setAuthToken, clearAuthToken } from "./authToken";

export interface AuthResult {
  token: string;
  player: unknown;
  welcomeBonus: boolean;
}

/** Encode bytes to base64 without blowing the call stack on large inputs. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Authenticate the active wallet: fetch a nonce, sign the auth challenge, and
 * exchange the signature for a session token. Triggers exactly one wallet
 * signature prompt. Returns the verified session/player.
 */
export async function authenticateWallet(address: string): Promise<AuthResult> {
  // 1. Request a one-time challenge for this address.
  const nonceRes = await apiRequest("POST", "/api/auth/nonce", { address });
  const { nonce, message } = (await nonceRes.json()) as { nonce: string; message: string };
  if (!nonce || !message) throw new Error("Failed to obtain auth challenge");

  // 2. Sign a 0-ALGO self-payment whose note is the challenge.
  const suggestedParams = await getTransactionParams();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    note: new TextEncoder().encode(message),
    suggestedParams,
  });

  const signedBlobs = await signTransactionWithActiveWallet(txn, address);
  const signed = signedBlobs?.[0];
  if (!signed || signed.length === 0) {
    throw new Error("Wallet did not return a signature");
  }
  const signedTxn = toBase64(signed);

  // 3. Exchange the signature for a session token.
  const verifyRes = await apiRequest("POST", "/api/auth/verify", { address, signedTxn, nonce });
  const data = (await verifyRes.json()) as AuthResult & { success?: boolean };
  if (!data?.token) throw new Error("Authentication failed");
  setAuthToken(data.token);
  return data;
}

/** Clear the session locally and on the server. */
export async function logoutWallet(): Promise<void> {
  try {
    await apiRequest("POST", "/api/auth/logout", {});
  } catch {
    /* best-effort */
  }
  clearAuthToken();
}
