import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import { callOpenRouter } from "./services/openrouter";
import { voiceRouter } from "./routes/voice";
import { driveRouter } from "./routes/drive";
import { planningRouter } from "./routes/planning";
import { modeRouter } from "./routes/mode";
import authRouter from "./routes/auth";
import locationsRouter from "./routes/locations";
import navigationRouter from "./routes/navigation";
import robotRouter from "./routes/robot";
import { asyncHandler, sendOk } from "./utils/http";

const PgSession = ConnectPgSimple(session);

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Session configuration
  app.use(
    session({
      store: new PgSession({
        conObject: {
          connectionString: process.env.DATABASE_URL,
        },
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "campus-companion-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // API Routes with authentication
  app.use("/api/auth", authRouter);
  app.use("/api/locations", locationsRouter);
  app.use("/api/navigation", navigationRouter);
  app.use("/api/robot", robotRouter);

  // Legacy routes (some may require authentication updates)
  app.use("/api/voice-command", voiceRouter);
  app.use("/api/drive", driveRouter);
  app.use("/api/planning", planningRouter);
  app.use("/api", modeRouter);

  // Health endpoint
  app.get("/api/health", (req, res) => {
    return sendOk(
      res,
      {
        time: new Date().toISOString(),
        authenticated: req.isAuthenticated(),
        user: req.user
          ? {
              id: (req.user as any).id,
              username: (req.user as any).username,
              role: (req.user as any).role,
            }
          : null,
      },
      req.id,
    );
  });

  // OpenRouter check endpoint (protected)
  app.get(
    "/api/openrouter-check",
    asyncHandler(async (req, res, next) => {
      try {
        if (!process.env.OPENROUTER_API_KEY) {
          return res.status(400).json({
            ok: false,
            error: {
              code: "OPENROUTER_NOT_CONFIGURED",
              message: "OPENROUTER_API_KEY missing",
            },
            requestId: req.id,
          });
        }

        const raw = await callOpenRouter({
          user_input: "Test: Guide me to admissions",
          current_page: "/",
          available_actions: [
            "Visitor Help",
            "Faculty & Office",
            "Campus Information",
          ],
          conversation_history: [],
        });

        return sendOk(res, { raw }, req.id);
      } catch (err: any) {
        return res.status(502).json({
          ok: false,
          error: {
            code: "OPENROUTER_ERROR",
            message: err?.message || String(err),
          },
          requestId: req.id,
        });
      }
    }),
  );

  // System logs endpoint (admin only)
  app.get("/api/logs", async (req, res) => {
    try {
      // Basic auth check - in production, use proper middleware
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getSystemLogs(limit);
      res.json({ logs });
    } catch (error) {
      console.error("Get logs error:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // User management endpoint (admin only)
  app.get("/api/users", async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const users = await storage.getUsers();
      // Remove passwords from response
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json({ users: safeUsers });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  return httpServer;
}
