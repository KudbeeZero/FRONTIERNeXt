// ---------------------------------------------------------------------------
// Where "continue" leads after the prologue.
//
// Once the run is committed on-chain, the player hands off to the main
// FRONTIER-AL game. That app is deployed separately, so its URL is supplied at
// build time via `VITE_FRONTIER_AL_URL`. If unset we fall back to the known
// production host — set the env var to point a given deploy at the right game.
// ---------------------------------------------------------------------------

export const FRONTIER_AL_URL =
  (import.meta.env.VITE_FRONTIER_AL_URL as string | undefined) ??
  "https://frontieralgo.pages.dev";

/** Navigate to the main game (full page nav — it's a separate app/deploy). */
export function goToFrontierAl(): void {
  window.location.href = FRONTIER_AL_URL;
}

/** Lora (Algorand) testnet explorer link for a confirmed transaction. */
export function explorerTxUrl(txId: string): string {
  return `https://lora.algokit.io/testnet/transaction/${txId}`;
}
