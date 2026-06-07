import type algosdk from "algosdk";
import type { Request, Response, RequestHandler } from "express";

/**
 * Shared dependencies handed to every domain router. These were closures /
 * module-level helpers inside the original registerRoutes(); threading them
 * through this context keeps the split purely mechanical (no logic change).
 */
export interface RouteContext {
  assertPlayerOwnership: (req: Request, res: Response, bodyPlayerId?: string) => Promise<string | null>;
  maybeGrantWelcomeBonus: (playerId: string, address: string) => Promise<{ granted: boolean; reason?: string }>;
  getBlockchainReady: () => boolean;
  fireBurn: (walletAddress: string, amount: number, note: string) => void;
  adviceLimiter: RequestHandler;
  algodClient: algosdk.Algodv2;
  indexerClient: algosdk.Indexer;
}
