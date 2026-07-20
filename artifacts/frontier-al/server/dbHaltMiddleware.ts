import type { Request, Response, NextFunction } from "express";
import { isDbHalted } from "./dbHalt";

export function haltDbMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isDbHalted()) {
    res.status(503).json({ error: "Database temporarily unavailable — service halted" });
    return;
  }
  next();
}

export function guardInterval(fn: () => Promise<void> | void): () => void {
  return async () => {
    if (isDbHalted()) return;
    try {
      await fn();
    } catch (err) {
      console.warn("[halted] Background task skipped due to DB halt:", err instanceof Error ? err.message : err);
    }
  };
}
