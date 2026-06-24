/**
 * server/devLogin.ts
 *
 * Gate + identity for the DEV / TEST quick-auth path (POST /api/dev/quick-auth),
 * which lets the owner enter the game as a persistent test player WITHOUT a
 * wallet/signature — for testing battles and recording promo video on TestNet.
 *
 * SECURITY: off by default. Enabled ONLY when the server env DEV_LOGIN_ENABLED
 * is exactly the string "true". Anything else (unset, "false", "1", "TRUE") →
 * disabled, so it can never be silently on in production / mainnet. Pure +
 * unit-tested so the "off unless explicitly true" property is pinned.
 */

/** True only when DEV_LOGIN_ENABLED === "true". Fail-closed for every other value. */
export function isDevLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEV_LOGIN_ENABLED === "true";
}

/**
 * The sentinel address the dev/test player is bound to. Deliberately NOT a valid
 * Algorand address by default, so the dev player cannot move real funds (claim /
 * mint require `algosdk.isValidAddress` and will refuse it). Override with
 * DEV_LOGIN_ADDRESS only if you knowingly want a real wallet.
 */
export function devLoginAddress(env: NodeJS.ProcessEnv = process.env): string {
  const a = (env.DEV_LOGIN_ADDRESS ?? "").trim();
  return a.length > 0 ? a : "DEV-TEST-COMMANDER";
}
