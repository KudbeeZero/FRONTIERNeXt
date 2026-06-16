// ---------------------------------------------------------------------------
// Where "continue" leads after the prologue.
//
// The prologue ships as the static bundle at `/story/` on the same Cloudflare
// Pages site as the main FRONTIER-AL SPA, which serves the game at `/game`
// (the landing's "Play the Story" links to `/story/`; "Enter Game" goes to
// `/game`). So the handoff is a same-origin path — `/game` by default, which
// works on every deploy (preview, prod, local) without hardcoding a host.
// Override with `VITE_FRONTIER_AL_URL` (path or absolute URL) if the game
// ever moves to a different route or origin.
// ---------------------------------------------------------------------------

export const FRONTIER_AL_URL =
  (import.meta.env.VITE_FRONTIER_AL_URL as string | undefined) ?? "/game";

/** Navigate to the main game (full page nav — it's a separate app/deploy). */
export function goToFrontierAl(): void {
  window.location.href = FRONTIER_AL_URL;
}

/** Lora (Algorand) testnet explorer link for a confirmed transaction. */
export function explorerTxUrl(txId: string): string {
  return `https://lora.algokit.io/testnet/transaction/${txId}`;
}
