import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { callOpenRouter } from "./services/openrouter";
import { voiceRouter } from "./routes/voice";
import { driveRouter } from "./routes/drive";
import { planningRouter } from "./routes/planning";
import { modeRouter } from "./routes/mode";
import { asyncHandler, sendOk } from "./utils/http";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Voice command endpoint
  app.use("/api/voice-command", voiceRouter);
  // Drive command proxy to ESP32
  app.use("/api/drive", driveRouter);
  // Path planning server endpoints
  app.use("/api/planning", planningRouter);
  // ESP32 mode control (GUIDE/STOP)
  app.use("/api", modeRouter);

  // Simple health endpoint for diagnostics
  app.get("/api/health", (req, res) => {
    return sendOk(res, { time: new Date().toISOString() }, req.id);
  });

  app.get(
    "/api/openrouter-check",
    asyncHandler(async (req, res) => {
      try {
        if (!process.env.OPENROUTER_API_KEY) {
          return res
            .status(400)
            .json({
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
        return res
          .status(502)
          .json({
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

  return httpServer;
}
