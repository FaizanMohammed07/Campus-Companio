/**
 * host.ts — Host Mode routes for event hosting.
 *
 * Guido can host college events: announce guests with LLM-generated
 * scripts and TTS.  All state is in-memory (no DB required).
 *
 * Endpoints:
 *   POST /api/host/event          — Create / update the active event
 *   POST /api/host/guests         — Add a guest to the runsheet
 *   DELETE /api/host/guests/:id   — Remove a guest
 *   GET  /api/host/runsheet       — Get ordered runsheet
 *   POST /api/host/announce/:id   — Generate LLM announcement + set HOST mode
 *   POST /api/host/crowd/:action  — Crowd prompts (applause, seated, etc.)
 *   POST /api/host/mode/stop      — Exit host mode → IDLE
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler, createError, sendOk } from "../utils/http";
import { logInfo, logWarn } from "../utils/logger";
import { setVisionMode, sendRobotCommand } from "../services/visionServer";

export const hostRouter = Router();

// ── Types ──

interface Guest {
  id: string;
  name: string;
  title: string;
  description: string;
  order: number;
  announced: boolean;
  script: string | null;
}

interface HostEvent {
  name: string;
  venue: string;
  date: string;
  description: string;
  guests: Guest[];
  active: boolean;
  createdAt: string;
}

// ── In-memory state ──

let activeEvent: HostEvent | null = null;
let guestIdCounter = 1;

// ── Zod schemas ──

const EventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  venue: z.string().min(1, "Venue is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().default(""),
});

const GuestSchema = z.object({
  name: z.string().min(1, "Guest name is required"),
  title: z.string().min(1, "Title/role is required"),
  description: z.string().default(""),
  order: z.number().int().min(0).optional(),
});

const CrowdActions = [
  "applause",
  "seated",
  "break",
  "welcome",
  "thankyou",
] as const;

const CrowdActionSchema = z.object({
  action: z.enum(CrowdActions),
});

// ── Crowd prompt templates ──

const CROWD_PROMPTS: Record<(typeof CrowdActions)[number], string> = {
  applause:
    "Ladies and gentlemen, please put your hands together! A round of applause!",
  seated:
    "If everyone could please take their seats, we will be continuing shortly.",
  break:
    "We will now take a short break. Please feel free to stretch your legs and we will resume in a few minutes.",
  welcome:
    "Welcome everyone to today's event! We are delighted to have you here with us.",
  thankyou:
    "Thank you all so much for being here today. Your presence makes this event truly special.",
};

// ══════════════════════════════════════════════
//  POST /api/host/event — Create / update event
// ══════════════════════════════════════════════
hostRouter.post(
  "/event",
  asyncHandler(async (req, res) => {
    const parsed = EventSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(
        400,
        "INVALID_EVENT",
        "Invalid event data",
        parsed.error.issues,
      );
    }

    const { name, venue, date, description } = parsed.data;

    activeEvent = {
      name,
      venue,
      date,
      description,
      guests: activeEvent?.guests ?? [],
      active: true,
      createdAt: new Date().toISOString(),
    };

    logInfo("host_event_created", { name, venue, date });

    return sendOk(
      res,
      {
        event: {
          name: activeEvent.name,
          venue: activeEvent.venue,
          date: activeEvent.date,
          description: activeEvent.description,
          guestCount: activeEvent.guests.length,
          active: activeEvent.active,
        },
        message: `Event "${name}" created successfully`,
      },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  POST /api/host/guests — Add guest
// ══════════════════════════════════════════════
hostRouter.post(
  "/guests",
  asyncHandler(async (req, res) => {
    if (!activeEvent) {
      throw createError(400, "NO_EVENT", "No active event. Create one first.");
    }

    const parsed = GuestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(
        400,
        "INVALID_GUEST",
        "Invalid guest data",
        parsed.error.issues,
      );
    }

    const { name, title, description, order } = parsed.data;

    const guest: Guest = {
      id: `guest_${guestIdCounter++}`,
      name,
      title,
      description,
      order: order ?? activeEvent.guests.length,
      announced: false,
      script: null,
    };

    activeEvent.guests.push(guest);

    // Sort by order
    activeEvent.guests.sort((a, b) => a.order - b.order);

    logInfo("host_guest_added", { guestId: guest.id, name });

    return sendOk(
      res,
      {
        guest,
        totalGuests: activeEvent.guests.length,
        message: `Guest "${name}" added`,
      },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  DELETE /api/host/guests/:id — Remove guest
// ══════════════════════════════════════════════
hostRouter.delete(
  "/guests/:id",
  asyncHandler(async (req, res) => {
    if (!activeEvent) {
      throw createError(400, "NO_EVENT", "No active event.");
    }

    const { id } = req.params;
    const idx = activeEvent.guests.findIndex((g) => g.id === id);

    if (idx === -1) {
      throw createError(404, "GUEST_NOT_FOUND", `Guest ${id} not found`);
    }

    const removed = activeEvent.guests.splice(idx, 1)[0];
    logInfo("host_guest_removed", { guestId: id, name: removed.name });

    return sendOk(
      res,
      {
        removed,
        totalGuests: activeEvent.guests.length,
        message: `Guest "${removed.name}" removed`,
      },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  GET /api/host/runsheet — Ordered guest list
// ══════════════════════════════════════════════
hostRouter.get(
  "/runsheet",
  asyncHandler(async (req, res) => {
    if (!activeEvent) {
      return sendOk(
        res,
        { event: null, guests: [], message: "No active event" },
        req.id,
      );
    }

    return sendOk(
      res,
      {
        event: {
          name: activeEvent.name,
          venue: activeEvent.venue,
          date: activeEvent.date,
          description: activeEvent.description,
          active: activeEvent.active,
        },
        guests: activeEvent.guests,
      },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  POST /api/host/announce/:id — Generate LLM script + set HOST mode
// ══════════════════════════════════════════════
hostRouter.post(
  "/announce/:id",
  asyncHandler(async (req, res) => {
    if (!activeEvent) {
      throw createError(400, "NO_EVENT", "No active event.");
    }

    const { id } = req.params;
    const guest = activeEvent.guests.find((g) => g.id === id);

    if (!guest) {
      throw createError(404, "GUEST_NOT_FOUND", `Guest ${id} not found`);
    }

    logInfo("host_announce_start", { guestId: id, name: guest.name });

    // Set Python vision server to HOST mode (YOLO runs, motor=STOP)
    try {
      await setVisionMode("HOST");
    } catch (err) {
      logWarn("host_set_mode_failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    // Generate announcement script via LLM
    const script = await generateAnnouncementScript(guest, activeEvent);

    // Generate Telugu translation (best-effort, don't fail if it doesn't work)
    let scriptTelugu: string | null = null;
    try {
      scriptTelugu = await generateTeluguTranslation(script);
    } catch (err) {
      logWarn("host_telugu_failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    // Physical nudge sequence — GUIDO moves theatrically during announcement
    try {
      await sendRobotCommand("CRUISE", 600);   // nudge forward
      await sendRobotCommand("STOP", 400);      // pause
      await sendRobotCommand("BACK", 600);      // back to position
      await sendRobotCommand("STOP", 200);      // settle
    } catch (err) {
      logWarn("host_nudge_failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    // Mark guest as announced and store script
    guest.announced = true;
    guest.script = script;

    logInfo("host_announce_done", { guestId: id, name: guest.name });

    return sendOk(
      res,
      {
        guest,
        script,
        scriptTelugu,
        message: `Announcement generated for ${guest.name}`,
      },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  POST /api/host/crowd/:action — Crowd prompts
// ══════════════════════════════════════════════
hostRouter.post(
  "/crowd/:action",
  asyncHandler(async (req, res) => {
    const action = req.params.action as (typeof CrowdActions)[number];

    if (!CrowdActions.includes(action)) {
      throw createError(
        400,
        "INVALID_CROWD_ACTION",
        `Invalid action. Use: ${CrowdActions.join(", ")}`,
      );
    }

    const prompt = CROWD_PROMPTS[action];

    logInfo("host_crowd_prompt", { action });

    return sendOk(
      res,
      {
        action,
        script: prompt,
        message: `Crowd prompt: ${action}`,
      },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  POST /api/host/mode/stop — Exit HOST mode
// ══════════════════════════════════════════════
hostRouter.post(
  "/mode/stop",
  asyncHandler(async (req, res) => {
    logInfo("host_mode_stop");

    // Set Python vision server back to IDLE
    try {
      await setVisionMode("IDLE");
    } catch (err) {
      logWarn("host_stop_mode_failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    return sendOk(
      res,
      { mode: "IDLE", message: "Host mode stopped" },
      req.id,
    );
  }),
);

// ══════════════════════════════════════════════
//  GET /api/host/runsheet/export — Download runsheet JSON
// ══════════════════════════════════════════════
hostRouter.get(
  "/runsheet/export",
  asyncHandler(async (req, res) => {
    if (!activeEvent) {
      throw createError(400, "NO_EVENT", "No active event to export.");
    }

    const exportData = {
      eventName: activeEvent.name,
      venue: activeEvent.venue,
      eventDate: activeEvent.date,
      description: activeEvent.description,
      exportedAt: new Date().toISOString(),
      totalGuests: activeEvent.guests.length,
      guests: activeEvent.guests.map((g) => ({
        id: g.id,
        name: g.name,
        title: g.title,
        description: g.description,
        order: g.order,
        announced: g.announced,
        script: g.script,
      })),
    };

    const safeName = activeEvent.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `guido-runsheet-${safeName}-${dateStr}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    logInfo("host_runsheet_export", { guests: activeEvent.guests.length });

    return res.status(200).send(JSON.stringify(exportData, null, 2));
  }),
);

// ══════════════════════════════════════════════
//  LLM Announcement Script Generator
// ══════════════════════════════════════════════

async function generateAnnouncementScript(
  guest: Guest,
  event: HostEvent,
): Promise<string> {
  const FALLBACK = `Please welcome ${guest.title} ${guest.name}. We are honored to have them with us today at ${event.name}.`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logWarn("host_no_api_key");
    return FALLBACK;
  }

  const modelsToTry = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "google/gemma-3-4b-it:free",
    "mistralai/mistral-7b-instruct:free",
  ];

  const prompt = `You are Guido, a friendly campus companion robot hosting "${event.name}" at ${event.venue}.
Generate a warm, professional announcement script (3-5 sentences) to introduce this guest:

Name: ${guest.name}
Title/Role: ${guest.title}
${guest.description ? `About: ${guest.description}` : ""}

Rules:
- Be warm, professional, and enthusiastic
- Keep it concise (3-5 sentences max)
- Include the guest's name and title
- End with an invitation for applause
- Do NOT include stage directions or brackets
- Return ONLY the announcement text, nothing else`;

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.OPENROUTER_REFERER || "",
            "X-Title": process.env.OPENROUTER_TITLE || "Campus Companion",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (resp.status === 429 || resp.status === 503) {
        logInfo("host_announce_rate_limited", {
          model,
          status: resp.status,
        });
        continue;
      }

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        logInfo("host_announce_llm_error", {
          model,
          status: resp.status,
          body: errBody.slice(0, 200),
        });
        continue;
      }

      const data = (await resp.json()) as Record<string, unknown>;
      const choices = data?.choices as
        | Array<{ message: { content: string } }>
        | undefined;
      const content: string = choices?.[0]?.message?.content ?? "";

      if (content.trim()) {
        logInfo("host_announce_success", { model });
        return content.trim();
      }
    } catch (err) {
      logInfo("host_announce_exception", {
        model,
        error: err instanceof Error ? err.message : "unknown",
      });
      continue;
    }
  }

  // All models failed
  logWarn("host_announce_all_models_failed");
  return FALLBACK;
}

// ══════════════════════════════════════════════
//  Telugu Translation Generator
// ══════════════════════════════════════════════

async function generateTeluguTranslation(
  englishScript: string,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const prompt = `Translate this exact announcement into Telugu (Telugu script). Keep it natural and formal. Return only the Telugu translation, nothing else.

English text: ${englishScript}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_REFERER || "",
          "X-Title": process.env.OPENROUTER_TITLE || "Campus Companion",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-8b-instruct:free",
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!resp.ok) {
      logWarn("host_telugu_llm_error", { status: resp.status });
      return null;
    }

    const data = (await resp.json()) as Record<string, unknown>;
    const choices = data?.choices as
      | Array<{ message: { content: string } }>
      | undefined;
    const content: string = choices?.[0]?.message?.content ?? "";

    if (content.trim()) {
      logInfo("host_telugu_success");
      return content.trim();
    }

    return null;
  } catch (err) {
    logWarn("host_telugu_exception", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}
