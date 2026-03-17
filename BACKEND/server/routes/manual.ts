/**
 * manual.ts — Backend routes for PS5 DualSense gamepad control.
 *
 * POST /command    → Forward manual motor command to Python vision server
 * POST /mode       → Switch control mode (manual / assisted / autonomous)
 * GET  /status     → Return current control mode & last command
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendManualCommand, setVisionControlMode, getVisionStatus } from "../services/visionServer";

const manualRouter = Router();

// ── Schemas ──

const commandSchema = z.object({
  command: z.enum([
    "CRUISE",
    "STOP",
    "LEFT",
    "RIGHT",
    "BACK",
    "SCAN",
    "PREFER_LEFT",
    "PREFER_RIGHT",
  ]),
  speed: z.number().min(0).max(1),
  mode: z.enum(["manual", "assisted", "autonomous"]),
});

const modeSchema = z.object({
  mode: z.enum(["manual", "assisted", "autonomous"]),
});

// ── State ──

let lastCommand = "STOP";
let lastSpeed = 0;
let controlMode: "manual" | "assisted" | "autonomous" = "autonomous";

// ── Routes ──

/**
 * POST /command — forward a manual motor command to Python server.
 */
manualRouter.post("/command", async (req: Request, res: Response) => {
  try {
    const parsed = commandSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    const { command, speed, mode } = parsed.data;
    console.log("[MANUAL] command received:", { command, speed, mode });

    // Update local state
    lastCommand = command;
    lastSpeed = speed;
    controlMode = mode;

    // Forward to Python vision server
    console.log("[MANUAL] forwarding to Python...");
    const result = await sendManualCommand(command, speed, mode);
    console.log("[MANUAL] Python response:", result);

    if (!result.ok) {
      return res.status(503).json({ ok: false, error: "Vision server unavailable" });
    }

    res.json({ ok: true, command, speed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[Manual] Command error:", message);
    res.status(502).json({ ok: false, error: "Failed to forward command to vision server" });
  }
});

/**
 * POST /mode — switch control mode.
 */
manualRouter.post("/mode", async (req: Request, res: Response) => {
  try {
    const parsed = modeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    }

    const { mode } = parsed.data;
    console.log("[MANUAL] mode change requested:", mode);
    controlMode = mode;

    // Notify Python server
    const result = await setVisionControlMode(mode);
    console.log("[MANUAL] Python mode response:", result);

    if (!result.ok) {
      return res.status(503).json({ ok: false, error: "Vision server unavailable" });
    }

    res.json({ ok: true, mode });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[Manual] Mode error:", message);
    res.status(502).json({ ok: false, error: "Failed to set control mode on vision server" });
  }
});

/**
 * GET /status — return current control mode and last command.
 */
manualRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const visionStatus = await getVisionStatus();
    res.json({
      ok: true,
      controlMode,
      lastCommand,
      lastSpeed,
      visionStatus: visionStatus.ok ? visionStatus.data : null,
    });
  } catch {
    // Return local state even if vision server is unreachable
    res.json({
      ok: true,
      controlMode,
      lastCommand,
      lastSpeed,
      visionStatus: null,
    });
  }
});

export default manualRouter;
