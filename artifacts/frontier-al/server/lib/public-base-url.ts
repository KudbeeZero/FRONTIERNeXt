/**
 * server/lib/public-base-url.ts
 *
 * Resolve and validate the public base URL used to build on-chain ASA metadata.
 *
 * Why this exists: an ASA's `assetURL` is IMMUTABLE once minted. If a plot or
 * commander NFT is minted while PUBLIC_BASE_URL points at `http://localhost:5000`
 * (the local-dev default), that localhost URL is baked into the asset forever —
 * no phone wallet or marketplace can ever resolve its metadata or image.
 *
 * Policy:
 *   - mainnet            → a mint MUST use a public https:// host; otherwise throw.
 *   - testnet / localnet → warn but allow (these assets are throwaway).
 *
 * Read-only consumers (the /nft/metadata endpoints) should keep using
 * getPublicBaseUrl() and return 503 on null. Only the immutable bake-point
 * (mintLandNft / mintCommanderNft) needs assertMintBaseUrlSafe().
 */

import type { ChainNetwork } from "../services/chain/types";

/** Hostnames that are never publicly reachable — fatal for an immutable assetURL. */
const NON_PUBLIC_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

/**
 * Resolve PUBLIC_BASE_URL from the environment, trailing slash stripped.
 *
 * Self-contained: mirrors the REPLIT_DOMAINS https fallback that
 * assertChainConfig() applies at boot, so it is correct regardless of boot order
 * and never the spoofable request Host header. Returns null when no base URL can
 * be determined.
 */
export function getPublicBaseUrl(): string | null {
  const raw =
    process.env.PUBLIC_BASE_URL ||
    (process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`
      : "");
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * True iff `url` is a public https:// URL safe to bake immutably on-chain.
 *
 * The trap being closed is `http://localhost`, so we require https and reject
 * obviously-non-public hosts (loopback, .local, and RFC1918 / link-local ranges).
 */
export function isPublicHttpsBaseUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (NON_PUBLIC_HOSTS.has(host)) return false;
  if (host.endsWith(".local")) return false;

  // Private / link-local IPv4 ranges — not reachable by external wallets.
  if (/^10\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (/^169\.254\./.test(host)) return false;

  return true;
}

/** Thrown when a mint would bake an unreachable assetURL on-chain. */
export class MintBaseUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MintBaseUrlError";
  }
}

/**
 * Guard the immutable bake-point. Call with the base URL about to be written into
 * an ASA's assetURL and the active network.
 *   - mainnet:            throws MintBaseUrlError unless the URL is public https.
 *   - testnet / localnet: logs a warning but allows (throwaway assets).
 */
export function assertMintBaseUrlSafe(baseUrl: string, network: ChainNetwork): void {
  if (isPublicHttpsBaseUrl(baseUrl)) return;

  if (network === "mainnet") {
    throw new MintBaseUrlError(
      `Refusing to mint on mainnet: PUBLIC_BASE_URL="${baseUrl}" is not a public https URL. ` +
        `assetURL is immutable once minted — set PUBLIC_BASE_URL to a permanent public https host ` +
        `(IPFS preferred) before minting.`,
    );
  }

  console.warn(
    `[public-base-url] WARNING: minting on ${network} with non-public base URL "${baseUrl}". ` +
      `This URL is baked IMMUTABLY into the asset and will be unreachable by external wallets. ` +
      `Acceptable for throwaway ${network} assets only.`,
  );
}

/**
 * Resolve + guard in one call for the mint path: returns the validated base URL
 * or throws (unset env, or mainnet with a non-public URL).
 */
export function requireMintBaseUrl(network: ChainNetwork): string {
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    throw new MintBaseUrlError(
      "PUBLIC_BASE_URL is not configured — cannot mint an NFT without a metadata base URL.",
    );
  }
  assertMintBaseUrlSafe(baseUrl, network);
  return baseUrl;
}
