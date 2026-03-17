/**
 * tts.ts — ElevenLabs Text-to-Speech proxy routes.
 *
 * The API key never leaves the backend.
 *
 * Endpoints:
 *   POST /api/tts/speak   — Convert text → streamed audio/mpeg via ElevenLabs
 *   GET  /api/tts/voices  — List available ElevenLabs voices (debug only)
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler, createError, sendOk } from "../utils/http";
import { logInfo, logWarn } from "../utils/logger";

export const ttsRouter = Router();

// ── Validation ──

const speakBodySchema = z.object({
  text: z
    .string()
    .min(1, "Text must not be empty")
    .max(5000, "Text must be 5000 characters or fewer"),
  voiceId: z.string().optional(),
});

// ── POST /api/tts/speak ──

ttsRouter.post(
  "/speak",
  asyncHandler(async (req, res) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey || apiKey === "your_elevenlabs_api_key_here") {
      throw createError(503, "TTS_NOT_CONFIGURED", "TTS service not configured");
    }

    const parsed = speakBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(
        400,
        "VALIDATION_ERROR",
        parsed.error.errors.map((e) => e.message).join("; "),
      );
    }

    const { text, voiceId: bodyVoiceId } = parsed.data;
    const voiceId =
      bodyVoiceId ||
      process.env.ELEVENLABS_VOICE_ID ||
      "pqHfZKP75CvOlQylNhV4"; // Bill — deep, warm male voice (free-tier compatible)
    const modelId = process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5";

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

    logInfo(`[TTS] Requesting ElevenLabs — voice=${voiceId} model=${modelId} text="${text.substring(0, 60)}…"`);

    // 10-second timeout via AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const elResponse = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.85,
            style: 0.6,
            use_speaker_boost: true,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!elResponse.ok) {
        const errorBody = await elResponse.text().catch(() => "no body");
        logWarn(
          `[TTS] ElevenLabs returned ${elResponse.status}: ${errorBody.substring(0, 200)}`,
        );
        res.status(502).json({
          ok: false,
          error: { code: "TTS_UPSTREAM_ERROR", message: "TTS service unavailable" },
          fallback: true,
        });
        return;
      }

      // Stream the audio back to the client
      const contentType = elResponse.headers.get("content-type") || "audio/mpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache");

      if (!elResponse.body) {
        throw createError(502, "TTS_NO_BODY", "TTS service returned empty body");
      }

      // Node 18+ ReadableStream → pipe to Express response
      const reader = elResponse.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        const canContinue = res.write(value);
        if (canContinue) {
          return pump();
        }
        // Back-pressure: wait for drain
        return new Promise<void>((resolve) => {
          res.once("drain", () => resolve(pump()));
        });
      };

      await pump();
      logInfo("[TTS] Audio stream complete");
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        logWarn("[TTS] Request timed out after 10 s");
        if (!res.headersSent) {
          res.status(504).json({
            ok: false,
            error: { code: "TTS_TIMEOUT", message: "TTS request timed out" },
            fallback: true,
          });
        }
        return;
      }
      throw err;
    }
  }),
);

// ── GET /api/tts/voices — list available voices (debug) ──

ttsRouter.get(
  "/voices",
  asyncHandler(async (req, res) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey || apiKey === "your_elevenlabs_api_key_here") {
      throw createError(503, "TTS_NOT_CONFIGURED", "TTS service not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const elResponse = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!elResponse.ok) {
        throw createError(502, "TTS_UPSTREAM_ERROR", "Could not fetch voices");
      }

      const data = await elResponse.json();
      sendOk(res, data, req.id);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        throw createError(504, "TTS_TIMEOUT", "Voices request timed out");
      }
      throw err;
    }
  }),
);
