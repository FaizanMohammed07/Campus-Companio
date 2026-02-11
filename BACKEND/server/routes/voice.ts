import { Router } from "express";
import { z } from "zod";
import { callOpenRouter } from "../services/openrouter";
import { mapIntent } from "../services/intentMapper";
import { postEsp32 } from "../services/esp32";
import {
  asyncHandler,
  createError,
  extractJsonObject,
  sendOk,
} from "../utils/http";
import rateLimit from "express-rate-limit";

const router = Router();

const VoiceCommandInput = z.object({
  transcript: z.string().min(1),
  uiContext: z.object({
    current_page: z.string().min(1),
    available_actions: z.array(z.string()).default([]),
    conversation_history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        }),
      )
      .optional(),
  }),
});

const OpenRouterResponseSchema = z.object({
  intent: z.enum(["NAVIGATE", "GUIDE", "BACK", "HELP", "STOP", "FACULTY_TASK"]),
  target: z
    .enum(["A_BLOCK", "B_BLOCK", "ADMISSION", "FEE", "NONE"])
    .default("NONE"),
  ui_action: z
    .enum(["OPEN_PAGE", "START_GUIDANCE", "SHOW_INFO", "GO_BACK"])
    .default("SHOW_INFO"),
  response_text: z.string().default(""),
});

const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 30 : 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/",
  voiceLimiter,
  asyncHandler(async (req, res) => {
    const { transcript, uiContext } = VoiceCommandInput.parse(req.body);

    // Session conversation state
    const session = req.session as any;
    session.conversation = Array.isArray(session.conversation)
      ? session.conversation
      : [];

    const llmPayload = {
      user_input: transcript,
      current_page: uiContext.current_page,
      available_actions: uiContext.available_actions,
      conversation_history: session.conversation,
    };

    const raw = await callOpenRouter(llmPayload);

    // Models may sometimes include extra text; extract JSON robustly
    const parsed = extractJsonObject(raw);
    if (!parsed) {
      throw createError(
        502,
        "LLM_RESPONSE_INVALID",
        "LLM did not return valid JSON",
      );
    }
    const validatedResult = OpenRouterResponseSchema.safeParse(parsed);
    if (!validatedResult.success) {
      throw createError(
        502,
        "LLM_RESPONSE_INVALID",
        "LLM response schema mismatch",
        validatedResult.error.issues,
      );
    }
    const validated = validatedResult.data;
    const mapped = mapIntent(validated);

    // Side-effect: if user intent is GUIDE or STOP, send mode command to ESP32.
    if (mapped.intent === "GUIDE") {
      postEsp32({ mode: "GUIDE" }).catch(() => {});
    } else if (mapped.intent === "STOP") {
      postEsp32({ mode: "STOP" }).catch(() => {});
    }

    // Update conversation history (keep short)
    session.conversation.push({ role: "user", content: transcript });
    session.conversation.push({
      role: "assistant",
      content: validated.response_text,
    });
    session.conversation = session.conversation.slice(-20);

    // Safety: this endpoint only triggers high-level mode; no direct PWM

    return sendOk(res, mapped, req.id);
  }),
);

export const voiceRouter = router;
