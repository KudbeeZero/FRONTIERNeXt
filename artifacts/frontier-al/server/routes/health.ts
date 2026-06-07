// Liveness + readiness probes (SECURITY LUT §6.3). Public, unguarded GETs.
//   GET /api/health — liveness: 200 whenever the process is serving.
//   GET /api/ready  — readiness: 200 only when required deps are reachable,
//                     503 otherwise, so the platform (Railway) can gate traffic.

import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db, withDbRetry } from "../db";
import { getAlgodClient } from "../services/chain/client";
import { isRedisEnabled, redisPing } from "../services/redis";

export function registerHealthRoutes(app: Express): void {
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/ready", async (_req, res) => {
    // DB and Algorand are required dependencies. Redis is an optional enhancement
    // layer (the game runs without it), so it only fails readiness when it is
    // configured but unreachable.
    const [dbRes, algodRes] = await Promise.allSettled([
      withDbRetry(() => db.execute(sql`SELECT 1`), "ready-db-ping", 1),
      getAlgodClient().status().do(),
    ]);

    const dbOk = dbRes.status === "fulfilled";
    const algodOk = algodRes.status === "fulfilled";

    const redisOn = isRedisEnabled();
    let redisOk = true;
    let redisState: "ok" | "down" | "disabled" = "disabled";
    if (redisOn) {
      redisOk = await redisPing();
      redisState = redisOk ? "ok" : "down";
    }

    const ok = dbOk && algodOk && redisOk;
    res.status(ok ? 200 : 503).json({
      ok,
      db: dbOk ? "ok" : "down",
      redis: redisState,
      algod: algodOk ? "ok" : "down",
      timestamp: new Date().toISOString(),
    });
  });
}
