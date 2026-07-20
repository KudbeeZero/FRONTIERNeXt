import type { Request, Response, NextFunction } from "express";
import { isDbHalted } from "./dbHalt";

export function haltDbMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isDbHalted()) {
    res.status(503).json({ error: "Database temporarily unavailable — service halted" });
    return;
  }
  next();
}

export function guardInterval(fn: () => void | Promise<void>): () => void {
  return () => {
    if (isDbHalted()) return;
    const result = fn();
    if (result && typeof result.catch === "function") {
      result.catch((err) => {
        console.warn("[halted] Background task skipped due to DB halt:", err instanceof Error ? err.message : err);
      });
    }
  };
}

export { isDbHalted };
