import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes, pruneActionNonces, ACTION_NONCE_PRUNE_INTERVAL_MS } from "./routes";
import { initSeasonManager } from "./engine/season/manager";
import { hydrateWorldEventsFromRedis } from "./worldEventStore";
import { warmUpDb, logPoolStats } from "./db";
import { assertChainConfig } from "./services/chain/client";
import {
  timeoutStalePurchaseIntents,
  PURCHASE_INTENT_REAP_INTERVAL_MS,
} from "./services/chain/chainEventStore";
import { sampleEconomicsSnapshotOnce } from "./services/economicsSnapshotSampler";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { apiReadLimiter, actionsLimiter } from "./security";
import { isRedisEnabled } from "./services/redis";

const app = express();
const httpServer = createServer(app);

// Behind Fly's reverse proxy: trust the first hop so rate limiting and any
// IP-based logic key on the real client IP (X-Forwarded-For) rather than the proxy.
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Memory Usage Tracking ────────────────────────────────────────────────────
/**
 * Log current memory usage with breakdown.
 * Call this periodically or on-demand to track memory pressure.
 */
export function logMemoryUsage(source = "periodic"): void {
  const memUsage = process.memoryUsage();
  const memInfo = {
    source,
    rss: `${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
    heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
    heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
    external: `${(memUsage.external / 1024 / 1024).toFixed(1)} MB`,
    arrayBuffers: `${(memUsage.arrayBuffers / 1024 / 1024).toFixed(1)} MB`,
  };
  console.log(`[memory] ${JSON.stringify(memInfo)}`);
}

// Log memory usage every 60 seconds
const _memoryInterval = setInterval(() => {
  logMemoryUsage("periodic");
}, 60_000);

// Log memory on process exit
process.on("exit", () => {
  clearInterval(_memoryInterval);
  logMemoryUsage("exit");
});

// Log memory on uncaught exceptions
process.on("uncaughtException", (err) => {
  logMemoryUsage("uncaughtException");
  console.error("[uncaughtException]", err);
});

app.use(
  express.json({
    // Cap request bodies — game payloads are < 5KB; this blocks oversized-body DoS.
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Security headers (helmet middleware)
// CSP is relaxed in development to allow Vite HMR and inline styles;
// in production a stricter policy is enforced.
const isDev = process.env.NODE_ENV !== "production";
app.use(
  helmet({
    contentSecurityPolicy: isDev
      ? false
      : {
          directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'"],
            styleSrc:       ["'self'", "'unsafe-inline'"],
            imgSrc:         ["'self'", "data:", "blob:"],
            connectSrc:     ["'self'", "wss:", "ws:", "https:"],
            fontSrc:        ["'self'", "data:"],
            workerSrc:      ["'self'", "blob:"],
            objectSrc:      ["'none'"],
            upgradeInsecureRequests: [],
          },
        },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — allow cross-origin requests from the Vercel (or other) frontend in production.
// CLIENT_ORIGIN can be a comma-separated list of allowed origins, e.g.:
//   CLIENT_ORIGIN=https://frontier.vercel.app,https://frontier-git-main.vercel.app
app.use((req, res, next) => {
  const rawOrigin = process.env.CLIENT_ORIGIN;
  if (!rawOrigin) { next(); return; }

  const allowedOrigins = rawOrigin.split(",").map((o) => o.trim()).filter(Boolean);
  const requestOrigin = req.headers.origin ?? "";

  // Allow if the request origin matches any configured origin
  const matched =
    allowedOrigins.includes(requestOrigin) ||
    // Also allow same-origin / non-browser requests (no Origin header)
    !requestOrigin;

  if (matched) {
    const effectiveOrigin = requestOrigin || allowedOrigins[0];
    res.header("Access-Control-Allow-Origin", effectiveOrigin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
    // x-admin-key: the /admin page sends it cross-origin from the branded host.
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
  }
  next();
});

// ── Rate limiting on game action routes ──────────────────────────────────────
// Per-IP fixed window over /api/actions/* (actionsLimiter, defined in
// security.ts alongside the other limiters).

// Coarse per-IP ceiling across the ENTIRE /api surface (read + write). This is
// the backstop against bulk scraping of off-chain game-economy data — e.g. a
// bot walking /api/game/parcel/:id or /api/game/player/:id to harvest which
// plots hold the most resources. Deliberately generous (default 1000/min) so a
// single legitimate player session is never affected; per-endpoint limiters in
// security.ts apply tighter caps to the enumerable lookups. Registered before
// the actions limiter so both counters apply to /api/actions.
app.use("/api", apiReadLimiter);
app.use("/api/actions", actionsLimiter);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Only echo the response body in non-production. In production this would
      // leak live game state (balances, player data, plot details) into stdout.
      if (capturedJsonResponse && process.env.NODE_ENV !== "production") {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // 1. Healthcheck route
  // Respond 200 to "/" and "/health" for production healthchecks
  app.get("/health", (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/", (req, res, next) => {
    // Return a plain text response for healthcheck requests to "/"
    // but only if it's not a browser request for the HTML app
    if (process.env.NODE_ENV === "production") {
      const isHtmlRequest = req.headers.accept?.includes("text/html");
      const userAgent = (req.headers["user-agent"] || "").toLowerCase();
      const isReplitHealthcheck = !userAgent || userAgent.includes("replit") || userAgent.includes("healthcheck") || userAgent.includes("uptimerobot");

      if (!isHtmlRequest || isReplitHealthcheck) {
        return res.status(200).send("Frontier server running");
      }
    }
    next();
  });

  assertChainConfig();

  // GUARDRAIL: Warn if ALGORAND_NETWORK is missing or invalid in dev; crash in production.
  // Normalize to lowercase so "Testnet" / "TestNet" / "TESTNET" all work.
  const _algodNetworkRaw = process.env.ALGORAND_NETWORK;
  const _algodNetwork = _algodNetworkRaw?.toLowerCase();
  if (_algodNetwork && _algodNetwork !== _algodNetworkRaw) {
    process.env.ALGORAND_NETWORK = _algodNetwork;
  }
  if (!_algodNetwork || !['testnet', 'mainnet', 'localnet'].includes(_algodNetwork)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `[FATAL] ALGORAND_NETWORK must be "testnet", "mainnet", or "localnet". ` +
        `Got: "${_algodNetworkRaw ?? 'undefined'}". Set ALGORAND_NETWORK in your environment.`
      );
    }
    console.warn(`[startup] ALGORAND_NETWORK not set or invalid ("${_algodNetworkRaw ?? 'undefined'}"). Defaulting to testnet for development.`);
    process.env.ALGORAND_NETWORK = 'testnet';
  } else {
    console.log(`[startup] ALGORAND_NETWORK=${_algodNetwork} ✓`);
  }

  const { initWsServer } = await import("./wsServer");
  initWsServer(httpServer, storage);
  // Wake up Neon DB before accepting traffic (handles cold-start timeouts)
  await warmUpDb();
  // Hydrate world event feed from Redis (no-op if Redis unavailable)
  await hydrateWorldEventsFromRedis();
  await registerRoutes(httpServer, app);
  // ID-004: periodically reap expired action_nonces (completed rows now carry
  // response_json + crash-orphaned in-flight rows). Best-effort and `unref`'d so it
  // never holds the process open or surfaces errors on the request path.
  const _actionNoncePruneInterval = setInterval(() => {
    pruneActionNonces()
      .then((n) => { if (n > 0) console.log(`[action_nonces] pruned ${n} expired row(s)`); })
      .catch(() => {});
  }, ACTION_NONCE_PRUNE_INTERVAL_MS);
  _actionNoncePruneInterval.unref();
  // Periodically time out abandoned purchase_intents (pending past the TTL) so the
  // admin funnel reflects reality. Off-chain telemetry only — never touches funds.
  // Best-effort and `unref`'d like the action_nonce reaper above: it never holds
  // the process open, never throws on the interval, and no-ops without a DB.
  const _purchaseIntentReapInterval = setInterval(() => {
    timeoutStalePurchaseIntents()
      .then((n) => { if (n > 0) console.log(`[purchase_intents] timed out ${n} stale intent(s)`); })
      .catch(() => {});
  }, PURCHASE_INTENT_REAP_INTERVAL_MS);
  _purchaseIntentReapInterval.unref();
  // Unit D3: hourly economics-history sample for the real supply-flow chart
  // (docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md). Ticks every 5 minutes
  // but only actually samples once the hourly interval has elapsed
  // (sampleEconomicsSnapshotOnce's own internal gate) — never throws, never
  // holds the process open, no-ops without chain config or a DB table.
  const _economicsSnapshotInterval = setInterval(() => {
    sampleEconomicsSnapshotOnce().catch(() => {});
  }, 5 * 60 * 1000);
  _economicsSnapshotInterval.unref();
  // Take the first sample shortly after boot rather than waiting up to 5 minutes.
  setTimeout(() => { sampleEconomicsSnapshotOnce().catch(() => {}); }, 30_000).unref();
  // Start season lifecycle manager (auto-expiry + countdown broadcasts)
  initSeasonManager(storage);
  console.log("[startup] Season manager initialised ✓");
  // Start persistent FRONTIER transfer retry worker (SEV2 #6 + #7 fix)
  const { startAscendTransferWorker } = await import("./services/chain/transferQueue");
  startAscendTransferWorker();
  console.log("[startup] FRONTIER transfer retry worker started ✓");
  // Start persistent Plot NFT mint retry worker (M1-5)
  const { startPlotMintRetryWorker } = await import("./services/chain/mintRetryQueue");
  startPlotMintRetryWorker();
  console.log("[startup] Plot NFT mint retry worker started ✓");

  // Surface whether security state (auth nonces + enumeration/auth rate limits)
  // is shared across instances (Redis) or per-instance (memory). The latter is
  // only correct for a single instance.
  console.log(
    isRedisEnabled()
      ? "[startup] Distributed mode ✓ — auth nonces + security rate limits backed by Redis (multi-instance safe)"
      : "[startup] Per-instance mode — no Redis (UPSTASH_REDIS_REST_URL/TOKEN unset); auth nonces + rate limits are local. Safe for a single instance only.",
  );

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Log initial system stats
  logMemoryUsage("startup");
  logPoolStats();

  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})().catch((err) => {
  console.error("[startup] Fatal error during server startup:", err);
  process.exit(1);
});
