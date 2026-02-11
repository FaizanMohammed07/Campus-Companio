import { Router } from "express";
import { z } from "zod";
import { postEsp32 } from "../services/esp32";
import { asyncHandler, sendOk } from "../utils/http";
import rateLimit from "express-rate-limit";

const router = Router();

const modeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 60 : 180,
  standardHeaders: true,
  legacyHeaders: false,
});

const ModeSchema = z.object({ mode: z.enum(["GUIDE", "STOP"]) });

async function postMode(mode: "GUIDE" | "STOP"): Promise<boolean> {
  const result = await postEsp32({ mode }, { timeoutMs: 1200 });
  return result.ok;
}

// Simple heartbeat manager to keep GUIDE alive (due to firmware timeout)
let guideInterval: NodeJS.Timeout | null = null;
async function startGuideHeartbeat() {
  if (guideInterval) return;
  // Kick immediately
  await postMode("GUIDE");
  guideInterval = setInterval(() => {
    postMode("GUIDE").catch(() => {});
  }, 1000);
}
function stopGuideHeartbeat() {
  if (guideInterval) {
    clearInterval(guideInterval);
    guideInterval = null;
  }
}

router.post(
  "/mode",
  modeLimiter,
  asyncHandler(async (req, res) => {
    const parsed = ModeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          ok: false,
          error: {
            code: "INVALID_MODE",
            message: "invalid mode payload",
            details: parsed.error.issues,
          },
          requestId: req.id,
        });
    }
    const ok = await postMode(parsed.data.mode);
    if (ok && parsed.data.mode === "GUIDE") await startGuideHeartbeat();
    if (ok && parsed.data.mode === "STOP") stopGuideHeartbeat();
    if (!ok) {
      return res
        .status(502)
        .json({
          ok: false,
          error: { code: "ESP32_UNREACHABLE", message: "esp32_unreachable" },
          requestId: req.id,
        });
    }
    return sendOk(res, { ok }, req.id);
  }),
);

export const modeRouter = router;
