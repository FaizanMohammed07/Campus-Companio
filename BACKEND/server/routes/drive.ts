import { Router } from "express";
import { z } from "zod";
import { postEsp32 } from "../services/esp32";
import { asyncHandler, sendOk } from "../utils/http";
import rateLimit from "express-rate-limit";

// Accepts minimal frontend payload (symbolic only) and/or complete contract.
const FrontPayload = z
  .object({
    action: z.enum([
      "FORWARD",
      "LEFT",
      "RIGHT",
      "STOP",
      "ROTATE_LEFT",
      "ROTATE_RIGHT",
    ]),
    confidence: z.number().min(0).max(1),
    timestamp: z.number(),
  })
  .strict();

const ContractPayload = z
  .object({
    action: z.enum([
      "FORWARD",
      "LEFT",
      "RIGHT",
      "STOP",
      "ROTATE_LEFT",
      "ROTATE_RIGHT",
    ]),
    speed: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    timestamp: z.number(),
  })
  .strict();

export const driveRouter = Router();

const driveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 180 : 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/drive/command forwards to ESP32 endpoint from env ESP32_URL or query ?target=
// Intended to avoid CORS from the phone browser and centralize safety checks.

driveRouter.post(
  "/command",
  driveLimiter,
  asyncHandler(async (req, res) => {
    // Allow either contract or front payload; normalize to contract
    const contractTry = ContractPayload.safeParse(req.body);
    let normalized: z.infer<typeof ContractPayload> | null = null;
    if (contractTry.success) {
      normalized = contractTry.data;
    } else {
      const frontTry = FrontPayload.safeParse(req.body);
      if (!frontTry.success) {
        return res
          .status(400)
          .json({
            ok: false,
            error: {
              code: "INVALID_COMMAND",
              message: "Invalid command payload",
              details: frontTry.error.issues,
            },
            requestId: req.id,
          });
      }
      const { action, confidence, timestamp } = frontTry.data;
      // Map action to a safe default speed; ESP32 still owns final limits
      const speedMap: Record<string, number> = {
        FORWARD: 1.0,
        LEFT: 0.7,
        RIGHT: 0.7,
        ROTATE_LEFT: 0.6,
        ROTATE_RIGHT: 0.6,
        STOP: 0.0,
      };
      normalized = { action, speed: speedMap[action], confidence, timestamp };
    }

    // Safety filter: ignore low confidence
    if (normalized.confidence < 0.6) {
      return sendOk(
        res,
        { forwarded: false, reason: "low_confidence_ignored" },
        req.id,
        202,
      );
    }

    const target = (req.query.target as string) || undefined;
    const result = await postEsp32(normalized, { target, timeoutMs: 1500 });
    if (!result.ok) {
      return res
        .status(502)
        .json({
          ok: false,
          error: {
            code: "ESP32_UNREACHABLE",
            message: result.error || "esp32_unreachable",
          },
          requestId: req.id,
        });
    }
    return sendOk(res, { forwarded: true }, req.id);
  }),
);
