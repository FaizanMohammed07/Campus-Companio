import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { requireAuth, requireRole } from "./auth";
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

// Validation schemas for database operations
const createVoiceCommandSchema = z.object({
  command: z.string().min(1, "Command text is required"),
  intent: z.string().min(1, "Intent is required"),
  confidence: z.number().min(0).max(1).optional(),
  userId: z.string().optional(), // Will be set from authenticated user
  transcribedText: z.string().optional(),
  response: z.string().optional(),
  success: z.boolean().default(true),
});

// Legacy voice command input for backward compatibility
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

// Legacy voice processing endpoint (maintains existing functionality)
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

    // Store voice command in database if user is authenticated
    if (req.user) {
      try {
        await storage.createVoiceCommand({
          command: transcript,
          intent: validated.intent.toLowerCase(),
          confidence: 0.8, // Could be extracted from LLM response
          userId: req.user.id,
          transcribedText: transcript,
          response: validated.response_text,
          success: true,
        });
      } catch (error) {
        console.error("Failed to store voice command:", error);
        // Don't fail the request if database storage fails
      }
    }

    // Safety: this endpoint only triggers high-level mode; no direct PWM

    return sendOk(res, mapped, req.id);
  }),
);

// New database-integrated endpoints

// GET /api/voice/commands - Get voice commands (admin/faculty only)
router.get(
  "/commands",
  requireAuth,
  requireRole(["admin", "faculty"]),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const commands = await storage.getVoiceCommands(limit);
      res.json({ commands });
    } catch (error) {
      console.error("Get voice commands error:", error);
      res.status(500).json({ error: "Failed to fetch voice commands" });
    }
  },
);

// POST /api/voice/commands - Create voice command manually
router.post("/commands", requireAuth, async (req, res) => {
  try {
    const commandData = createVoiceCommandSchema.parse(req.body);

    // Set user ID from authenticated user
    commandData.userId = req.user.id;

    const voiceCommand = await storage.createVoiceCommand(commandData);

    // Log voice command
    await storage.createSystemLog(
      "info",
      `Voice command created: "${commandData.command}"`,
      "voice",
      {
        commandId: voiceCommand.id,
        userId: req.user.id,
        intent: commandData.intent,
        success: commandData.success,
      },
    );

    res.status(201).json({ command: voiceCommand });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }

    console.error("Create voice command error:", error);
    res.status(500).json({ error: "Failed to create voice command" });
  }
});

// GET /api/voice/stats - Get voice command statistics (admin/faculty only)
router.get(
  "/stats",
  requireAuth,
  requireRole(["admin", "faculty"]),
  async (req, res) => {
    try {
      // Get recent commands for analysis
      const commands = await storage.getVoiceCommands(1000);

      // Calculate statistics
      const totalCommands = commands.length;
      const successfulCommands = commands.filter((c) => c.success).length;
      const successRate =
        totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0;

      // Group by intent
      const intentStats = commands.reduce(
        (acc, cmd) => {
          acc[cmd.intent] = (acc[cmd.intent] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Group by user
      const userStats = commands.reduce(
        (acc, cmd) => {
          if (cmd.userId) {
            acc[cmd.userId] = (acc[cmd.userId] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>,
      );

      res.json({
        stats: {
          totalCommands,
          successfulCommands,
          successRate: Math.round(successRate * 100) / 100,
          intentStats,
          userStats,
          timeRange: "last 1000 commands",
        },
      });
    } catch (error) {
      console.error("Get voice stats error:", error);
      res.status(500).json({ error: "Failed to fetch voice statistics" });
    }
  },
);

export const voiceRouter = router;
