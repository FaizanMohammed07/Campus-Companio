/**
 * mission.ts — Mission controller routes.
 *
 * The backend is a MISSION CONTROLLER, NOT a motor controller.
 * It validates requests from the frontend and delegates to the
 * Python Vision Server which is the single movement authority.
 *
 * Endpoints:
 *   POST /api/mission     — Start a guidance mission to a destination
 *   POST /api/stop        — Emergency stop / cancel mission
 *   GET  /api/status      — Proxied live status from Python vision server
 */

import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  setVisionDestination,
  stopVisionServer,
  getVisionStatus,
  getVisionDetailedStatus,
} from "../services/visionServer";
import { asyncHandler, createError, sendOk } from "../utils/http";
import { logInfo, logWarn } from "../utils/logger";

export const missionRouter = Router();

// ── Valid destinations (must match Python config.valid_destinations) ──
const VALID_DESTINATIONS = [
  "A_BLOCK",
  "B_BLOCK",
  "C_BLOCK",
  "ADMISSION",
  "FEE",
  "ADMIN",
  "LIBRARY",
  "EXAM",
  "CANTEEN",
] as const;

// ── Zod schemas ──
const MissionSchema = z.object({
  destination: z.enum(VALID_DESTINATIONS),
});

const missionLimiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === "production" ? 30 : 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Shared state ──
let currentMode: "IDLE" | "GUIDE" = "IDLE";
let currentDestination: string | null = null;

// ══════════════════════════════════════════════
//  POST /api/mission — Start guidance mission
// ══════════════════════════════════════════════
missionRouter.post(
  "/mission",
  missionLimiter,
  asyncHandler(async (req, res) => {
    const parsed = MissionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(400, "INVALID_MISSION", "Invalid destination", parsed.error.issues);
    }

    const { destination } = parsed.data;

    logInfo("mission_start", { destination, requestId: req.id });

    // Tell Python vision server to navigate to this destination
    const result = await setVisionDestination(destination);

    if (!result.ok) {
      logWarn("mission_vision_error", {
        destination,
        error: result.error,
      });
      throw createError(
        502,
        "VISION_SERVER_ERROR",
        result.error || "Vision server unreachable",
      );
    }

    // Update local state
    currentMode = "GUIDE";
    currentDestination = destination;

    return sendOk(
      res,
      {
        mode: currentMode,
        destination: currentDestination,
        message: `Mission started: navigating to ${destination}`,
      },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  POST /api/stop — Emergency stop / cancel
// ══════════════════════════════════════════════
missionRouter.post(
  "/stop",
  asyncHandler(async (req, res) => {
    logInfo("mission_stop", { requestId: req.id });

    // Tell Python vision server to stop
    const result = await stopVisionServer();

    if (!result.ok) {
      logWarn("stop_vision_error", { error: result.error });
      // Even if vision server is unreachable, update local state
    }

    currentMode = "IDLE";
    currentDestination = null;

    return sendOk(
      res,
      {
        mode: currentMode,
        destination: null,
        message: "Robot stopped",
      },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  GET /api/status — Live status (proxied from Python)
// ══════════════════════════════════════════════
missionRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const result = await getVisionStatus();

    if (!result.ok || !result.data) {
      // Return degraded status if vision server is down
      return sendOk(
        res,
        {
          mode: currentMode,
          destination: currentDestination,
          pipeline_healthy: false,
          nav_state: "UNKNOWN",
          intent: "STOP",
          person_detected: false,
          error: result.error || "Vision server unreachable",
        },
        req.id,
      );
    }

    const vs = result.data;

    // Sync local state with Python's actual state
    if (vs.nav_state === "ARRIVED") {
      currentMode = "IDLE";
    }
    if (vs.nav_state === "IDLE" && currentMode === "GUIDE") {
      // Python stopped on its own (crash recovery, etc.)
      currentMode = "IDLE";
      currentDestination = null;
    }

    return sendOk(
      res,
      {
        mode: currentMode,
        destination: vs.destination || currentDestination,
        pipeline_healthy: vs.pipeline_healthy,
        nav_state: vs.nav_state,
        intent: vs.intent,
        person_detected: vs.person_detected,
        person_zone: vs.person_zone,
        confidence: vs.confidence,
        nav_obstacles: vs.nav_obstacles,
        nav_paths: vs.nav_paths,
      },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  GET /api/detailed-status — Rich detection data + annotated frame
// ══════════════════════════════════════════════
missionRouter.get(
  "/detailed-status",
  asyncHandler(async (req, res) => {
    const result = await getVisionDetailedStatus();

    if (!result.ok || !result.data) {
      return sendOk(
        res,
        {
          mode: currentMode,
          destination: currentDestination,
          pipeline_healthy: false,
          error: result.error || "Vision server unreachable",
        },
        req.id,
      );
    }

    const vs = result.data;

    return sendOk(
      res,
      {
        mode: currentMode,
        destination: vs.destination || currentDestination,
        pipeline_healthy: vs.pipeline_healthy,
        // Person model
        person_detected: vs.person_detected,
        person_ratio: vs.person_ratio,
        person_zone: vs.person_zone,
        confidence: vs.confidence,
        person_detections: vs.person_detections || [],
        // Nav model
        nav_state: vs.nav_state,
        intent: vs.intent,
        nav_obstacles_count: vs.nav_obstacles_count || 0,
        nav_paths_count: vs.nav_paths_count || 0,
        nav_a_blocks_count: vs.nav_a_blocks_count || 0,
        nav_b_blocks_count: vs.nav_b_blocks_count || 0,
        nav_c_blocks_count: vs.nav_c_blocks_count || 0,
        nav_detections: vs.nav_detections || [],
        // Pipeline
        running: vs.running,
        frame_age_s: vs.frame_age_s,
        inference_failures: vs.inference_failures,
        // Annotated camera frame (base64 JPEG)
        annotated_frame: vs.annotated_frame || null,
      },
      req.id,
    );
  }),
);
