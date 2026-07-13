/**
 * server/routes/ascendMetadata.ts
 *
 * ASCEND fungible token metadata handler.
 *
 * Referenced as the on-chain `url` field of ASCEND ASA 764083761. Wallets
 * and indexers (Pera, Defly, Lute, allo.info, explorer.perawallet) resolve
 * this URL when displaying the fungible token. It is NOT ARC-3 — ARC-3 is
 * a per-unit NFT metadata standard. A fungible token's asset-level
 * metadata is a plain JSON document with the on-chain identity fields
 * (name, unit-name, decimals, total) plus display fields (description,
 * image, external_url).
 *
 * The base URL is taken from PUBLIC_BASE_URL only — never the request
 * Host header — because this JSON becomes a permanent on-chain assetURL
 * and a spoofed Host would let an attacker poison the metadata URLs.
 *
 * Returns 503 with a clear error when PUBLIC_BASE_URL is not configured,
 * so the caller knows the document is unreliable rather than silently
 * serving localhost URLs.
 */

import type { Request, Response } from "express";

export const ASCEND_ASA_ID = 764083761;
export const ASCEND_TOTAL_SUPPLY_RAW = 1_000_000_000_000_000n; // 1B * 10^6
export const ASCEND_DECIMALS = 6;
export const ASCEND_UNIT_NAME = "ASCEND";
export const ASCEND_NAME = "Ascend";
export const ASCEND_DESCRIPTION =
  "ASCEND is the in-game utility token of FRONTIER, a persistent blockchain-backed strategy game on the Algorand TestNet. ASCEND is earned by owning and terraforming land, and is spent on commander minting, weapons, drones, satellites, and other in-game actions. Total supply: 1,000,000,000 ASCEND (6 decimals).";

export function buildAscendMetadata(baseUrl: string) {
  return {
    name: ASCEND_NAME,
    unit_name: ASCEND_UNIT_NAME,
    decimals: ASCEND_DECIMALS,
    total: Number(ASCEND_TOTAL_SUPPLY_RAW),
    description: ASCEND_DESCRIPTION,
    image: `${baseUrl}/nft/ascend.svg`,
    external_url: `${baseUrl}/`,
    properties: {
      asaId: ASCEND_ASA_ID,
      network: "algorand-testnet",
      game: "FRONTIER",
      tokenType: "fungible",
      standard: "ARC-fungible",
      metadataVersion: 1,
    },
  };
}

export function ascendMetadataHandler(_req: Request, res: Response): void {
  const rawBaseUrl = process.env.PUBLIC_BASE_URL || null;
  const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, "") : null;
  if (!baseUrl) {
    console.error(
      "[/nft/metadata/ascend] PUBLIC_BASE_URL is not set — ASCEND asset metadata URLs would be invalid. Set PUBLIC_BASE_URL env var.",
    );
    res.status(503).json({
      error:
        "PUBLIC_BASE_URL not configured — ASCEND asset metadata URLs would be invalid. Set PUBLIC_BASE_URL env var.",
    });
    return;
  }

  res.set("Cache-Control", "public, max-age=3600");
  res.json(buildAscendMetadata(baseUrl));
}
