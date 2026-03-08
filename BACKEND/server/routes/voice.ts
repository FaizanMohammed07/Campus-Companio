import { Router } from "express";
import { z } from "zod";
import { callOpenRouter } from "../services/openrouter";
import { mapIntent } from "../services/intentMapper";
import {
  setVisionDestination,
  stopVisionServer,
  getVisionSnapshot,
} from "../services/visionServer";
import {
  asyncHandler,
  createError,
  extractJsonObject,
  sendOk,
} from "../utils/http";
import { logInfo } from "../utils/logger";
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
  intent: z.enum(["NAVIGATE", "GUIDE", "BACK", "HELP", "STOP", "FACULTY_TASK", "DESCRIBE"]),
  target: z
    .enum([
      "A_BLOCK", "B_BLOCK", "C_BLOCK",
      "ADMISSION", "FEE", "ADMIN",
      "LIBRARY", "EXAM", "CANTEEN",
      "NONE",
    ])
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

/**
 * Capture a camera snapshot from the vision server and send it to a
 * multimodal LLM to get a natural-language scene description.
 * Retries up to 2 times, falling back to alternate models on 429.
 */
async function describeVision(): Promise<string> {
  const FALLBACK = "I'm having trouble seeing right now, please try again.";

  // 1. Get snapshot from Python vision server
  const snap = await getVisionSnapshot();
  if (!snap.ok || !snap.data?.image_b64) {
    logInfo("describe_vision_no_frame");
    return FALLBACK;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return FALLBACK;

  // 2. Model list: primary from env, then paid fallbacks (very cheap)
  const primary = process.env.VISION_LLM_MODEL || "google/gemma-3-27b-it";
  const modelsToTry = [
    primary,
    "google/gemma-3-12b-it",
    "meta-llama/llama-3.2-11b-vision-instruct",
  ];

  const imagePayload = [
    {
      type: "text" as const,
      text: "You are a friendly campus companion robot named Guido. Describe what you see in this image in 2-3 sentences. Focus on people, objects, and the environment. Be concise and conversational.",
    },
    {
      type: "image_url" as const,
      image_url: {
        url: `data:image/jpeg;base64,${snap.data.image_b64}`,
      },
    },
  ];

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_REFERER || "",
          "X-Title": process.env.OPENROUTER_TITLE || "Campus Companion",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: imagePayload }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 429 || res.status === 503) {
        // Rate-limited or unavailable → try next model
        const errBody = await res.text().catch(() => "");
        logInfo("describe_vision_rate_limited", { model, status: res.status, body: errBody.slice(0, 200) });
        continue;
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        logInfo("describe_vision_llm_error", { model, status: res.status, body: errBody.slice(0, 300) });
        continue;
      }

      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      if (content.trim()) {
        logInfo("describe_vision_success", { model });
        return content.trim();
      }
    } catch (err: any) {
      logInfo("describe_vision_llm_exception", { model, error: err?.message });
      continue;
    }
  }

  // All models failed
  logInfo("describe_vision_all_models_failed");
  return FALLBACK;
}

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

    // Side-effect: DESCRIBE — capture camera frame, send to vision LLM, speak description
    if (mapped.intent === "DESCRIBE") {
      logInfo("voice_describe_vision");
      const description = await describeVision();
      const describeResult = {
        ...mapped,
        response_text: description,
      };

      session.conversation.push({ role: "user", content: transcript });
      session.conversation.push({
        role: "assistant",
        content: description,
      });
      session.conversation = session.conversation.slice(-20);

      return sendOk(res, describeResult, req.id);
    }

    // Side-effect: if user intent is GUIDE with a target, start a mission.
    // If STOP, tell vision server to stop.
    if (mapped.intent === "GUIDE" && mapped.target && mapped.target !== "NONE") {
      logInfo("voice_mission_start", { target: mapped.target });
      setVisionDestination(mapped.target).catch(() => {});
    } else if (mapped.intent === "STOP") {
      logInfo("voice_mission_stop");
      stopVisionServer().catch(() => {});
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
