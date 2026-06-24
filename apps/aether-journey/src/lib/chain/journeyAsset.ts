// ---------------------------------------------------------------------------
// ARC-69 NFT parameters for minting a Journey Card on Algorand TestNet.
//
// Pure (no algosdk / wallet imports) so it unit-tests cleanly; the actual mint
// lives in claim.ts. ARC-69 keeps the metadata in the asset-config transaction
// note (no external hosting needed): a `{ standard: "arc69", ... }` JSON blob.
// The note is capped under Algorand's 1024-byte limit; name/unit under their
// 32/8-byte caps.
// ---------------------------------------------------------------------------
import type { JourneyCard } from "../journeyCard";

export interface JourneyAssetParams {
  assetName: string;
  unitName: string;
  url: string;
  /** ARC-69 metadata JSON (≤ 1024 bytes), for the asset-config note. */
  note: string;
}

const PLAY_URL = "https://frontier-al.app";
const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s).length;

/** Truncate a string to at most `max` UTF-8 bytes (not chars). */
function clampBytes(s: string, max: number): string {
  if (bytes(s) <= max) return s;
  let out = s;
  while (bytes(out) > max) out = out.slice(0, -1);
  return out;
}

/**
 * Build the ARC-69 NFT params for a finished run. Deterministic. The note is a
 * valid ARC-69 metadata object whose `properties` carry the run identity; it is
 * trimmed (description, then choices) to stay under the 1024-byte note cap.
 */
export function journeyAssetParams(card: JourneyCard): JourneyAssetParams {
  const assetName = clampBytes(`Aether: ${card.title}`, 32);
  const url = clampBytes(`${PLAY_URL}/#${card.seed}`, 96);

  const build = (description: string, choices: string[]) =>
    JSON.stringify({
      standard: "arc69",
      description,
      external_url: PLAY_URL,
      properties: {
        app: "Aether's Journey",
        ending: card.title,
        trust: card.trust,
        rank: card.rating,
        seed: card.seed,
        choices,
      },
    });

  // Full note, then progressively trim to fit Algorand's 1024-byte note cap.
  let note = build(card.verdict, card.highlights);
  if (bytes(note) > 1024) note = build(clampBytes(card.verdict, 160), card.highlights.slice(0, 2));
  if (bytes(note) > 1024) note = build("", []);

  return { assetName, unitName: "AETHER", url, note };
}

/** TestNet asset page on the Pera explorer. */
export function explorerAssetUrl(assetId: number): string {
  return `https://testnet.explorer.perawallet.app/asset/${assetId}/`;
}
