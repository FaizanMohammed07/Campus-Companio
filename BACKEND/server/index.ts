import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import https from "https";
import fs from "fs";
import session from "express-session";
import MemoryStore from "memorystore";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import { toApiErrorPayload } from "./utils/http";
import { logInfo, logError, logWarn } from "./utils/logger";

const app = express();
const isProd = process.env.NODE_ENV === "production";
const isHttpsEnabled =
  process.env.HTTPS === "true" || process.env.HTTPS === "1";

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: isProd ? undefined : false,
    crossOriginEmbedderPolicy: isProd ? undefined : false,
  }),
);

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: isProd ? 120 : 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
// Decide HTTP or HTTPS based on env
let httpServer: ReturnType<typeof createServer> | https.Server;
if (isHttpsEnabled) {
  const pfxPath = process.env.SSL_PFX_FILE;
  const pfxPass = process.env.SSL_PASSPHRASE;
  const keyPath = process.env.SSL_KEY_FILE;
  const certPath = process.env.SSL_CRT_FILE;

  try {
    if (pfxPath) {
      const pfx = fs.readFileSync(pfxPath);
      httpServer = https.createServer(
        pfxPass ? { pfx, passphrase: pfxPass } : { pfx },
        app,
      );
    } else {
      if (!keyPath || !certPath) {
        throw new Error(
          "HTTPS enabled but SSL_KEY_FILE/SSL_CRT_FILE not provided in environment",
        );
      }
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);
      httpServer = https.createServer({ key, cert }, app);
    }
  } catch (err) {
    logWarn("https_fallback", { message: (err as Error).message });
    httpServer = createServer(app);
  }
} else {
  httpServer = createServer(app);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    id: string;
  }
}

app.use((req, res, next) => {
  const headerId = req.headers["x-request-id"];
  req.id =
    typeof headerId === "string" && headerId.length > 0
      ? headerId
      : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// CORS for API so the phone UI can POST commands cross-origin in dev
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();

  const origin = req.headers.origin;
  const originAllowed =
    typeof origin === "string" &&
    (corsOrigins.length === 0 ? !isProd : corsOrigins.includes(origin));

  if (originAllowed && origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return originAllowed ? res.sendStatus(204) : res.sendStatus(403);
  }
  next();
});

// Sessions for conversation history
const MemStore = MemoryStore(session);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "campus-companion-secret",
    cookie: {
      maxAge: 1000 * 60 * 60 * 4,
      httpOnly: true,
      sameSite: "lax",
      secure: isHttpsEnabled,
    },
    resave: false,
    saveUninitialized: true,
    store: new MemStore({ checkPeriod: 1000 * 60 * 10 }),
  }),
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logInfo("api_request", {
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: duration,
        requestId: req.id,
      });
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use("/api", (req, res) => {
    res
      .status(404)
      .json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not Found" },
        requestId: req.id,
      });
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const payload = toApiErrorPayload(err, isProd);
    logError("api_error", {
      code: payload.code,
      message: payload.message,
      status: payload.status,
      requestId: req.id,
    });
    res.status(payload.status).json({
      ok: false,
      error: {
        code: payload.code,
        message: payload.message,
        details: payload.details,
      },
      requestId: req.id,
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serve on PORT env var, default 5002. If in use, try next ports.
  const defaultPort = parseInt(process.env.PORT || "5002", 10);
  const host = process.env.HOST || "127.0.0.1";
  const maxAttempts = 5; // try up to 5 sequential ports
  let port = defaultPort;

  async function attemptListen(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: any) => {
        if (
          err?.code === "EADDRINUSE" &&
          port < defaultPort + maxAttempts - 1
        ) {
          logWarn("port_in_use", { port, nextPort: port + 1 });
          httpServer.off("error", onError);
          port += 1;
          // Recurse to try next port
          attemptListen().then(resolve).catch(reject);
        } else {
          httpServer.off("error", onError);
          reject(err);
        }
      };

      httpServer.once("error", onError);
      httpServer.listen(port, host, () => {
        logInfo("server_started", { port, host });
        httpServer.off("error", onError);
        resolve();
      });
    });
  }

  await attemptListen();

  // ── Graceful shutdown ──
  const shutdown = (signal: string) => {
    logInfo("shutdown_initiated", { signal });
    httpServer.close(() => {
      logInfo("server_closed");
      process.exit(0);
    });
    // Force exit after 5 seconds
    setTimeout(() => {
      logWarn("shutdown_timeout", { message: "Forcing exit after 5s" });
      process.exit(1);
    }, 5000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
