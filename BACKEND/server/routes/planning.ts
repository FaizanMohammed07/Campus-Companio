import { Router } from "express";
import { z } from "zod";
import {
  Planner,
  PerceptionSchema,
  type MotionIntent,
  type BlockId,
} from "../services/planner";
import { postEsp32 } from "../services/esp32";
import rateLimit from "express-rate-limit";
import { sendOk } from "../utils/http";

const router = Router();
const planner = new Planner();

const planningLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 120 : 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const MissionSchema = z.object({
  start: z.enum(["A_BLOCK", "B_BLOCK", "C_BLOCK"]),
  goal: z.enum(["A_BLOCK", "B_BLOCK", "C_BLOCK"]),
});

// Internal: post to ESP32 /cmd
async function postToESP32(intent: MotionIntent) {
  const payload = {
    action: intent.action,
    speed: intent.speed,
    confidence: intent.confidence,
    timestamp: Date.now(),
  };
  const result = await postEsp32(payload, { timeoutMs: 1200 });
  return result.ok;
}

// Planning heartbeat loop
let loopStarted = false;
function startLoop() {
  if (loopStarted) return;
  loopStarted = true;
  setInterval(async () => {
    const intent = planner.step();
    if (!intent) return;
    // Never exceed command rate limits; Planner already guards
    await postToESP32(intent);
  }, 50); // check frequently; rate limit inside planner
}
startLoop();

// Mission setup: compute path and start planning
router.post("/mission", planningLimiter, (req, res) => {
  const parsed = MissionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({
        ok: false,
        error: {
          code: "INVALID_MISSION",
          message: "invalid mission",
          details: parsed.error.issues,
        },
        requestId: req.id,
      });
  }
  const { start, goal } = parsed.data;
  const path = planner.mission(start as BlockId, goal as BlockId);
  return sendOk(res, { path }, req.id);
});

// Perception updates from Vision server
router.post("/perception", planningLimiter, (req, res) => {
  const parsed = PerceptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({
        ok: false,
        error: {
          code: "INVALID_PERCEPTION",
          message: "invalid perception",
          details: parsed.error.issues,
        },
        requestId: req.id,
      });
  }
  planner.updatePerception(parsed.data);
  return sendOk(res, { updated: true }, req.id);
});

// Status endpoint
router.get("/status", planningLimiter, (req, res) => {
  return sendOk(res, planner.currentState(), req.id);
});

export const planningRouter = router;
