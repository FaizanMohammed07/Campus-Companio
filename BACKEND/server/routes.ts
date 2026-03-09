import type { Express } from "express";
import { type Server } from "http";
import { voiceRouter } from "./routes/voice";
import { missionRouter } from "./routes/mission";
import { hostRouter } from "./routes/host";
import { ttsRouter } from "./routes/tts";
import { asyncHandler, sendOk } from "./utils/http";
import { getVisionHealth } from "./services/visionServer";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Voice command endpoint (LLM-based intent processing)
  app.use("/api/voice-command", voiceRouter);

  // Mission controller (start/stop/status — delegates to Python vision server)
  app.use("/api", missionRouter);

  // Host mode (event hosting — LLM announcements + TTS)
  app.use("/api/host", hostRouter);

  // ElevenLabs TTS proxy (keeps API key server-side)
  app.use("/api/tts", ttsRouter);

  // Health endpoint
  app.get("/api/health", asyncHandler(async (req, res) => {
    const vision = await getVisionHealth();
    return sendOk(res, {
      time: new Date().toISOString(),
      vision_server: vision.ok ? "connected" : "disconnected",
      vision_status: vision.data?.status || "unknown",
    }, req.id);
  }));

  return httpServer;
}
